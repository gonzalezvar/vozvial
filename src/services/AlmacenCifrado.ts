import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from 'idb';

import { Caso, type CasoJSON } from '../core/Caso';
import type { IntentosSerializados } from '../core/ControlIntentos';
import type { ClaveEnvuelta, DatosCifrados, GestorClaves } from '../core/GestorClaves';
import type { ParametrosAutenticacion } from '../core/DerivadorVerificador';
import type { Credencial } from '../core/ServicioCredenciales';

export const NOMBRE_BASE = 'vozvial';
// Version 2: store "borrados" con las marcas de borrado que se sincronizan con el servidor.
const VERSION_BASE = 2;
const CLAVE_CUENTA = 'cuenta';
const LARGO_IV_BYTES = 12;
/** Prefijo de lo que la app guarda en localStorage (por ejemplo "vozvial.ajustes"). */
const PREFIJO_LOCAL_STORAGE = 'vozvial';

/**
 * Relacion de la cuenta local con la copia del servidor.
 * - registrada: existe en el servidor con el mismo PIN.
 * - pendiente: se creo sin conexion; se registra al entrar con internet (registroPendiente).
 * - pin_distinto: el servidor tiene otro PIN (se cambio en otro dispositivo o sin conexion).
 * - celular_en_uso: el celular ya tenia otra cuenta en el servidor.
 * Sin este campo la cuenta es anterior a la sincronizacion y vive solo en el dispositivo.
 */
export type EstadoCuentaServidor = 'registrada' | 'pendiente' | 'pin_distinto' | 'celular_en_uso';

export interface RegistroPendienteServidor extends ParametrosAutenticacion {
  /**
   * Verificador PBKDF2 del codigo de recuperacion. Solo existe mientras la cuenta no se ha
   * registrado en el servidor y se borra al registrarla; nunca se guarda el codigo en claro.
   */
  verificadorCodigo: string;
}

export interface CuentaServidor {
  estado: EstadoCuentaServidor;
  registroPendiente?: RegistroPendienteServidor;
}

/** Registro unico de la cuenta. Lo unico en claro son metadatos tecnicos (hash, sal, iv, iteraciones). */
export interface RegistroCuenta {
  credencial: Credencial;
  claveEnvueltaPin: ClaveEnvuelta;
  claveEnvueltaRecuperacion: ClaveEnvuelta;
  controlIntentos: IntentosSerializados;
  /** { nombre, celular } cifrado con la clave de datos. */
  perfilCifrado: DatosCifrados;
  servidor?: CuentaServidor;
}

export interface RegistroCaso extends DatosCifrados {
  id: string;
  /** ISO 8601 de la ultima modificacion. Los casos guardados antes de la sincronizacion no lo tienen. */
  actualizadoEn?: string;
}

/** Marca de un caso borrado en este dispositivo, para que el borrado llegue al servidor. Sin datos del caso. */
export interface RegistroBorrado {
  id: string;
  actualizadoEn: string;
}

export interface RegistroEvidencia {
  id: string;
  casoId: string;
  iv: Uint8Array<ArrayBuffer>;
  datos: ArrayBuffer;
}

interface EsquemaVozVial extends DBSchema {
  cuenta: { key: string; value: RegistroCuenta };
  casos: { key: string; value: RegistroCaso };
  borrados: { key: string; value: RegistroBorrado };
  evidencias: { key: string; value: RegistroEvidencia; indexes: { casoId: string } };
}

/**
 * Persistencia local en IndexedDB. Casos y contenido de evidencias se guardan cifrados con
 * AES-GCM usando la clave de datos de la sesion; nunca se escribe texto del usuario en claro.
 */
export class AlmacenCifrado {
  private conexion: Promise<IDBPDatabase<EsquemaVozVial>> | null = null;

  constructor(
    private readonly gestor: GestorClaves,
    private readonly crypto: Crypto,
    private readonly nombreBase: string = NOMBRE_BASE,
  ) {}

  abrir(): Promise<IDBPDatabase<EsquemaVozVial>> {
    this.conexion ??= openDB<EsquemaVozVial>(this.nombreBase, VERSION_BASE, {
      // Crea solo lo que falta: sirve para bases nuevas, para las de la version 1 y para una base vacia.
      upgrade(db) {
        const existe = (nombre: string) => db.objectStoreNames.contains(nombre as never);
        if (!existe('cuenta')) db.createObjectStore('cuenta');
        if (!existe('casos')) db.createObjectStore('casos', { keyPath: 'id' });
        if (!existe('evidencias')) db.createObjectStore('evidencias', { keyPath: 'id' }).createIndex('casoId', 'casoId');
        if (!existe('borrados')) db.createObjectStore('borrados', { keyPath: 'id' });
      },
    });
    return this.conexion;
  }

  async guardarCuenta(cuenta: RegistroCuenta): Promise<void> {
    await (await this.abrir()).put('cuenta', cuenta, CLAVE_CUENTA);
  }

  async leerCuenta(): Promise<RegistroCuenta | null> {
    return (await (await this.abrir()).get('cuenta', CLAVE_CUENTA)) ?? null;
  }

  /** Cifra y guarda el caso con su marca de modificacion. Devuelve el registro tal como quedo. */
  async guardarCaso(clave: CryptoKey, caso: Caso, actualizadoEn: string = new Date().toISOString()): Promise<RegistroCaso> {
    const cifrado = await this.gestor.cifrar(clave, JSON.stringify(caso.toJSON()));
    const registro: RegistroCaso = { id: caso.id, iv: cifrado.iv, datos: cifrado.datos, actualizadoEn };
    await this.guardarRegistroCaso(registro);
    return registro;
  }

  async leerCaso(clave: CryptoKey, id: string): Promise<Caso | null> {
    const registro = await (await this.abrir()).get('casos', id);
    return registro ? this.descifrarCaso(clave, registro) : null;
  }

  async listarCasos(clave: CryptoKey): Promise<Caso[]> {
    const registros = await (await this.abrir()).getAll('casos');
    return Promise.all(registros.map((r) => this.descifrarCaso(clave, r)));
  }

  /** Caso cifrado tal como esta guardado (para subirlo al servidor sin descifrarlo). */
  async leerRegistroCaso(id: string): Promise<RegistroCaso | null> {
    return (await (await this.abrir()).get('casos', id)) ?? null;
  }

  async listarRegistrosCasos(): Promise<RegistroCaso[]> {
    return (await this.abrir()).getAll('casos');
  }

  /** Guarda un caso ya cifrado (por ejemplo el que llega del servidor) y quita su marca de borrado. */
  async guardarRegistroCaso(registro: RegistroCaso): Promise<void> {
    const db = await this.abrir();
    const tx = db.transaction(['casos', 'borrados'], 'readwrite');
    await Promise.all([tx.objectStore('casos').put(registro), tx.objectStore('borrados').delete(registro.id), tx.done]);
  }

  /**
   * Borra el caso y el contenido de todas sus evidencias en una sola transaccion.
   * Con marcaBorrado deja una marca (solo id y fecha) para avisar del borrado al servidor.
   */
  async borrarCaso(id: string, opciones: { marcaBorrado?: string } = {}): Promise<void> {
    const db = await this.abrir();
    const tx = db.transaction(['casos', 'evidencias', 'borrados'], 'readwrite');
    const evidencias = tx.objectStore('evidencias');
    const ids = await evidencias.index('casoId').getAllKeys(id);
    const borrados = tx.objectStore('borrados');
    await Promise.all([
      tx.objectStore('casos').delete(id),
      ...ids.map((k) => evidencias.delete(k)),
      opciones.marcaBorrado ? borrados.put({ id, actualizadoEn: opciones.marcaBorrado }) : borrados.delete(id),
      tx.done,
    ]);
  }

  async listarBorrados(): Promise<RegistroBorrado[]> {
    return (await this.abrir()).getAll('borrados');
  }

  async guardarBorrado(registro: RegistroBorrado): Promise<void> {
    await (await this.abrir()).put('borrados', registro);
  }

  async guardarContenidoEvidencia(
    clave: CryptoKey,
    evidenciaId: string,
    casoId: string,
    bytes: Uint8Array,
  ): Promise<void> {
    const iv = this.crypto.getRandomValues(new Uint8Array(LARGO_IV_BYTES));
    // Copia a un ArrayBuffer propio: WebCrypto no acepta vistas sobre SharedArrayBuffer.
    const claro = new Uint8Array(bytes.byteLength);
    claro.set(bytes);
    const datos = await this.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, clave, claro);
    await (await this.abrir()).put('evidencias', { id: evidenciaId, casoId, iv, datos });
  }

  /** Lanza un Error si la evidencia no tiene contenido guardado o la clave no corresponde. */
  async leerContenidoEvidencia(clave: CryptoKey, id: string): Promise<Uint8Array<ArrayBuffer>> {
    const registro = await (await this.abrir()).get('evidencias', id);
    if (!registro) throw new Error(`La evidencia ${id} no tiene contenido guardado.`);
    const iv = new Uint8Array(registro.iv);
    const claro = await this.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, clave, registro.datos);
    return new Uint8Array(claro);
  }

  async borrarContenidoEvidencia(id: string): Promise<void> {
    await (await this.abrir()).delete('evidencias', id);
  }

  /** Contenido cifrado tal como esta guardado (para subirlo sin descifrarlo). */
  async leerRegistroEvidencia(id: string): Promise<RegistroEvidencia | null> {
    return (await (await this.abrir()).get('evidencias', id)) ?? null;
  }

  async guardarRegistroEvidencia(registro: RegistroEvidencia): Promise<void> {
    await (await this.abrir()).put('evidencias', registro);
  }

  async listarIdsEvidencias(): Promise<string[]> {
    return (await this.abrir()).getAllKeys('evidencias');
  }

  /** Borra la base completa y lo que la app dejo en localStorage. */
  async borrarTodo(): Promise<void> {
    if (this.conexion) {
      (await this.conexion).close();
      this.conexion = null;
    }
    await deleteDB(this.nombreBase);
    AlmacenCifrado.borrarLocalStorage();
  }

  private async descifrarCaso(clave: CryptoKey, registro: RegistroCaso): Promise<Caso> {
    const texto = await this.gestor.descifrarTexto(clave, { iv: registro.iv, datos: registro.datos });
    return Caso.desdeJSON(JSON.parse(texto) as CasoJSON);
  }

  private static borrarLocalStorage(): void {
    try {
      const ls = (globalThis as { localStorage?: Storage }).localStorage;
      if (!ls) return;
      const claves: string[] = [];
      for (let i = 0; i < ls.length; i++) {
        const k = ls.key(i);
        if (k?.startsWith(PREFIJO_LOCAL_STORAGE)) claves.push(k);
      }
      for (const k of claves) ls.removeItem(k);
    } catch {
      // Navegador sin localStorage disponible: no hay nada que borrar.
    }
  }
}
