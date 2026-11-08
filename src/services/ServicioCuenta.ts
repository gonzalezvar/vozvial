import { CodigoRecuperacion } from '../core/CodigoRecuperacion';
import { ControlIntentos, type EstadoIntentos } from '../core/ControlIntentos';
import { ErrorClave } from '../core/ErrorClave';
import { GestorClaves } from '../core/GestorClaves';
import { ServicioCredenciales } from '../core/ServicioCredenciales';
import { ValidadorRegistro, type ErrorRegistro } from '../core/ValidadorRegistro';
import type { AlmacenCifrado, RegistroCuenta } from './AlmacenCifrado';

export interface Perfil {
  nombre: string;
  celular: string;
}

export interface DatosNuevaCuenta {
  nombre: string;
  celular: string;
  pin: string;
}

export interface CuentaCreada {
  /** Codigo formateado en grupos de 4 ("ABCD-EFGH-JKMN"). Solo se muestra una vez. */
  codigoRecuperacion: string;
  claveDatos: CryptoKey;
  perfil: Perfil;
}

export type ResultadoEntrar =
  | { ok: true; perfil: Perfil; claveDatos: CryptoKey }
  | { ok: false; bloqueado: false; intentosRestantes: number }
  | { ok: false; bloqueado: true; msRestantes: number };

export type ResultadoRecuperar =
  | { ok: true; perfil: Perfil; claveDatos: CryptoKey }
  | { ok: false; error: 'sin_cuenta' | 'codigo_invalido' | 'codigo_incorrecto' | 'pin_invalido'; mensaje: string };

export class ErrorCuenta extends Error {
  constructor(
    readonly motivo: 'ya_existe' | 'sin_cuenta' | 'datos_invalidos' | 'pin_incorrecto',
    mensaje: string,
    readonly errores: ErrorRegistro[] = [],
  ) {
    super(mensaje);
    this.name = 'ErrorCuenta';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface OpcionesServicioCuenta {
  crypto: Crypto;
  iteraciones?: number;
  bloqueoMs?: number;
  reloj?: () => Date;
}

/**
 * Cuenta local de HU-01 a HU-03. El PIN solo se guarda como hash PBKDF2 y la clave de datos
 * queda envuelta dos veces: con el PIN y con el codigo de recuperacion.
 */
export class ServicioCuenta {
  private readonly crypto: Crypto;
  private readonly gestor: GestorClaves;
  private readonly credenciales: ServicioCredenciales;
  private readonly bloqueoMs: number | undefined;
  private readonly reloj: (() => Date) | undefined;

  constructor(
    private readonly almacen: AlmacenCifrado,
    opciones: OpcionesServicioCuenta,
  ) {
    this.crypto = opciones.crypto;
    this.gestor = new GestorClaves(opciones.crypto, { iteraciones: opciones.iteraciones });
    this.credenciales = new ServicioCredenciales(opciones.crypto, { iteraciones: opciones.iteraciones });
    this.bloqueoMs = opciones.bloqueoMs;
    this.reloj = opciones.reloj;
  }

  async existeCuenta(): Promise<boolean> {
    return (await this.almacen.leerCuenta()) !== null;
  }

  /** Lanza ErrorCuenta('datos_invalidos') con los errores del validador o 'ya_existe'. */
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
    await this.almacen.guardarCuenta({
      credencial,
      claveEnvueltaPin,
      claveEnvueltaRecuperacion,
      controlIntentos: this.nuevoControl().serializar(),
      perfilCifrado,
    });
    return { codigoRecuperacion: CodigoRecuperacion.formatear(codigo), claveDatos, perfil };
  }

  /** Estado del bloqueo sin intentar entrar, para mostrar el contador al abrir la pantalla. */
  async estadoIntentos(): Promise<EstadoIntentos | null> {
    const cuenta = await this.almacen.leerCuenta();
    return cuenta ? this.controlDe(cuenta).estado() : null;
  }

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
   * CA-03.1: abre la clave de datos con el codigo y la envuelve con el PIN nuevo.
   * La clave de datos no cambia, asi que los casos guardados se siguen abriendo.
   */
  async recuperar(codigo: string, pinNuevo: string): Promise<ResultadoRecuperar> {
    const cuenta = await this.almacen.leerCuenta();
    if (!cuenta) return { ok: false, error: 'sin_cuenta', mensaje: 'No hay una cuenta en este dispositivo.' };
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

    let claveDatos: CryptoKey;
    try {
      claveDatos = await this.gestor.desenvolver(
        cuenta.claveEnvueltaRecuperacion,
        CodigoRecuperacion.normalizar(codigo),
      );
    } catch (error) {
      if (error instanceof ErrorClave) {
        return { ok: false, error: 'codigo_incorrecto', mensaje: 'El código no es correcto. Revísalo letra por letra.' };
      }
      throw error;
    }
    const [credencial, claveEnvueltaPin] = await Promise.all([
      this.credenciales.crearCredencial(pinNuevo),
      this.gestor.envolver(claveDatos, pinNuevo),
    ]);
    const perfil = await this.leerPerfil(claveDatos, cuenta);
    await this.almacen.guardarCuenta({
      ...cuenta,
      credencial,
      claveEnvueltaPin,
      controlIntentos: this.nuevoControl().serializar(),
    });
    return { ok: true, perfil, claveDatos };
  }

  /** Borra cuenta, casos y evidencias. Exige el PIN para que nadie lo haga por accidente. */
  async borrarTodo(pin: string): Promise<void> {
    const cuenta = await this.leerCuentaObligatoria();
    if (!(await this.credenciales.verificar(pin, cuenta.credencial))) {
      throw new ErrorCuenta('pin_incorrecto', 'El PIN no es correcto.');
    }
    await this.almacen.borrarTodo();
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
