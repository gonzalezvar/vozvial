import { CodigoRecuperacion } from '../core/CodigoRecuperacion';
import { ControlIntentos, type EstadoIntentos } from '../core/ControlIntentos';
import { DerivadorVerificador } from '../core/DerivadorVerificador';
import { ErrorClave } from '../core/ErrorClave';
import { GestorClaves } from '../core/GestorClaves';
import { ServicioCredenciales } from '../core/ServicioCredenciales';
import { ValidadorRegistro, type ErrorRegistro } from '../core/ValidadorRegistro';
import type { AlmacenCifrado, CuentaServidor, EstadoCuentaServidor, RegistroCuenta } from './AlmacenCifrado';
import type { CuentaRemota, SesionRemota, SolicitudRegistro } from './ClienteCuentas';
import { ErrorApiDatos, type CausaErrorApi } from './PeticionApi';

export interface Perfil {
  nombre: string;
  celular: string;
}

export interface DatosNuevaCuenta {
  nombre: string;
  celular: string;
  pin: string;
}

/** Donde quedo la cuenta al crearla. */
export type RespaldoCuenta = 'servidor' | 'pendiente' | 'solo_local';

export interface CuentaCreada {
  /** Codigo formateado en grupos de 4 ("ABCD-EFGH-JKMN"). Solo se muestra una vez. */
  codigoRecuperacion: string;
  claveDatos: CryptoKey;
  perfil: Perfil;
  /** Sesion con el servidor si la cuenta se registro alli. */
  sesion: SesionRemota | null;
  respaldo: RespaldoCuenta;
}

export type ResultadoEntrar =
  | { ok: true; perfil: Perfil; claveDatos: CryptoKey }
  | { ok: false; bloqueado: false; intentosRestantes: number }
  | { ok: false; bloqueado: true; msRestantes: number };

/** Entrar en un dispositivo sin cuenta guardada, con celular y PIN contra el servidor. */
export type ResultadoEntrarConCelular =
  | { ok: true; perfil: Perfil; claveDatos: CryptoKey; sesion: SesionRemota }
  | { ok: false; motivo: 'credenciales'; intentosRestantes: number | null; mensaje: string }
  | { ok: false; motivo: 'bloqueada'; msRestantes: number; mensaje: string }
  | { ok: false; motivo: 'celular_invalido' | 'sin_conexion' | 'servidor'; mensaje: string };

export type ErrorRecuperar =
  | 'sin_cuenta'
  | 'codigo_invalido'
  | 'codigo_incorrecto'
  | 'pin_invalido'
  | 'celular_invalido'
  | 'sin_conexion'
  | 'bloqueada'
  | 'servidor';

export type ResultadoRecuperar =
  | { ok: true; perfil: Perfil; claveDatos: CryptoKey; sesion: SesionRemota | null; aviso: string | null }
  | { ok: false; error: ErrorRecuperar; mensaje: string };

/** Resultado de abrir la sesion con el servidor despues de entrar con el PIN en el dispositivo. */
export interface ResultadoConexion {
  sesion: SesionRemota | null;
  estado: EstadoCuentaServidor | 'solo_local';
  /** Explicacion sencilla cuando no hay sesion con el servidor. */
  mensaje: string | null;
}

export type EstadoServidorCuenta = EstadoCuentaServidor | 'solo_local';

export class ErrorCuenta extends Error {
  constructor(
    readonly motivo: 'ya_existe' | 'celular_en_uso' | 'sin_cuenta' | 'datos_invalidos' | 'pin_incorrecto' | 'servidor_no_disponible',
    mensaje: string,
    readonly errores: ErrorRegistro[] = [],
  ) {
    super(mensaje);
    this.name = 'ErrorCuenta';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Lo que ServicioCuenta usa de ClienteCuentas. Las pruebas unitarias pasan uno falso. */
export interface PuertoCuentasRemotas {
  registrar(solicitud: SolicitudRegistro): Promise<SesionRemota>;
  entrarConPin(celular: string, pin: string): Promise<CuentaRemota>;
  recuperarConCodigo(
    celular: string,
    codigo: string,
    pinNuevo: string,
    gestor: GestorClaves,
  ): Promise<{ cuenta: CuentaRemota; claveDatos: CryptoKey }>;
  borrarCuentaConPin(token: string, celular: string, pin: string): Promise<void>;
  cerrarSesion(token: string): Promise<void>;
}

export interface OpcionesServicioCuenta {
  crypto: Crypto;
  iteraciones?: number;
  bloqueoMs?: number;
  reloj?: () => Date;
  /** Sin remoto la cuenta vive solo en el dispositivo (como en el prototipo). */
  remoto?: PuertoCuentasRemotas;
}

/** Errores de red o del servidor que no dicen nada de la cuenta: se puede seguir en el dispositivo. */
const CAUSAS_SIN_SERVIDOR = new Set<CausaErrorApi>([
  'sin_conexion',
  'tiempo_agotado',
  'bd_no_disponible',
  'servidor',
  'limite_peticiones',
]);

const MENSAJE_SIN_CONEXION = 'Necesitas internet para esto. Revisa tu conexión e intenta de nuevo.';

function causaDe(error: unknown): CausaErrorApi | null {
  return error instanceof ErrorApiDatos ? error.causa : null;
}

/**
 * Cuenta de HU-01 a HU-03, en el dispositivo y en el servidor. El PIN solo se guarda como hash
 * PBKDF2 y la clave de datos queda envuelta dos veces: con el PIN y con el codigo de recuperacion.
 * Al servidor viajan el celular, verificadores PBKDF2 distintos de esas claves y material ya
 * cifrado (ClienteCuentas); nunca el PIN, el codigo, el nombre ni la clave de datos.
 */
export class ServicioCuenta {
  private readonly crypto: Crypto;
  private readonly gestor: GestorClaves;
  private readonly credenciales: ServicioCredenciales;
  private readonly derivador: DerivadorVerificador;
  private readonly bloqueoMs: number | undefined;
  private readonly reloj: (() => Date) | undefined;
  private readonly remoto: PuertoCuentasRemotas | null;

  constructor(
    private readonly almacen: AlmacenCifrado,
    opciones: OpcionesServicioCuenta,
  ) {
    this.crypto = opciones.crypto;
    this.gestor = new GestorClaves(opciones.crypto, { iteraciones: opciones.iteraciones });
    this.credenciales = new ServicioCredenciales(opciones.crypto, { iteraciones: opciones.iteraciones });
    this.derivador = new DerivadorVerificador(opciones.crypto);
    this.bloqueoMs = opciones.bloqueoMs;
    this.reloj = opciones.reloj;
    this.remoto = opciones.remoto ?? null;
  }

  /** El gestor de claves que usa la cuenta (lo necesita el sincronizador para descifrar casos). */
  get gestorClaves(): GestorClaves {
    return this.gestor;
  }

  async existeCuenta(): Promise<boolean> {
    return (await this.almacen.leerCuenta()) !== null;
  }

  async estadoServidor(): Promise<EstadoServidorCuenta | null> {
    const cuenta = await this.almacen.leerCuenta();
    if (!cuenta) return null;
    return cuenta.servidor?.estado ?? 'solo_local';
  }

  /**
   * Crea la cuenta en el servidor y en el dispositivo. Si el celular ya tiene cuenta en el servidor
   * lanza ErrorCuenta('celular_en_uso') y no guarda nada. Sin conexion la crea en el dispositivo
   * y la deja pendiente para registrarla al entrar con internet.
   * Lanza ErrorCuenta('datos_invalidos') con los errores del validador o 'ya_existe'.
   */
  async crearCuenta(datos: DatosNuevaCuenta): Promise<CuentaCreada> {
    const validacion = ValidadorRegistro.validar({
      nombre: datos.nombre,
      celular: datos.celular,
      pin: datos.pin,
      confirmacionPin: datos.pin,
      autorizaDatos: true,
    });
    if (!validacion.valido) {
      throw new ErrorCuenta('datos_invalidos', 'Los datos de la cuenta no son válidos.', validacion.errores);
    }
    if (await this.existeCuenta()) throw new ErrorCuenta('ya_existe', 'Ya hay una cuenta en este dispositivo.');

    const perfil: Perfil = {
      nombre: datos.nombre.trim(),
      celular: ValidadorRegistro.normalizarCelular(datos.celular),
    };
    const codigo = CodigoRecuperacion.generar(this.crypto);
    const claveDatos = await this.gestor.generarClaveDatos();
    const [credencial, claveEnvueltaPin, claveEnvueltaRecuperacion, perfilCifrado] = await Promise.all([
      this.credenciales.crearCredencial(datos.pin),
      this.gestor.envolver(claveDatos, datos.pin),
      this.gestor.envolver(claveDatos, codigo),
      this.gestor.cifrar(claveDatos, JSON.stringify(perfil)),
    ]);

    let sesion: SesionRemota | null = null;
    let servidor: CuentaServidor | undefined;
    let respaldo: RespaldoCuenta = 'solo_local';
    if (this.remoto) {
      const parametros = this.derivador.nuevosParametros(claveEnvueltaPin.iteraciones);
      const [verificadorPin, verificadorCodigo] = await Promise.all([
        this.derivador.verificadorPin(datos.pin, parametros),
        this.derivador.verificadorCodigo(codigo, parametros),
      ]);
      try {
        sesion = await this.remoto.registrar({
          celular: perfil.celular,
          salAuth: parametros.salAuth,
          iteraciones: parametros.iteraciones,
          verificadorPin,
          verificadorCodigo,
          claveEnvueltaPin,
          claveEnvueltaCodigo: claveEnvueltaRecuperacion,
          perfilCifrado,
        });
        servidor = { estado: 'registrada' };
        respaldo = 'servidor';
      } catch (error) {
        const causa = causaDe(error);
        if (causa === 'ya_existe') {
          throw new ErrorCuenta('celular_en_uso', 'Ya hay una cuenta con ese celular. Entra con tu celular y tu PIN.');
        }
        if (!causa || !CAUSAS_SIN_SERVIDOR.has(causa)) throw error;
        servidor = { estado: 'pendiente', registroPendiente: { ...parametros, verificadorCodigo } };
        respaldo = 'pendiente';
      }
    }

    await this.almacen.guardarCuenta({
      credencial,
      claveEnvueltaPin,
      claveEnvueltaRecuperacion,
      controlIntentos: this.nuevoControl().serializar(),
      perfilCifrado,
      ...(servidor ? { servidor } : {}),
    });
    return { codigoRecuperacion: CodigoRecuperacion.formatear(codigo), claveDatos, perfil, sesion, respaldo };
  }

  /** Estado del bloqueo sin intentar entrar, para mostrar el contador al abrir la pantalla. */
  async estadoIntentos(): Promise<EstadoIntentos | null> {
    const cuenta = await this.almacen.leerCuenta();
    return cuenta ? this.controlDe(cuenta).estado() : null;
  }

  /** Entrar con el PIN en un dispositivo que ya tiene la cuenta. Funciona sin internet. */
  async entrar(pin: string): Promise<ResultadoEntrar> {
    const cuenta = await this.leerCuentaObligatoria();
    const control = this.controlDe(cuenta);
    const antes = control.estado();
    if (antes.bloqueado) return { ok: false, bloqueado: true, msRestantes: antes.msRestantes };

    if (!(await this.credenciales.verificar(pin, cuenta.credencial))) {
      const estado = control.registrarFallo();
      await this.almacen.guardarCuenta({ ...cuenta, controlIntentos: control.serializar() });
      return estado.bloqueado
        ? { ok: false, bloqueado: true, msRestantes: estado.msRestantes }
        : { ok: false, bloqueado: false, intentosRestantes: estado.intentosRestantes };
    }

    const claveDatos = await this.gestor.desenvolver(cuenta.claveEnvueltaPin, pin);
    const perfil = await this.leerPerfil(claveDatos, cuenta);
    control.registrarExito();
    await this.almacen.guardarCuenta({ ...cuenta, controlIntentos: control.serializar() });
    return { ok: true, perfil, claveDatos };
  }

  /**
   * Despues de entrar en el dispositivo: abre la sesion con el servidor para sincronizar.
   * Si la cuenta quedo pendiente al crearla sin internet, aqui se registra. Nunca lanza:
   * sin servidor la app sigue funcionando con la copia del dispositivo.
   */
  async conectarServidor(pin: string, perfil: Perfil): Promise<ResultadoConexion> {
    const cuenta = await this.almacen.leerCuenta();
    const estado = cuenta?.servidor?.estado ?? 'solo_local';
    if (!cuenta || !this.remoto) return { sesion: null, estado, mensaje: null };

    try {
      if (estado === 'registrada') {
        const remota = await this.remoto.entrarConPin(perfil.celular, pin);
        return { sesion: { token: remota.token, expiraEn: remota.expiraEn }, estado, mensaje: null };
      }
      if (estado === 'pendiente' && cuenta.servidor?.registroPendiente) {
        const pendiente = cuenta.servidor.registroPendiente;
        const parametros = { salAuth: pendiente.salAuth, iteraciones: pendiente.iteraciones };
        const sesion = await this.remoto.registrar({
          celular: perfil.celular,
          ...parametros,
          verificadorPin: await this.derivador.verificadorPin(pin, parametros),
          verificadorCodigo: pendiente.verificadorCodigo,
          claveEnvueltaPin: cuenta.claveEnvueltaPin,
          claveEnvueltaCodigo: cuenta.claveEnvueltaRecuperacion,
          perfilCifrado: cuenta.perfilCifrado,
        });
        await this.cambiarServidor({ estado: 'registrada' });
        return { sesion, estado: 'registrada', mensaje: null };
      }
    } catch (error) {
      const causa = causaDe(error);
      if (estado === 'pendiente' && causa === 'ya_existe') {
        await this.cambiarServidor({ estado: 'celular_en_uso' });
        return { sesion: null, estado: 'celular_en_uso', mensaje: MENSAJES_ESTADO.celular_en_uso ?? null };
      }
      if (estado === 'registrada' && causa === 'credenciales_invalidas') {
        // El PIN del dispositivo ya no es el del servidor: se cambio en otro dispositivo.
        await this.cambiarServidor({ estado: 'pin_distinto' });
        return { sesion: null, estado: 'pin_distinto', mensaje: MENSAJES_ESTADO.pin_distinto ?? null };
      }
      if (causa === 'bloqueada') {
        return { sesion: null, estado, mensaje: 'Por seguridad, la copia del servidor está en pausa unos minutos.' };
      }
      return { sesion: null, estado, mensaje: 'Sin conexión con el servidor. Tus casos siguen en este celular.' };
    }
    return { sesion: null, estado, mensaje: MENSAJES_ESTADO[estado] ?? null };
  }

  /**
   * Entrar en un dispositivo sin cuenta guardada (otro celular o un navegador nuevo): el servidor
   * devuelve la clave de datos envuelta con el PIN y el perfil cifrado, y se abren aqui.
   * La cuenta queda guardada en el dispositivo para entrar despues solo con el PIN.
   */
  async entrarConCelular(celular: string, pin: string): Promise<ResultadoEntrarConCelular> {
    const limpio = ValidadorRegistro.normalizarCelular(celular);
    if (!/^3\d{9}$/.test(limpio)) {
      return { ok: false, motivo: 'celular_invalido', mensaje: 'Escribe tu celular de 10 dígitos, por ejemplo 3001234567' };
    }
    if (!this.remoto) return { ok: false, motivo: 'servidor', mensaje: 'No hay una cuenta en este celular.' };
    if (await this.existeCuenta()) throw new ErrorCuenta('ya_existe', 'Ya hay una cuenta en este dispositivo.');

    let remota: CuentaRemota;
    try {
      remota = await this.remoto.entrarConPin(limpio, pin);
    } catch (error) {
      return ServicioCuenta.errorEntrar(error);
    }
    const claveDatos = await this.gestor.desenvolver(remota.claveEnvueltaPin, pin);
    const perfil = JSON.parse(await this.gestor.descifrarTexto(claveDatos, remota.perfilCifrado)) as Perfil;
    await this.guardarCuentaDesdeServidor(remota, pin);
    return { ok: true, perfil, claveDatos, sesion: { token: remota.token, expiraEn: remota.expiraEn } };
  }

  /**
   * CA-03.1: abre la clave de datos con el codigo y la envuelve con el PIN nuevo.
   * La clave de datos no cambia, asi que los casos guardados se siguen abriendo.
   * Con cuenta en el dispositivo funciona sin internet y, si hay conexion, cambia tambien el PIN
   * del servidor. Sin cuenta en el dispositivo hace falta el celular y la recuperacion es en el servidor.
   */
  async recuperar(codigo: string, pinNuevo: string, celular?: string): Promise<ResultadoRecuperar> {
    const cuenta = await this.almacen.leerCuenta();
    if (!cuenta && (!this.remoto || celular === undefined)) {
      return { ok: false, error: 'sin_cuenta', mensaje: 'No hay una cuenta en este dispositivo.' };
    }
    if (!CodigoRecuperacion.esValido(codigo)) {
      return { ok: false, error: 'codigo_invalido', mensaje: 'El código tiene 12 letras y números. Revísalo.' };
    }
    const errorPin = ValidadorRegistro.validar({
      nombre: 'xx',
      celular: '3000000000',
      pin: pinNuevo,
      confirmacionPin: pinNuevo,
      autorizaDatos: true,
    }).errores.find((e) => e.campo === 'pin');
    if (errorPin) return { ok: false, error: 'pin_invalido', mensaje: errorPin.mensaje };

    return cuenta ? this.recuperarEnDispositivo(cuenta, codigo, pinNuevo) : this.recuperarDesdeServidor(celular ?? '', codigo, pinNuevo);
  }

  /**
   * Borra cuenta, casos y evidencias del servidor y del dispositivo. Exige el PIN para que nadie
   * lo haga por accidente. Si la cuenta esta en el servidor y no se puede borrar alli, no borra
   * nada del dispositivo y lanza ErrorCuenta('servidor_no_disponible').
   */
  async borrarTodo(pin: string, token: string | null = null): Promise<void> {
    const cuenta = await this.leerCuentaObligatoria();
    if (!(await this.credenciales.verificar(pin, cuenta.credencial))) {
      throw new ErrorCuenta('pin_incorrecto', 'El PIN no es correcto.');
    }
    if (this.remoto && cuenta.servidor && cuenta.servidor.estado !== 'pendiente' && cuenta.servidor.estado !== 'celular_en_uso') {
      const claveDatos = await this.gestor.desenvolver(cuenta.claveEnvueltaPin, pin);
      const { celular } = await this.leerPerfil(claveDatos, cuenta);
      try {
        const sesion = token ?? (await this.remoto.entrarConPin(celular, pin)).token;
        await this.remoto.borrarCuentaConPin(sesion, celular, pin);
      } catch (error) {
        const causa = causaDe(error);
        if (cuenta.servidor.estado === 'pin_distinto' && causa === 'credenciales_invalidas') {
          throw new ErrorCuenta(
            'servidor_no_disponible',
            'Tu copia en el servidor tiene otro PIN. Entra con ese PIN, o usa "Olvidé mi PIN", y vuelve a intentarlo.',
          );
        }
        throw new ErrorCuenta(
          'servidor_no_disponible',
          'No pudimos borrar tu copia en el servidor. Revisa tu internet e intenta de nuevo. No se borró nada.',
        );
      }
    }
    await this.almacen.borrarTodo();
  }

  /** Cierra la sesion del servidor. Si no hay conexion no pasa nada: la sesion vence sola. */
  async cerrarSesionServidor(token: string): Promise<void> {
    try {
      await this.remoto?.cerrarSesion(token);
    } catch {
      // Sin conexion el token vence solo en el servidor.
    }
  }

  // --- Interno ---

  private async recuperarEnDispositivo(cuenta: RegistroCuenta, codigo: string, pinNuevo: string): Promise<ResultadoRecuperar> {
    let claveDatos: CryptoKey;
    try {
      claveDatos = await this.gestor.desenvolver(cuenta.claveEnvueltaRecuperacion, CodigoRecuperacion.normalizar(codigo));
    } catch (error) {
      if (error instanceof ErrorClave) {
        return { ok: false, error: 'codigo_incorrecto', mensaje: 'El código no es correcto. Revísalo letra por letra.' };
      }
      throw error;
    }
    const perfil = await this.leerPerfil(claveDatos, cuenta);

    let sesion: SesionRemota | null = null;
    let aviso: string | null = null;
    let servidor = cuenta.servidor;
    const enServidor = servidor?.estado === 'registrada' || servidor?.estado === 'pin_distinto';
    if (this.remoto && enServidor) {
      try {
        const r = await this.remoto.recuperarConCodigo(perfil.celular, codigo, pinNuevo, this.gestor);
        sesion = { token: r.cuenta.token, expiraEn: r.cuenta.expiraEn };
        servidor = { estado: 'registrada' };
      } catch {
        // El PIN nuevo vale en este dispositivo; el servidor sigue con el anterior hasta repetir con internet.
        servidor = { estado: 'pin_distinto' };
        aviso =
          'Tu PIN nuevo ya vale en este celular. Para usarlo también en otros, repite este paso cuando tengas internet.';
      }
    }

    const [credencial, claveEnvueltaPin] = await Promise.all([
      this.credenciales.crearCredencial(pinNuevo),
      this.gestor.envolver(claveDatos, pinNuevo),
    ]);
    await this.almacen.guardarCuenta({
      ...cuenta,
      credencial,
      claveEnvueltaPin,
      controlIntentos: this.nuevoControl().serializar(),
      ...(servidor ? { servidor } : {}),
    });
    return { ok: true, perfil, claveDatos, sesion, aviso };
  }

  private async recuperarDesdeServidor(celular: string, codigo: string, pinNuevo: string): Promise<ResultadoRecuperar> {
    const limpio = ValidadorRegistro.normalizarCelular(celular);
    if (!/^3\d{9}$/.test(limpio)) {
      return { ok: false, error: 'celular_invalido', mensaje: 'Escribe tu celular de 10 dígitos, por ejemplo 3001234567' };
    }
    const remoto = this.remoto;
    if (!remoto) return { ok: false, error: 'sin_cuenta', mensaje: 'No hay una cuenta en este dispositivo.' };
    let r: { cuenta: CuentaRemota; claveDatos: CryptoKey };
    try {
      r = await remoto.recuperarConCodigo(limpio, codigo, pinNuevo, this.gestor);
    } catch (error) {
      const causa = causaDe(error);
      if (causa === 'codigo_invalido' || error instanceof ErrorClave) {
        return { ok: false, error: 'codigo_incorrecto', mensaje: 'El celular o el código no son correctos. Revísalos.' };
      }
      if (causa === 'bloqueada' || causa === 'limite_peticiones') {
        return { ok: false, error: 'bloqueada', mensaje: 'Por seguridad, espera unos minutos antes de intentar otra vez.' };
      }
      if (causa === 'sin_conexion' || causa === 'tiempo_agotado') {
        return { ok: false, error: 'sin_conexion', mensaje: MENSAJE_SIN_CONEXION };
      }
      return { ok: false, error: 'servidor', mensaje: 'No pudimos revisar el código. Intenta de nuevo en un momento.' };
    }
    const perfil = JSON.parse(await this.gestor.descifrarTexto(r.claveDatos, r.cuenta.perfilCifrado)) as Perfil;
    await this.guardarCuentaDesdeServidor(r.cuenta, pinNuevo);
    return { ok: true, perfil, claveDatos: r.claveDatos, sesion: { token: r.cuenta.token, expiraEn: r.cuenta.expiraEn }, aviso: null };
  }

  /** Guarda en el dispositivo la cuenta que llego del servidor (todo sigue cifrado como en el registro). */
  private async guardarCuentaDesdeServidor(remota: CuentaRemota, pin: string): Promise<void> {
    await this.almacen.guardarCuenta({
      credencial: await this.credenciales.crearCredencial(pin),
      claveEnvueltaPin: remota.claveEnvueltaPin,
      claveEnvueltaRecuperacion: remota.claveEnvueltaCodigo,
      controlIntentos: this.nuevoControl().serializar(),
      perfilCifrado: remota.perfilCifrado,
      servidor: { estado: 'registrada' },
    });
  }

  private async cambiarServidor(servidor: CuentaServidor): Promise<void> {
    const cuenta = await this.almacen.leerCuenta();
    if (cuenta) await this.almacen.guardarCuenta({ ...cuenta, servidor });
  }

  private static errorEntrar(error: unknown): ResultadoEntrarConCelular {
    if (error instanceof ErrorApiDatos) {
      if (error.causa === 'credenciales_invalidas') {
        const n = error.intentosRestantes;
        const resto = n === null ? '' : ` Te quedan ${n} intento${n === 1 ? '' : 's'}.`;
        return { ok: false, motivo: 'credenciales', intentosRestantes: n, mensaje: `El celular o el PIN no son correctos.${resto}` };
      }
      if (error.causa === 'bloqueada' || error.causa === 'limite_peticiones') {
        return { ok: false, motivo: 'bloqueada', msRestantes: error.msRestantes ?? 60_000, mensaje: error.message };
      }
      if (error.causa === 'sin_conexion' || error.causa === 'tiempo_agotado') {
        return { ok: false, motivo: 'sin_conexion', mensaje: MENSAJE_SIN_CONEXION };
      }
    }
    return { ok: false, motivo: 'servidor', mensaje: 'No pudimos entrar ahora. Intenta de nuevo en un momento.' };
  }

  private async leerCuentaObligatoria(): Promise<RegistroCuenta> {
    const cuenta = await this.almacen.leerCuenta();
    if (!cuenta) throw new ErrorCuenta('sin_cuenta', 'No hay una cuenta en este dispositivo.');
    return cuenta;
  }

  private async leerPerfil(claveDatos: CryptoKey, cuenta: RegistroCuenta): Promise<Perfil> {
    return JSON.parse(await this.gestor.descifrarTexto(claveDatos, cuenta.perfilCifrado)) as Perfil;
  }

  private nuevoControl(): ControlIntentos {
    return new ControlIntentos({ bloqueoMs: this.bloqueoMs, reloj: this.reloj });
  }

  private controlDe(cuenta: RegistroCuenta): ControlIntentos {
    return ControlIntentos.desdeJSON(cuenta.controlIntentos, { bloqueoMs: this.bloqueoMs, reloj: this.reloj });
  }
}

/** Texto sencillo para cada estado sin sesion con el servidor. */
export const MENSAJES_ESTADO: Partial<Record<EstadoServidorCuenta, string>> = {
  pendiente: 'Tu cuenta todavía no tiene copia en el servidor. Se hace sola cuando entres con internet.',
  pin_distinto:
    'Tu copia en el servidor tiene otro PIN. Si lo cambiaste en otro celular, usa "Olvidé mi PIN" aquí con tu código.',
  celular_en_uso: 'Ese celular ya tenía otra cuenta en el servidor. Tus casos solo están en este celular.',
  solo_local: 'Esta cuenta se creó antes de la copia en el servidor. Tus casos solo están en este celular.',
};
