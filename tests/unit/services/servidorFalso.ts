// Servidor en memoria con el mismo contrato que /api/cuentas y /api/casos (docs/bd.md), para probar
// ServicioCuenta y SincronizadorCasos sin red. Verifica los verificadores PBKDF2 igual que el real
// y guarda solo lo que el real guarda: celular, verificadores, claves envueltas y datos cifrados.
import { CodificacionBase64 } from '../../../src/core/CodificacionBase64';
import { CodigoRecuperacion } from '../../../src/core/CodigoRecuperacion';
import { DerivadorVerificador } from '../../../src/core/DerivadorVerificador';
import type { GestorClaves } from '../../../src/core/GestorClaves';
import type { CuentaRemota, SesionRemota, SolicitudRegistro } from '../../../src/services/ClienteCuentas';
import type {
  CasoRemoto,
  EvidenciaDescargada,
  MetadatosEvidenciaRemota,
  ResultadoEscrituraRemota,
} from '../../../src/services/ClienteSincronizacion';
import { ErrorApiDatos } from '../../../src/services/PeticionApi';
import type { PuertoCuentasRemotas } from '../../../src/services/ServicioCuenta';
import type { PuertoSincronizacion } from '../../../src/services/SincronizadorCasos';

interface CuentaGuardada extends SolicitudRegistro {
  intentos: number;
}

export class ServidorFalso {
  readonly cuentas = new Map<string, CuentaGuardada>();
  readonly casos = new Map<string, Map<string, CasoRemoto>>();
  readonly evidencias = new Map<string, Map<string, EvidenciaDescargada>>();
  /** Todo lo que llego en las peticiones, para revisar que no viaje el PIN ni el nombre. */
  readonly recibido: string[] = [];
  enLinea = true;
  private readonly sesiones = new Map<string, string>();
  private readonly derivador: DerivadorVerificador;
  private siguienteToken = 0;

  constructor(private readonly crypto: Crypto) {
    this.derivador = new DerivadorVerificador(crypto);
  }

  // --- Cuentas ---

  cuentasRemotas(): PuertoCuentasRemotas {
    return {
      registrar: async (s) => {
        this.revisar(s);
        if (this.cuentas.has(s.celular)) throw new ErrorApiDatos('ya_existe', 'Ya existe.', 409);
        this.cuentas.set(s.celular, { ...s, intentos: 0 });
        return this.abrirSesion(s.celular);
      },
      entrarConPin: async (celular, pin) => {
        this.revisar({ celular });
        const cuenta = this.cuentas.get(celular);
        if (!cuenta || (await this.derivador.verificadorPin(pin, cuenta)) !== cuenta.verificadorPin) {
          if (cuenta) cuenta.intentos++;
          throw new ErrorApiDatos('credenciales_invalidas', 'No.', 401, Math.max(0, 5 - (cuenta?.intentos ?? 1)));
        }
        cuenta.intentos = 0;
        return this.cuentaRemota(cuenta);
      },
      recuperarConCodigo: async (celular, codigo, pinNuevo, gestor: GestorClaves) => {
        this.revisar({ celular });
        const cuenta = this.cuentas.get(celular);
        if (!cuenta || (await this.derivador.verificadorCodigo(codigo, cuenta)) !== cuenta.verificadorCodigo) {
          throw new ErrorApiDatos('codigo_invalido', 'No.', 401);
        }
        const claveDatos = await gestor.desenvolver(cuenta.claveEnvueltaCodigo, CodigoRecuperacion.normalizar(codigo));
        cuenta.claveEnvueltaPin = await gestor.envolver(claveDatos, pinNuevo);
        cuenta.verificadorPin = await this.derivador.verificadorPin(pinNuevo, cuenta);
        return { cuenta: await this.cuentaRemota(cuenta), claveDatos };
      },
      borrarCuentaConPin: async (token, celular, pin) => {
        this.revisar({ token, celular });
        const cuenta = this.cuentas.get(celular);
        if (this.sesiones.get(token) !== celular || !cuenta) throw new ErrorApiDatos('no_autorizado', 'No.', 401);
        if ((await this.derivador.verificadorPin(pin, cuenta)) !== cuenta.verificadorPin) {
          throw new ErrorApiDatos('credenciales_invalidas', 'No.', 401);
        }
        this.cuentas.delete(celular);
        this.casos.delete(celular);
        this.evidencias.delete(celular);
      },
      cerrarSesion: async (token) => {
        this.revisar({ token });
        this.sesiones.delete(token);
      },
    };
  }

  // --- Casos y evidencias ---

  sincronizacion(obtenerToken: () => string | null): PuertoSincronizacion {
    const celular = () => {
      this.revisar({});
      const c = this.sesiones.get(obtenerToken() ?? '');
      if (!c) throw new ErrorApiDatos('no_autorizado', 'No.', 401);
      return c;
    };
    const casosDe = (c: string) => this.casos.get(c) ?? this.casos.set(c, new Map()).get(c)!;
    const evidenciasDe = (c: string) => this.evidencias.get(c) ?? this.evidencias.set(c, new Map()).get(c)!;
    const escribir = (c: string, nuevo: CasoRemoto): ResultadoEscrituraRemota<CasoRemoto> => {
      const actual = casosDe(c).get(nuevo.id);
      if (actual && Date.parse(actual.actualizadoEn) >= Date.parse(nuevo.actualizadoEn)) return { aplicado: false, actual };
      casosDe(c).set(nuevo.id, nuevo);
      if (nuevo.borrado) for (const [id, e] of evidenciasDe(c)) if (e.casoId === nuevo.id) evidenciasDe(c).delete(id);
      return { aplicado: true, actual: nuevo };
    };
    const meta = ({ datos: _d, ...m }: EvidenciaDescargada): MetadatosEvidenciaRemota => m;
    return {
      listarCasos: async () => ({ casos: [...casosDe(celular()).values()], ahora: new Date().toISOString() }),
      subirCaso: async (caso) => {
        const c = celular();
        this.recibido.push(JSON.stringify(caso));
        return escribir(c, { ...caso, borrado: false });
      },
      borrarCaso: async (id, actualizadoEn) => escribir(celular(), { id, iv: '', datos: '', actualizadoEn, borrado: true }),
      listarEvidencias: async () => [...evidenciasDe(celular()).values()].map(meta),
      bajarEvidencia: async (id) => evidenciasDe(celular()).get(id) ?? null,
      subirEvidencia: async (e, datos) => {
        const c = celular();
        if (!casosDe(c).has(e.casoId)) throw new ErrorApiDatos('caso_no_encontrado', 'No.', 404);
        const bytes = datos instanceof Uint8Array ? new Uint8Array(datos) : new Uint8Array(datos.slice(0));
        this.recibido.push(CodificacionBase64.codificar(bytes));
        const guardada: EvidenciaDescargada = {
          id: e.id,
          casoId: e.casoId,
          iv: typeof e.iv === 'string' ? e.iv : CodificacionBase64.codificar(e.iv),
          mime: e.mime,
          tamano: bytes.byteLength,
          actualizadoEn: e.actualizadoEn,
          datos: bytes,
        };
        evidenciasDe(c).set(e.id, guardada);
        return { aplicado: true, actual: meta(guardada) };
      },
      borrarEvidencia: async (id) => evidenciasDe(celular()).delete(id),
    };
  }

  private revisar(peticion: unknown): void {
    if (!this.enLinea) throw new ErrorApiDatos('sin_conexion', 'Necesitas internet para esto.');
    this.recibido.push(JSON.stringify(peticion));
  }

  private abrirSesion(celular: string): SesionRemota {
    const token = `token-${++this.siguienteToken}-${CodificacionBase64.codificar(this.crypto.getRandomValues(new Uint8Array(8)))}`;
    this.sesiones.set(token, celular);
    return { token, expiraEn: new Date(Date.now() + 3_600_000).toISOString() };
  }

  private async cuentaRemota(cuenta: CuentaGuardada): Promise<CuentaRemota> {
    return {
      ...this.abrirSesion(cuenta.celular),
      claveEnvueltaPin: cuenta.claveEnvueltaPin,
      claveEnvueltaCodigo: cuenta.claveEnvueltaCodigo,
      perfilCifrado: cuenta.perfilCifrado,
    };
  }
}
