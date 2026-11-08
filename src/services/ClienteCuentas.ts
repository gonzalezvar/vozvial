import { CodigoRecuperacion } from '../core/CodigoRecuperacion';
import { DerivadorVerificador, type ParametrosAutenticacion } from '../core/DerivadorVerificador';
import type { ClaveEnvuelta, DatosCifrados, GestorClaves } from '../core/GestorClaves';
import { ValidadorRegistro } from '../core/ValidadorRegistro';
import { ClienteApiBase, ErrorApiDatos, type OpcionesApi } from './PeticionApi';

export interface SesionRemota {
  token: string;
  /** ISO 8601. */
  expiraEn: string;
}

/** Respuesta de entrar o recuperar: la sesion y lo necesario para abrir los datos en este dispositivo. */
export interface CuentaRemota extends SesionRemota {
  claveEnvueltaPin: ClaveEnvuelta;
  claveEnvueltaCodigo: ClaveEnvuelta;
  perfilCifrado: DatosCifrados;
}

export interface SolicitudRegistro {
  celular: string;
  salAuth: string;
  iteraciones: number;
  verificadorPin: string;
  verificadorCodigo: string;
  claveEnvueltaPin: ClaveEnvuelta;
  claveEnvueltaCodigo: ClaveEnvuelta;
  /** { nombre, celular } cifrado con la clave de datos: el servidor nunca ve el nombre. */
  perfilCifrado: DatosCifrados;
}

export interface DatosRegistroConSecretos {
  celular: string;
  pin: string;
  /** Codigo de recuperacion en claro (con o sin guiones). */
  codigo: string;
  claveEnvueltaPin: ClaveEnvuelta;
  claveEnvueltaCodigo: ClaveEnvuelta;
  perfilCifrado: DatosCifrados;
  /** Por defecto las mismas de la envoltura del PIN. */
  iteraciones?: number;
}

export interface OpcionesClienteCuentas extends OpcionesApi {
  crypto?: Crypto;
}

/**
 * Cliente de /api/cuentas, /api/sesiones, /api/recuperacion y /api/cuenta (docs/bd.md).
 * Al servidor solo viajan el celular, verificadores PBKDF2 y material ya cifrado:
 * nunca el PIN, el codigo, el nombre ni la clave de datos.
 */
export class ClienteCuentas extends ClienteApiBase {
  private readonly derivador: DerivadorVerificador;

  constructor(opciones: OpcionesClienteCuentas = {}) {
    super(opciones);
    this.derivador = new DerivadorVerificador(opciones.crypto ?? globalThis.crypto);
  }

  // --- Llamadas directas al API ---

  /** Para un celular sin cuenta el servidor devuelve una sal falsa estable: no revela si existe. */
  async parametros(celular: string): Promise<ParametrosAutenticacion> {
    const limpio = ValidadorRegistro.normalizarCelular(celular);
    const datos = await this.peticionJson<unknown>({
      metodo: 'GET',
      ruta: `/api/cuentas/parametros?celular=${encodeURIComponent(limpio)}`,
    });
    if (!DerivadorVerificador.esParametros(datos)) {
      throw new ErrorApiDatos('servidor', 'No pudimos leer la respuesta. Intenta de nuevo.');
    }
    return { salAuth: datos.salAuth, iteraciones: datos.iteraciones };
  }

  /** Lanza ErrorApiDatos('ya_existe') si el celular ya tiene cuenta. */
  registrar(solicitud: SolicitudRegistro): Promise<SesionRemota> {
    return this.peticionJson<SesionRemota>({
      metodo: 'POST',
      ruta: '/api/cuentas',
      json: { ...solicitud, celular: ValidadorRegistro.normalizarCelular(solicitud.celular) },
    });
  }

  /** Lanza 'credenciales_invalidas' (con intentosRestantes) o 'bloqueada' (con msRestantes). */
  entrar(celular: string, verificador: string): Promise<CuentaRemota> {
    return this.peticionJson<CuentaRemota>({
      metodo: 'POST',
      ruta: '/api/sesiones',
      json: { celular: ValidadorRegistro.normalizarCelular(celular), verificador },
    });
  }

  /** Paso 1 de la recuperacion: la clave de datos envuelta con el codigo. Lanza 'codigo_invalido'. */
  claveRecuperacion(celular: string, verificadorCodigo: string): Promise<{ claveEnvueltaCodigo: ClaveEnvuelta; perfilCifrado: DatosCifrados }> {
    return this.peticionJson({
      metodo: 'POST',
      ruta: '/api/recuperacion/clave',
      json: { celular: ValidadorRegistro.normalizarCelular(celular), verificadorCodigo },
    });
  }

  /** Paso 2: guarda el PIN nuevo (verificador y envoltura). Cierra las otras sesiones de la cuenta. */
  recuperar(datos: {
    celular: string;
    verificadorCodigo: string;
    verificadorPin: string;
    claveEnvueltaPin: ClaveEnvuelta;
  }): Promise<CuentaRemota> {
    return this.peticionJson<CuentaRemota>({
      metodo: 'POST',
      ruta: '/api/recuperacion',
      json: { ...datos, celular: ValidadorRegistro.normalizarCelular(datos.celular) },
    });
  }

  async cerrarSesion(token: string): Promise<void> {
    await this.peticion({ metodo: 'DELETE', ruta: '/api/sesiones', token });
  }

  /** Borra cuenta, casos y evidencias del servidor. Exige el verificador del PIN. */
  async borrarCuenta(token: string, verificadorPin: string): Promise<void> {
    await this.peticion({ metodo: 'DELETE', ruta: '/api/cuenta', token, json: { verificadorPin } });
  }

  // --- Flujos completos con el PIN o el codigo (derivan los verificadores aqui) ---

  /** Registra en el servidor una cuenta ya creada en el dispositivo (ServicioCuenta.crearCuenta). */
  async registrarConSecretos(datos: DatosRegistroConSecretos): Promise<SesionRemota> {
    const parametros = this.derivador.nuevosParametros(datos.iteraciones ?? datos.claveEnvueltaPin.iteraciones);
    const [verificadorPin, verificadorCodigo] = await Promise.all([
      this.derivador.verificadorPin(datos.pin, parametros),
      this.derivador.verificadorCodigo(datos.codigo, parametros),
    ]);
    return this.registrar({
      celular: datos.celular,
      salAuth: parametros.salAuth,
      iteraciones: parametros.iteraciones,
      verificadorPin,
      verificadorCodigo,
      claveEnvueltaPin: datos.claveEnvueltaPin,
      claveEnvueltaCodigo: datos.claveEnvueltaCodigo,
      perfilCifrado: datos.perfilCifrado,
    });
  }

  /** Pide los parametros, deriva el verificador del PIN y entra. */
  async entrarConPin(celular: string, pin: string): Promise<CuentaRemota> {
    const parametros = await this.parametros(celular);
    return this.entrar(celular, await this.derivador.verificadorPin(pin, parametros));
  }

  /**
   * Recuperacion completa en un dispositivo nuevo: abre la clave de datos con el codigo,
   * la envuelve con el PIN nuevo y la registra. Devuelve la cuenta y la clave de datos abierta.
   * Lanza ErrorClave('secreto_incorrecto') si el codigo no abre la clave (no deberia pasar si el servidor lo acepto).
   */
  async recuperarConCodigo(
    celular: string,
    codigo: string,
    pinNuevo: string,
    gestor: GestorClaves,
  ): Promise<{ cuenta: CuentaRemota; claveDatos: CryptoKey }> {
    const parametros = await this.parametros(celular);
    const verificadorCodigo = await this.derivador.verificadorCodigo(codigo, parametros);
    const { claveEnvueltaCodigo } = await this.claveRecuperacion(celular, verificadorCodigo);
    const claveDatos = await gestor.desenvolver(claveEnvueltaCodigo, CodigoRecuperacion.normalizar(codigo));
    const [claveEnvueltaPin, verificadorPin] = await Promise.all([
      gestor.envolver(claveDatos, pinNuevo),
      this.derivador.verificadorPin(pinNuevo, parametros),
    ]);
    const cuenta = await this.recuperar({ celular, verificadorCodigo, verificadorPin, claveEnvueltaPin });
    return { cuenta, claveDatos };
  }

  /** Pide los parametros y borra la cuenta del servidor con el PIN. */
  async borrarCuentaConPin(token: string, celular: string, pin: string): Promise<void> {
    const parametros = await this.parametros(celular);
    await this.borrarCuenta(token, await this.derivador.verificadorPin(pin, parametros));
  }
}
