import { Caso, type CasoJSON } from '../core/Caso';
import { CodificacionBase64 } from '../core/CodificacionBase64';
import type { Evidencia } from '../core/Evidencia';
import type { GestorClaves } from '../core/GestorClaves';
import { ResolvedorSincronizacion, type MarcaRegistro } from '../core/ResolvedorSincronizacion';
import type { AlmacenCifrado, RegistroCaso } from './AlmacenCifrado';
import type {
  CasoRemoto,
  EvidenciaDescargada,
  MetadatosEvidenciaRemota,
  ResultadoEscrituraRemota,
} from './ClienteSincronizacion';
import { ErrorApiDatos, type CausaErrorApi } from './PeticionApi';

/** Lo que el sincronizador usa de ClienteSincronizacion. Las pruebas unitarias pasan uno falso. */
export interface PuertoSincronizacion {
  listarCasos(desde?: string): Promise<{ casos: CasoRemoto[]; ahora: string }>;
  subirCaso(caso: { id: string; iv: string; datos: string; actualizadoEn: string }): Promise<ResultadoEscrituraRemota<CasoRemoto>>;
  borrarCaso(id: string, actualizadoEn: string): Promise<ResultadoEscrituraRemota<CasoRemoto>>;
  listarEvidencias(): Promise<MetadatosEvidenciaRemota[]>;
  bajarEvidencia(id: string): Promise<EvidenciaDescargada | null>;
  subirEvidencia(
    evidencia: { id: string; casoId: string; iv: Uint8Array | string; mime: string; actualizadoEn: string },
    datosCifrados: Uint8Array | ArrayBuffer,
  ): Promise<ResultadoEscrituraRemota<MetadatosEvidenciaRemota>>;
  borrarEvidencia(id: string): Promise<boolean>;
}

/**
 * Estado visible de la copia en el servidor:
 * - sincronizando: subiendo o bajando cambios.
 * - al_dia: el servidor tiene lo mismo que el dispositivo.
 * - pendiente: hay cambios sin subir; se reintenta solo.
 * - sin_conexion: no hay internet; los datos siguen en el dispositivo.
 * - error: no se puede seguir sin que la persona haga algo (por ejemplo volver a entrar).
 */
export type EstadoSincronizacion = 'sincronizando' | 'al_dia' | 'pendiente' | 'sin_conexion' | 'error';

export interface ResumenSincronizacion {
  subidos: number;
  bajados: number;
  borradosLocal: number;
  evidenciasSubidas: number;
  evidenciasBajadas: number;
  /** Mensajes sencillos de lo que no se pudo copiar (por ejemplo un archivo muy grande). */
  avisos: string[];
}

export interface OpcionesSincronizador {
  almacen: AlmacenCifrado;
  gestor: GestorClaves;
  remoto: PuertoSincronizacion;
  obtenerClave: () => CryptoKey | null;
  reloj?: () => Date;
  /** Se llama cuando cambiaron casos del dispositivo por datos del servidor (para refrescar las listas). */
  alCambiarDatos?: () => void;
  alCambiarEstado?: (estado: EstadoSincronizacion, mensaje: string | null) => void;
  /** Esperas entre reintentos cuando falla la conexion. La ultima se repite. */
  reintentosMs?: readonly number[];
  programar?: (fn: () => void, ms: number) => () => void;
}

/** Fecha de los casos guardados antes de que existiera la sincronizacion: pierden contra cualquier version remota. */
const MARCA_ANTIGUA = '1970-01-01T00:00:00.000Z';
const REINTENTOS_MS = [5_000, 15_000, 60_000] as const;

/** Errores que se resuelven solos con un reintento. */
const CAUSAS_TRANSITORIAS = new Set<CausaErrorApi>([
  'sin_conexion',
  'tiempo_agotado',
  'bd_no_disponible',
  'servidor',
  'limite_peticiones',
]);

const MIME_POR_TIPO: Record<string, string> = { audio: 'audio/webm', foto: 'image/jpeg' };

/**
 * Copia cifrada de casos y evidencias entre IndexedDB y el servidor. Nunca descifra para subir:
 * viaja el mismo { iv, datos } que guarda AlmacenCifrado. Solo descifra los casos del dispositivo
 * para saber que evidencias referencian. Gana el mas reciente por actualizadoEn (ResolvedorSincronizacion).
 * Todas las operaciones van en fila para que dos sincronizaciones no se crucen.
 */
export class SincronizadorCasos {
  private readonly almacen: AlmacenCifrado;
  private readonly gestor: GestorClaves;
  private readonly remoto: PuertoSincronizacion;
  private readonly obtenerClave: () => CryptoKey | null;
  private readonly reloj: () => Date;
  private readonly alCambiarDatos: () => void;
  private readonly alCambiarEstado: (estado: EstadoSincronizacion, mensaje: string | null) => void;
  private readonly reintentosMs: readonly number[];
  private readonly programar: (fn: () => void, ms: number) => () => void;

  private fila: Promise<unknown> = Promise.resolve();
  private cancelarReintento: (() => void) | null = null;
  private intentoFallido = 0;
  private detenido = false;
  private estadoActual: EstadoSincronizacion = 'pendiente';

  constructor(opciones: OpcionesSincronizador) {
    this.almacen = opciones.almacen;
    this.gestor = opciones.gestor;
    this.remoto = opciones.remoto;
    this.obtenerClave = opciones.obtenerClave;
    this.reloj = opciones.reloj ?? (() => new Date());
    this.alCambiarDatos = opciones.alCambiarDatos ?? (() => undefined);
    this.alCambiarEstado = opciones.alCambiarEstado ?? (() => undefined);
    this.reintentosMs = opciones.reintentosMs ?? REINTENTOS_MS;
    this.programar =
      opciones.programar ??
      ((fn, ms) => {
        const id = setTimeout(fn, ms);
        return () => clearTimeout(id);
      });
  }

  get estado(): EstadoSincronizacion {
    return this.estadoActual;
  }

  /** Baja y sube todo lo que haga falta. Si falla la conexion queda pendiente y se reintenta solo. */
  sincronizarTodo(): Promise<ResumenSincronizacion | null> {
    return this.enFila(() => this.ejecutarTodo());
  }

  /** Despues de guardar un caso: lo sube enseguida (con sus evidencias nuevas). Si falla, se reintenta. */
  casoGuardado(id: string): Promise<void> {
    return this.enFila(async () => {
      await this.conManejoDeErrores(async () => {
        const resumen = SincronizadorCasos.resumenVacio();
        const remotas = await this.remoto.listarEvidencias();
        const registro = await this.almacen.leerRegistroCaso(id);
        if (registro) {
          await this.subirRegistro(registro, resumen);
          await this.sincronizarEvidenciasDe([id], remotas, resumen);
        }
        return resumen;
      });
    }).then(() => undefined);
  }

  /** Despues de borrar un caso en el dispositivo: deja la marca de borrado en el servidor. */
  casoBorrado(id: string): Promise<void> {
    return this.enFila(async () => {
      await this.conManejoDeErrores(async () => {
        const marca = (await this.almacen.listarBorrados()).find((b) => b.id === id);
        if (marca) await this.subirBorrado(marca.id, marca.actualizadoEn, SincronizadorCasos.resumenVacio());
        return SincronizadorCasos.resumenVacio();
      });
    }).then(() => undefined);
  }

  /** Despues de quitar una evidencia de un caso: borra su archivo del servidor y sube el caso. */
  evidenciaQuitada(casoId: string, evidenciaId: string): Promise<void> {
    return this.enFila(async () => {
      await this.conManejoDeErrores(async () => {
        const resumen = SincronizadorCasos.resumenVacio();
        const registro = await this.almacen.leerRegistroCaso(casoId);
        if (registro) await this.subirRegistro(registro, resumen);
        await this.remoto.borrarEvidencia(evidenciaId);
        return resumen;
      });
    }).then(() => undefined);
  }

  /** Baja del servidor el contenido de una evidencia que falta en el dispositivo. true si quedo guardado. */
  bajarContenidoEvidencia(id: string): Promise<boolean> {
    return this.enFila(async () => {
      try {
        const descargada = await this.remoto.bajarEvidencia(id);
        if (!descargada) return false;
        await this.guardarEvidenciaDescargada(descargada);
        return true;
      } catch {
        return false;
      }
    });
  }

  /** Al cerrar la sesion: cancela reintentos y deja de tocar el almacen. */
  detener(): void {
    this.detenido = true;
    this.cancelarReintento?.();
    this.cancelarReintento = null;
  }

  // --- Interno ---

  private enFila<T>(tarea: () => Promise<T>): Promise<T> {
    const siguiente = this.fila.then(tarea, tarea);
    this.fila = siguiente.catch(() => undefined);
    return siguiente;
  }

  private async ejecutarTodo(): Promise<ResumenSincronizacion | null> {
    return this.conManejoDeErrores(async () => {
      const resumen = SincronizadorCasos.resumenVacio();
      const [{ casos: remotos }, locales, borrados] = await Promise.all([
        this.remoto.listarCasos(),
        this.almacen.listarRegistrosCasos(),
        this.almacen.listarBorrados(),
      ]);
      const marcasLocales: MarcaRegistro[] = [
        ...locales.map((r) => ({ id: r.id, actualizadoEn: r.actualizadoEn ?? MARCA_ANTIGUA, borrado: false })),
        ...borrados.map((b) => ({ id: b.id, actualizadoEn: b.actualizadoEn, borrado: true })),
      ];
      const plan = ResolvedorSincronizacion.planear(marcasLocales, remotos);
      const porIdRemoto = new Map(remotos.map((r) => [r.id, r]));
      const porIdLocal = new Map(locales.map((r) => [r.id, r]));

      let cambioLocal = false;
      for (const marca of plan.bajar) {
        const remoto = porIdRemoto.get(marca.id);
        if (!remoto) continue;
        await this.almacen.guardarRegistroCaso(SincronizadorCasos.aRegistro(remoto));
        resumen.bajados++;
        cambioLocal = true;
      }
      for (const marca of plan.borrarLocal) {
        await this.almacen.borrarCaso(marca.id);
        resumen.borradosLocal++;
        cambioLocal = true;
      }
      for (const marca of plan.subir) {
        if (marca.borrado) {
          await this.subirBorrado(marca.id, marca.actualizadoEn, resumen);
          continue;
        }
        const registro = porIdLocal.get(marca.id);
        if (registro) cambioLocal = (await this.subirRegistro(registro, resumen)) || cambioLocal;
      }

      const idsCasos = (await this.almacen.listarRegistrosCasos()).map((r) => r.id);
      const remotas = await this.remoto.listarEvidencias();
      cambioLocal = (await this.sincronizarEvidenciasDe(idsCasos, remotas, resumen, true)) || cambioLocal;
      if (cambioLocal) this.alCambiarDatos();
      return resumen;
    });
  }

  /**
   * Sube un caso. Si el servidor tenia una version mas nueva, se guarda esa en el dispositivo.
   * Siempre se guarda la marca que devuelve el servidor (recorta las fechas del futuro a su hora).
   * Devuelve true si cambio el contenido del dispositivo.
   */
  private async subirRegistro(registro: RegistroCaso, resumen: ResumenSincronizacion): Promise<boolean> {
    const actualizadoEn = registro.actualizadoEn ?? this.reloj().toISOString();
    const r = await this.remoto.subirCaso({ id: registro.id, iv: registro.iv, datos: registro.datos, actualizadoEn });
    // El caso pudo cambiar en el dispositivo mientras subia: solo se toca si sigue igual.
    const vigente = await this.almacen.leerRegistroCaso(registro.id);
    const sigueIgual = vigente !== null && vigente.iv === registro.iv && vigente.datos === registro.datos;
    if (r.aplicado) {
      resumen.subidos++;
      if (sigueIgual) await this.almacen.guardarRegistroCaso({ ...registro, actualizadoEn: r.actual.actualizadoEn });
      return false;
    }
    if (!sigueIgual) return false;
    if (r.actual.borrado) {
      await this.almacen.borrarCaso(registro.id);
      resumen.borradosLocal++;
    } else {
      await this.almacen.guardarRegistroCaso(SincronizadorCasos.aRegistro(r.actual));
      resumen.bajados++;
    }
    return true;
  }

  private async subirBorrado(id: string, actualizadoEn: string, resumen: ResumenSincronizacion): Promise<void> {
    const r = await this.remoto.borrarCaso(id, actualizadoEn);
    if (r.aplicado || r.actual.borrado) {
      resumen.subidos++;
      await this.almacen.guardarBorrado({ id, actualizadoEn: r.actual.actualizadoEn });
      return;
    }
    // Otro dispositivo cambio el caso despues del borrado: gana esa version y vuelve a aparecer.
    await this.almacen.guardarRegistroCaso(SincronizadorCasos.aRegistro(r.actual));
    resumen.bajados++;
    this.alCambiarDatos();
  }

  /**
   * Sube los archivos que los casos referencian y el servidor no tiene, baja los que faltan en el
   * dispositivo y, con limpiar, borra del servidor los que ya ningun caso referencia.
   */
  private async sincronizarEvidenciasDe(
    idsCasos: readonly string[],
    remotas: readonly MetadatosEvidenciaRemota[],
    resumen: ResumenSincronizacion,
    limpiar = false,
  ): Promise<boolean> {
    const clave = this.obtenerClave();
    if (!clave) return false;
    const enServidor = new Set(remotas.map((e) => e.id));
    const enDispositivo = new Set(await this.almacen.listarIdsEvidencias());
    const referenciadas = new Set<string>();
    let cambio = false;

    for (const casoId of idsCasos) {
      const caso = await this.descifrar(clave, casoId);
      if (!caso) continue;
      for (const evidencia of caso.evidencias) {
        if (!evidencia.tieneArchivo()) continue;
        referenciadas.add(evidencia.id);
        if (!enServidor.has(evidencia.id) && enDispositivo.has(evidencia.id)) {
          await this.subirArchivo(casoId, evidencia, resumen);
        } else if (enServidor.has(evidencia.id) && !enDispositivo.has(evidencia.id)) {
          const descargada = await this.remoto.bajarEvidencia(evidencia.id);
          if (descargada) {
            await this.guardarEvidenciaDescargada(descargada);
            resumen.evidenciasBajadas++;
            cambio = true;
          }
        }
      }
    }

    if (limpiar) {
      const casosLocales = new Set(idsCasos);
      for (const remota of remotas) {
        if (casosLocales.has(remota.casoId) && !referenciadas.has(remota.id)) await this.remoto.borrarEvidencia(remota.id);
      }
    }
    return cambio;
  }

  private async subirArchivo(casoId: string, evidencia: Evidencia, resumen: ResumenSincronizacion): Promise<void> {
    const registro = await this.almacen.leerRegistroEvidencia(evidencia.id);
    if (!registro) return;
    try {
      await this.remoto.subirEvidencia(
        {
          id: evidencia.id,
          casoId,
          iv: new Uint8Array(registro.iv),
          mime: evidencia.mime ?? MIME_POR_TIPO[evidencia.tipo] ?? 'application/octet-stream',
          actualizadoEn: this.reloj().toISOString(),
        },
        registro.datos,
      );
      resumen.evidenciasSubidas++;
    } catch (error) {
      // Un archivo que el servidor no acepta no detiene el resto: queda solo en el dispositivo.
      if (error instanceof ErrorApiDatos && (error.causa === 'muy_grande' || error.causa === 'cuota_excedida')) {
        resumen.avisos.push(
          error.causa === 'muy_grande'
            ? 'Un archivo es muy grande para la copia en el servidor. Sigue guardado en este celular.'
            : 'Tu copia en el servidor está llena. Los archivos nuevos siguen en este celular.',
        );
        return;
      }
      throw error;
    }
  }

  private async guardarEvidenciaDescargada(descargada: EvidenciaDescargada): Promise<void> {
    const datos = new ArrayBuffer(descargada.datos.byteLength);
    new Uint8Array(datos).set(descargada.datos);
    await this.almacen.guardarRegistroEvidencia({
      id: descargada.id,
      casoId: descargada.casoId,
      iv: CodificacionBase64.decodificar(descargada.iv),
      datos,
    });
  }

  private async descifrar(clave: CryptoKey, id: string): Promise<Caso | null> {
    const registro = await this.almacen.leerRegistroCaso(id);
    if (!registro) return null;
    try {
      const texto = await this.gestor.descifrarTexto(clave, { iv: registro.iv, datos: registro.datos });
      return Caso.desdeJSON(JSON.parse(texto) as CasoJSON);
    } catch {
      return null;
    }
  }

  /** Corre la tarea, traduce los errores a un estado visible y programa el reintento si hace falta. */
  private async conManejoDeErrores(tarea: () => Promise<ResumenSincronizacion>): Promise<ResumenSincronizacion | null> {
    if (this.detenido) return null;
    this.cambiarEstado('sincronizando', null);
    try {
      const resumen = await tarea();
      if (this.detenido) return resumen;
      this.intentoFallido = 0;
      this.cambiarEstado('al_dia', resumen.avisos[0] ?? null);
      return resumen;
    } catch (error) {
      if (this.detenido) return null;
      const causa = error instanceof ErrorApiDatos ? error.causa : 'servidor';
      if (causa === 'no_autorizado') {
        this.cambiarEstado('error', 'Tu sesión con el servidor terminó. Sal y entra otra vez para guardar la copia.');
        return null;
      }
      if (CAUSAS_TRANSITORIAS.has(causa)) {
        this.cambiarEstado(
          causa === 'sin_conexion' ? 'sin_conexion' : 'pendiente',
          causa === 'sin_conexion'
            ? 'Sin internet. Tus casos siguen guardados en este celular y se copian cuando vuelva la conexión.'
            : 'No pudimos copiar tus casos ahora. Lo intentamos otra vez en un momento.',
        );
        this.programarReintento();
        return null;
      }
      this.cambiarEstado('error', 'No pudimos copiar tus casos al servidor. Tus casos siguen en este celular.');
      return null;
    }
  }

  private programarReintento(): void {
    this.cancelarReintento?.();
    const espera = this.reintentosMs[Math.min(this.intentoFallido, this.reintentosMs.length - 1)] ?? 60_000;
    this.intentoFallido++;
    this.cancelarReintento = this.programar(() => {
      this.cancelarReintento = null;
      void this.sincronizarTodo();
    }, espera);
  }

  private cambiarEstado(estado: EstadoSincronizacion, mensaje: string | null): void {
    this.estadoActual = estado;
    this.alCambiarEstado(estado, mensaje);
  }

  private static aRegistro(remoto: CasoRemoto): RegistroCaso {
    return { id: remoto.id, iv: remoto.iv, datos: remoto.datos, actualizadoEn: remoto.actualizadoEn };
  }

  private static resumenVacio(): ResumenSincronizacion {
    return { subidos: 0, bajados: 0, borradosLocal: 0, evidenciasSubidas: 0, evidenciasBajadas: 0, avisos: [] };
  }
}
