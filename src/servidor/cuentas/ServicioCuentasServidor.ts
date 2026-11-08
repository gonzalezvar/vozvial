import { randomUUID } from 'node:crypto';

import { ControlIntentos, type IntentosSerializados } from '../../core/ControlIntentos';
import type { ParametrosAutenticacion } from '../../core/DerivadorVerificador';
import type { ClaveEnvuelta, DatosCifrados } from '../../core/GestorClaves';
import type { Consultor } from '../bd/conexion';
import { RepositorioCuentas, type CuentaServidor } from '../bd/RepositorioCuentas';
import { RepositorioSesiones } from '../bd/RepositorioSesiones';
import { CriptoServidor } from './CriptoServidor';

export interface SesionEmitida {
  token: string;
  expiraEn: string;
}

/** Lo que el cliente necesita para abrir sus datos en un dispositivo nuevo. Todo va cifrado. */
export interface MaterialCifradoCuenta {
  claveEnvueltaPin: ClaveEnvuelta;
  claveEnvueltaCodigo: ClaveEnvuelta;
  perfilCifrado: DatosCifrados;
}

export interface DatosRegistroServidor extends MaterialCifradoCuenta {
  celular: string;
  salAuth: string;
  iteraciones: number;
  verificadorPin: string;
  verificadorCodigo: string;
}

export type ResultadoRegistro = { ok: true; sesion: SesionEmitida } | { ok: false; error: 'ya_existe' };

export type ResultadoSesion =
  | { ok: true; sesion: SesionEmitida; cuenta: MaterialCifradoCuenta }
  | { ok: false; error: 'credenciales_invalidas'; intentosRestantes: number }
  | { ok: false; error: 'bloqueada'; msRestantes: number };

export type ResultadoClaveRecuperacion =
  | { ok: true; claveEnvueltaCodigo: ClaveEnvuelta; perfilCifrado: DatosCifrados }
  | { ok: false; error: 'credenciales_invalidas' };

export type ResultadoRecuperacion =
  | { ok: true; sesion: SesionEmitida; cuenta: MaterialCifradoCuenta }
  | { ok: false; error: 'credenciales_invalidas' };

export interface OpcionesServicioCuentas {
  cripto: CriptoServidor;
  iteracionesAuth: number;
  maxIntentos: number;
  bloqueoMs: number;
  sesionMs: number;
  reloj?: () => Date;
}

// Tope de celulares inexistentes que se recuerdan en memoria para el bloqueo.
const MAX_INTENTOS_FANTASMA = 10_000;

/**
 * Cuentas en el servidor sin conocer el PIN, el codigo, el nombre ni la clave de datos.
 * Respuestas iguales para un celular registrado y uno que no lo esta: misma forma, mismo
 * conteo de intentos y bloqueo (los inexistentes se cuentan en memoria) y costo de scrypt parecido.
 */
export class ServicioCuentasServidor {
  private readonly cripto: CriptoServidor;
  private readonly reloj: () => Date;
  private readonly intentosFantasma = new Map<string, IntentosSerializados>();

  constructor(
    private readonly bd: Consultor,
    private readonly opciones: OpcionesServicioCuentas,
  ) {
    this.cripto = opciones.cripto;
    this.reloj = opciones.reloj ?? (() => new Date());
  }

  private get cuentas(): RepositorioCuentas {
    return new RepositorioCuentas(this.bd);
  }

  private get sesiones(): RepositorioSesiones {
    return new RepositorioSesiones(this.bd);
  }

  /** Sal real si el celular tiene cuenta; si no, una sal falsa estable con las iteraciones por defecto. */
  async parametros(celular: string): Promise<ParametrosAutenticacion> {
    const cuenta = await this.cuentas.buscarPorCelular(celular);
    if (cuenta) return { salAuth: cuenta.salAuth, iteraciones: cuenta.iteracionesAuth };
    return { salAuth: this.cripto.salFalsa(celular), iteraciones: this.opciones.iteracionesAuth };
  }

  async registrar(datos: DatosRegistroServidor): Promise<ResultadoRegistro> {
    const [verificadorPin, verificadorCodigo] = await Promise.all([
      this.cripto.protegerVerificador(datos.verificadorPin),
      this.cripto.protegerVerificador(datos.verificadorCodigo),
    ]);
    const id = randomUUID();
    const creada = await this.cuentas.crear({
      id,
      celular: datos.celular,
      salAuth: datos.salAuth,
      iteracionesAuth: datos.iteraciones,
      verificadorPin,
      verificadorCodigo,
      claveEnvueltaPin: datos.claveEnvueltaPin,
      claveEnvueltaCodigo: datos.claveEnvueltaCodigo,
      perfilCifrado: datos.perfilCifrado,
    });
    if (!creada) return { ok: false, error: 'ya_existe' };
    this.intentosFantasma.delete(this.cripto.huellaCelular(datos.celular));
    return { ok: true, sesion: await this.emitirSesion(id) };
  }

  /** 5 fallos seguidos bloquean la cuenta durante bloqueoMs (CA-02.3). */
  async iniciarSesion(celular: string, verificador: string): Promise<ResultadoSesion> {
    const cuenta = await this.cuentas.buscarPorCelular(celular);
    const control = cuenta
      ? this.control({ fallos: cuenta.intentosFallidos, bloqueadoHasta: cuenta.bloqueadaHasta })
      : this.control(this.intentosFantasma.get(this.cripto.huellaCelular(celular)) ?? null);

    const antes = control.estado();
    if (antes.bloqueado) return { ok: false, error: 'bloqueada', msRestantes: antes.msRestantes };

    let correcto = false;
    if (cuenta) correcto = await this.cripto.comprobarVerificador(verificador, cuenta.verificadorPin);
    else await this.cripto.trabajoFicticio(verificador);

    if (!correcto) {
      const estado = control.registrarFallo();
      await this.guardarIntentos(celular, cuenta, control.serializar());
      return estado.bloqueado
        ? { ok: false, error: 'bloqueada', msRestantes: estado.msRestantes }
        : { ok: false, error: 'credenciales_invalidas', intentosRestantes: estado.intentosRestantes };
    }

    const exitosa = cuenta as CuentaServidor;
    control.registrarExito();
    await this.cuentas.guardarIntentos(exitosa.id, 0, null);
    return { ok: true, sesion: await this.emitirSesion(exitosa.id), cuenta: ServicioCuentasServidor.material(exitosa) };
  }

  /**
   * Paso 1 de la recuperacion (CA-03.1 entre dispositivos): con el verificador del codigo se entrega
   * la clave envuelta con el codigo, para que el cliente la abra y la envuelva con el PIN nuevo.
   */
  async claveRecuperacion(celular: string, verificadorCodigo: string): Promise<ResultadoClaveRecuperacion> {
    const cuenta = await this.comprobarCodigo(celular, verificadorCodigo);
    if (!cuenta) return { ok: false, error: 'credenciales_invalidas' };
    return { ok: true, claveEnvueltaCodigo: cuenta.claveEnvueltaCodigo, perfilCifrado: cuenta.perfilCifrado };
  }

  /** Paso 2: guarda el verificador y la envoltura del PIN nuevo, cierra las otras sesiones y abre una. */
  async recuperar(
    celular: string,
    verificadorCodigo: string,
    verificadorPinNuevo: string,
    claveEnvueltaPinNueva: ClaveEnvuelta,
  ): Promise<ResultadoRecuperacion> {
    const cuenta = await this.comprobarCodigo(celular, verificadorCodigo);
    if (!cuenta) return { ok: false, error: 'credenciales_invalidas' };
    const protegido = await this.cripto.protegerVerificador(verificadorPinNuevo);
    await this.cuentas.cambiarPin(cuenta.id, protegido, claveEnvueltaPinNueva);
    await this.sesiones.borrarDeCuenta(cuenta.id);
    const actualizada = { ...cuenta, claveEnvueltaPin: claveEnvueltaPinNueva };
    return { ok: true, sesion: await this.emitirSesion(cuenta.id), cuenta: ServicioCuentasServidor.material(actualizada) };
  }

  /** Id de la cuenta duena del token, o null si no existe o vencio. */
  autenticar(token: string): Promise<string | null> {
    return this.sesiones.cuentaDe(CriptoServidor.hashToken(token), this.reloj());
  }

  async cerrarSesion(token: string): Promise<void> {
    await this.sesiones.borrar(CriptoServidor.hashToken(token));
  }

  /** Borra la cuenta y, en cascada, sesiones, casos y evidencias. Exige el verificador del PIN. */
  async borrarCuenta(cuentaId: string, verificadorPin: string): Promise<boolean> {
    const cuenta = await this.cuentas.buscarPorId(cuentaId);
    if (!cuenta) return false;
    if (!(await this.cripto.comprobarVerificador(verificadorPin, cuenta.verificadorPin))) return false;
    await this.cuentas.borrar(cuenta.id);
    return true;
  }

  private async comprobarCodigo(celular: string, verificadorCodigo: string): Promise<CuentaServidor | null> {
    const cuenta = await this.cuentas.buscarPorCelular(celular);
    if (!cuenta) {
      await this.cripto.trabajoFicticio(verificadorCodigo);
      return null;
    }
    return (await this.cripto.comprobarVerificador(verificadorCodigo, cuenta.verificadorCodigo)) ? cuenta : null;
  }

  private async guardarIntentos(celular: string, cuenta: CuentaServidor | null, intentos: IntentosSerializados): Promise<void> {
    if (cuenta) {
      await this.cuentas.guardarIntentos(cuenta.id, intentos.fallos, intentos.bloqueadoHasta);
      return;
    }
    if (this.intentosFantasma.size >= MAX_INTENTOS_FANTASMA) this.intentosFantasma.clear();
    this.intentosFantasma.set(this.cripto.huellaCelular(celular), intentos);
  }

  private control(intentos: IntentosSerializados | null): ControlIntentos {
    return ControlIntentos.desdeJSON(intentos, {
      maxIntentos: this.opciones.maxIntentos,
      bloqueoMs: this.opciones.bloqueoMs,
      reloj: this.reloj,
    });
  }

  private async emitirSesion(cuentaId: string): Promise<SesionEmitida> {
    const token = CriptoServidor.nuevoToken();
    const ahora = this.reloj();
    const expira = new Date(ahora.getTime() + this.opciones.sesionMs);
    await this.sesiones.purgarVencidas(ahora);
    await this.sesiones.crear(CriptoServidor.hashToken(token), cuentaId, expira);
    return { token, expiraEn: expira.toISOString() };
  }

  private static material(cuenta: CuentaServidor): MaterialCifradoCuenta {
    return {
      claveEnvueltaPin: cuenta.claveEnvueltaPin,
      claveEnvueltaCodigo: cuenta.claveEnvueltaCodigo,
      perfilCifrado: cuenta.perfilCifrado,
    };
  }
}
