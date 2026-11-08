import type { IncomingMessage, ServerResponse } from 'node:http';

import { conectar, type BaseDatos } from './bd/conexion';
import { migrar } from './bd/migraciones';
import { configuracionDesdeEntorno, type ConfiguracionDatos } from './configuracion';
import { CriptoServidor } from './cuentas/CriptoServidor';
import { ServicioCuentasServidor } from './cuentas/ServicioCuentasServidor';
import { LimitadorPeticiones } from './LimitadorPeticiones';
import { ServicioDatosServidor } from './ServicioDatosServidor';
import * as v from './validacion';

/** Cabeceras de PUT/GET /api/evidencias/:id (el cuerpo va en binario, ya cifrado). */
export const CABECERAS_EVIDENCIA = {
  caso: 'x-vozvial-caso',
  iv: 'x-vozvial-iv',
  mime: 'x-vozvial-mime',
  actualizadoEn: 'x-vozvial-actualizado',
} as const;

const MENSAJES: Record<string, string> = {
  datos_invalidos: 'Los datos enviados no son válidos.',
  json_invalido: 'Los datos enviados no son válidos.',
  credenciales_invalidas: 'El celular o el PIN no son correctos.',
  codigo_invalido: 'El celular o el código de recuperación no son correctos.',
  bloqueada: 'Por seguridad, espera unos minutos antes de intentar otra vez.',
  ya_existe: 'Ya hay una cuenta con ese celular. Entra con tu PIN.',
  no_autorizado: 'Tu sesión terminó. Entra otra vez con tu PIN.',
  limite_peticiones: 'Hiciste muchos intentos seguidos. Espera un minuto.',
  muy_grande: 'El archivo es muy grande.',
  cuota_excedida: 'Ya no hay espacio para más archivos en tu cuenta.',
  caso_no_encontrado: 'No encontramos el caso de esa evidencia.',
  vacia: 'El archivo está vacío.',
  no_encontrado: 'No encontramos lo que buscas.',
  metodo_no_permitido: 'Esa acción no está permitida aquí.',
  bd_no_disponible: 'El servicio de respaldo no está disponible ahora. Tus datos siguen en este celular.',
  error_interno: 'Algo falló en el servidor. Intenta de nuevo en un momento.',
};

class ErrorHttp extends Error {
  constructor(
    readonly estado: number,
    readonly codigo: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(codigo);
    this.name = 'ErrorHttp';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function responder(res: ServerResponse, estado: number, cuerpo: unknown): void {
  res.statusCode = estado;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(cuerpo));
}

function responderError(res: ServerResponse, error: ErrorHttp): void {
  if (error.codigo === 'limite_peticiones' || error.codigo === 'bloqueada') {
    const ms = Number(error.extra.msRestantes ?? 60_000);
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil(ms / 1000))));
  }
  responder(res, error.estado, { error: error.codigo, mensaje: MENSAJES[error.codigo] ?? MENSAJES.error_interno, ...error.extra });
}

/** Lee el cuerpo con un tope de bytes. Nunca lo escribe en los logs. */
function leerBytes(req: IncomingMessage, maximo: number): Promise<Buffer> {
  const declarado = Number(req.headers['content-length'] ?? NaN);
  if (Number.isFinite(declarado) && declarado > maximo) {
    req.resume();
    return Promise.reject(new ErrorHttp(413, 'muy_grande', { maxBytes: maximo }));
  }
  return new Promise((resolve, reject) => {
    const partes: Buffer[] = [];
    let total = 0;
    let rechazado = false;
    req.on('data', (parte: Buffer) => {
      if (rechazado) return;
      total += parte.length;
      if (total > maximo) {
        rechazado = true;
        reject(new ErrorHttp(413, 'muy_grande', { maxBytes: maximo }));
        req.resume();
        return;
      }
      partes.push(parte);
    });
    req.on('end', () => {
      if (!rechazado) resolve(Buffer.concat(partes));
    });
    req.on('error', (e) => {
      if (!rechazado) reject(e);
    });
  });
}

async function leerJson(req: IncomingMessage, maximo: number): Promise<Record<string, unknown>> {
  const texto = (await leerBytes(req, maximo)).toString('utf8');
  if (texto.trim() === '') return {};
  try {
    return v.objeto(JSON.parse(texto));
  } catch {
    throw new ErrorHttp(400, 'json_invalido');
  }
}

function cabecera(req: IncomingMessage, nombre: string): string | undefined {
  const valor = req.headers[nombre];
  return Array.isArray(valor) ? valor[0] : valor;
}

function tokenDe(req: IncomingMessage): string | null {
  const autorizacion = cabecera(req, 'authorization') ?? '';
  const m = /^Bearer ([A-Za-z0-9_-]{20,200})$/.exec(autorizacion.trim());
  return m?.[1] ?? null;
}

export interface ContextoApi {
  bd: BaseDatos;
  config: ConfiguracionDatos;
  reloj?: () => Date;
}

/**
 * API de cuentas y datos cifrados (docs/bd.md). Atiende /api/cuentas, /api/sesiones,
 * /api/recuperacion, /api/cuenta, /api/casos y /api/evidencias; lo demas lo deja pasar.
 */
export class ApiDatos {
  readonly cuentas: ServicioCuentasServidor;
  readonly datos: ServicioDatosServidor;
  private readonly limitador: LimitadorPeticiones;
  private readonly reloj: () => Date;

  constructor(private readonly contexto: ContextoApi) {
    const { bd, config } = contexto;
    this.reloj = contexto.reloj ?? (() => new Date());
    this.cuentas = new ServicioCuentasServidor(bd, {
      cripto: new CriptoServidor(config.secreto, config.scrypt),
      iteracionesAuth: config.iteracionesAuth,
      maxIntentos: config.maxIntentos,
      bloqueoMs: config.bloqueoMs,
      sesionMs: config.sesionMs,
      reloj: this.reloj,
    });
    this.datos = new ServicioDatosServidor(bd, {
      maxBytesEvidencia: config.maxBytesEvidencia,
      cuotaCuentaBytes: config.cuotaCuentaBytes,
    });
    this.limitador = new LimitadorPeticiones(config.peticionesPorMinuto);
  }

  /** Conecta (pg o PGlite segun DATABASE_URL), corre las migraciones y arma la API. */
  static async iniciar(config: ConfiguracionDatos = configuracionDesdeEntorno()): Promise<ApiDatos> {
    const bd = await conectar({ url: config.urlBaseDatos, directorioPglite: config.directorioPglite });
    await migrar(bd);
    return new ApiDatos({ bd, config });
  }

  static atiende(ruta: string): boolean {
    return /^\/api\/(cuentas|sesiones|recuperacion|cuenta|casos|evidencias)(\/|$)/.test(ruta);
  }

  cerrar(): Promise<void> {
    return this.contexto.bd.cerrar();
  }

  /** Texto para el log de arranque, sin URL ni secretos. */
  descripcion(): string {
    const { bd, config } = this.contexto;
    const persistencia = bd.tipo === 'pg' ? 'Postgres' : config.directorioPglite ? 'PGlite en disco' : 'PGlite en memoria';
    const avisos: Record<ConfiguracionDatos['origenSecreto'], string> = {
      variable: 'secreto definido',
      derivado_de_bd: 'falta SECRETO_SERVIDOR, se usa uno derivado de la base',
      local: 'secreto de desarrollo local',
    };
    return `${persistencia}; ${avisos[config.origenSecreto]}`;
  }

  /** Devuelve false si la ruta no es de esta API. */
  async manejar(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!ApiDatos.atiende(url.pathname)) return false;
    try {
      await this.enrutar(req, res, url);
    } catch (error) {
      if (error instanceof ErrorHttp) responderError(res, error);
      else if (error instanceof v.ErrorValidacion) responderError(res, new ErrorHttp(400, 'datos_invalidos', { campo: error.campo }));
      else if (!res.headersSent) responderError(res, new ErrorHttp(500, 'error_interno'));
      else res.end();
    }
    return true;
  }

  private async enrutar(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    const metodo = req.method ?? 'GET';
    const partes = url.pathname.split('/').filter(Boolean).slice(1);
    const [recurso, sub, ...resto] = partes;
    if (resto.length > 0) throw new ErrorHttp(404, 'no_encontrado');

    switch (recurso) {
      case 'cuentas':
        if (sub === 'parametros' && metodo === 'GET') return this.parametros(req, res, url);
        if (sub === undefined && metodo === 'POST') return this.registrar(req, res);
        break;
      case 'sesiones':
        if (sub !== undefined) break;
        if (metodo === 'POST') return this.iniciarSesion(req, res);
        if (metodo === 'DELETE') return this.cerrarSesion(req, res);
        break;
      case 'recuperacion':
        if (sub === 'clave' && metodo === 'POST') return this.claveRecuperacion(req, res);
        if (sub === undefined && metodo === 'POST') return this.recuperar(req, res);
        break;
      case 'cuenta':
        if (sub === undefined && metodo === 'DELETE') return this.borrarCuenta(req, res);
        break;
      case 'casos':
        return this.casos(req, res, url, metodo, sub);
      case 'evidencias':
        return this.evidencias(req, res, metodo, sub);
    }
    throw new ErrorHttp(404, 'no_encontrado');
  }

  // --- Cuentas y sesiones ---

  private limitar(req: IncomingMessage, cubeta: string): void {
    const resultado = this.limitador.registrar(`${cubeta}|${this.ipDe(req)}`);
    if (!resultado.permitido) throw new ErrorHttp(429, 'limite_peticiones', { msRestantes: resultado.msRestantes });
  }

  private ipDe(req: IncomingMessage): string {
    if (this.contexto.config.confiarProxy) {
      const reenviada = cabecera(req, 'x-forwarded-for')?.split(',')[0]?.trim();
      if (reenviada) return reenviada;
    }
    return req.socket.remoteAddress ?? 'desconocida';
  }

  private async parametros(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    this.limitar(req, 'parametros');
    const celular = v.celular(url.searchParams.get('celular'));
    responder(res, 200, await this.cuentas.parametros(celular));
  }

  private async registrar(req: IncomingMessage, res: ServerResponse): Promise<void> {
    this.limitar(req, 'registro');
    const c = await leerJson(req, this.contexto.config.maxBytesJson);
    const resultado = await this.cuentas.registrar({
      celular: v.celular(c.celular),
      salAuth: v.salAuth(c.salAuth),
      iteraciones: v.iteraciones(c.iteraciones, this.contexto.config.iteracionesMinimas),
      verificadorPin: v.verificador(c.verificadorPin, 'verificadorPin'),
      verificadorCodigo: v.verificador(c.verificadorCodigo, 'verificadorCodigo'),
      claveEnvueltaPin: v.claveEnvuelta(c.claveEnvueltaPin, 'claveEnvueltaPin'),
      claveEnvueltaCodigo: v.claveEnvuelta(c.claveEnvueltaCodigo, 'claveEnvueltaCodigo'),
      perfilCifrado: v.datosCifrados(c.perfilCifrado, 'perfilCifrado', 4096),
    });
    if (!resultado.ok) throw new ErrorHttp(409, 'ya_existe');
    responder(res, 201, resultado.sesion);
  }

  private async iniciarSesion(req: IncomingMessage, res: ServerResponse): Promise<void> {
    this.limitar(req, 'sesiones');
    const c = await leerJson(req, this.contexto.config.maxBytesJson);
    const resultado = await this.cuentas.iniciarSesion(v.celular(c.celular), v.verificador(c.verificador, 'verificador'));
    if (resultado.ok) {
      responder(res, 200, { ...resultado.sesion, ...resultado.cuenta });
      return;
    }
    if (resultado.error === 'bloqueada') throw new ErrorHttp(423, 'bloqueada', { msRestantes: resultado.msRestantes });
    throw new ErrorHttp(401, 'credenciales_invalidas', { intentosRestantes: resultado.intentosRestantes });
  }

  private async cerrarSesion(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const token = tokenDe(req);
    if (token) await this.cuentas.cerrarSesion(token);
    res.statusCode = 204;
    res.end();
  }

  private async claveRecuperacion(req: IncomingMessage, res: ServerResponse): Promise<void> {
    this.limitar(req, 'recuperacion');
    const c = await leerJson(req, this.contexto.config.maxBytesJson);
    const resultado = await this.cuentas.claveRecuperacion(
      v.celular(c.celular),
      v.verificador(c.verificadorCodigo, 'verificadorCodigo'),
    );
    if (!resultado.ok) throw new ErrorHttp(401, 'codigo_invalido');
    responder(res, 200, { claveEnvueltaCodigo: resultado.claveEnvueltaCodigo, perfilCifrado: resultado.perfilCifrado });
  }

  private async recuperar(req: IncomingMessage, res: ServerResponse): Promise<void> {
    this.limitar(req, 'recuperacion');
    const c = await leerJson(req, this.contexto.config.maxBytesJson);
    const resultado = await this.cuentas.recuperar(
      v.celular(c.celular),
      v.verificador(c.verificadorCodigo, 'verificadorCodigo'),
      v.verificador(c.verificadorPin, 'verificadorPin'),
      v.claveEnvuelta(c.claveEnvueltaPin, 'claveEnvueltaPin'),
    );
    if (!resultado.ok) throw new ErrorHttp(401, 'codigo_invalido');
    responder(res, 200, { ...resultado.sesion, ...resultado.cuenta });
  }

  private async borrarCuenta(req: IncomingMessage, res: ServerResponse): Promise<void> {
    this.limitar(req, 'cuenta');
    const cuentaId = await this.exigirSesion(req);
    const c = await leerJson(req, this.contexto.config.maxBytesJson);
    const borrada = await this.cuentas.borrarCuenta(cuentaId, v.verificador(c.verificadorPin, 'verificadorPin'));
    if (!borrada) throw new ErrorHttp(401, 'credenciales_invalidas');
    res.statusCode = 204;
    res.end();
  }

  private async exigirSesion(req: IncomingMessage): Promise<string> {
    const token = tokenDe(req);
    const cuentaId = token ? await this.cuentas.autenticar(token) : null;
    if (!cuentaId) throw new ErrorHttp(401, 'no_autorizado');
    return cuentaId;
  }

  // --- Casos ---

  private async casos(req: IncomingMessage, res: ServerResponse, url: URL, metodo: string, id?: string): Promise<void> {
    const cuentaId = await this.exigirSesion(req);
    const ahora = this.reloj();
    if (id === undefined) {
      if (metodo === 'GET') {
        const desdeTexto = url.searchParams.get('desde');
        const desde = desdeTexto ? v.instante(desdeTexto, new Date(8.64e15), 'desde') : undefined;
        responder(res, 200, { casos: await this.datos.listarCasos(cuentaId, desde), ahora: ahora.toISOString() });
        return;
      }
      if (metodo === 'DELETE') {
        const borrados = await this.datos.borrarCasos(cuentaId, ahora.toISOString());
        responder(res, 200, { borrados });
        return;
      }
      throw new ErrorHttp(405, 'metodo_no_permitido');
    }

    const idCaso = v.id(id);
    if (metodo === 'GET') {
      const caso = await this.datos.obtenerCaso(cuentaId, idCaso);
      if (!caso) throw new ErrorHttp(404, 'no_encontrado');
      responder(res, 200, caso);
      return;
    }
    if (metodo === 'PUT') {
      const c = await leerJson(req, this.contexto.config.maxBytesJson);
      if (typeof c.datos !== 'string' || c.datos.length === 0) throw new v.ErrorValidacion('datos');
      const resultado = await this.datos.guardarCaso(cuentaId, {
        id: idCaso,
        iv: v.ivBase64(c.iv),
        datos: v.datosCifrados({ iv: c.iv, datos: c.datos }, 'datos', this.contexto.config.maxBytesJson).datos,
        actualizadoEn: v.instante(c.actualizadoEn, ahora),
      });
      responder(res, 200, resultado);
      return;
    }
    if (metodo === 'DELETE') {
      const marca = url.searchParams.get('actualizadoEn');
      const resultado = await this.datos.borrarCaso(cuentaId, idCaso, marca ? v.instante(marca, ahora) : ahora.toISOString());
      responder(res, 200, resultado);
      return;
    }
    throw new ErrorHttp(405, 'metodo_no_permitido');
  }

  // --- Evidencias ---

  private async evidencias(req: IncomingMessage, res: ServerResponse, metodo: string, id?: string): Promise<void> {
    const cuentaId = await this.exigirSesion(req);
    if (id === undefined) {
      if (metodo !== 'GET') throw new ErrorHttp(405, 'metodo_no_permitido');
      responder(res, 200, { evidencias: await this.datos.listarEvidencias(cuentaId) });
      return;
    }

    const idEvidencia = v.id(id);
    if (metodo === 'GET') {
      const evidencia = await this.datos.obtenerEvidencia(cuentaId, idEvidencia);
      if (!evidencia) throw new ErrorHttp(404, 'no_encontrado');
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader(CABECERAS_EVIDENCIA.caso, evidencia.casoId);
      res.setHeader(CABECERAS_EVIDENCIA.iv, evidencia.iv);
      res.setHeader(CABECERAS_EVIDENCIA.mime, evidencia.mime);
      res.setHeader(CABECERAS_EVIDENCIA.actualizadoEn, evidencia.actualizadoEn);
      res.end(Buffer.from(evidencia.datos.buffer, evidencia.datos.byteOffset, evidencia.datos.byteLength));
      return;
    }
    if (metodo === 'PUT') {
      const config = this.contexto.config;
      // Se valida todo lo de las cabeceras antes de leer hasta 8 MB de cuerpo.
      const metadatos = {
        id: idEvidencia,
        casoId: v.id(cabecera(req, CABECERAS_EVIDENCIA.caso), 'casoId'),
        iv: v.ivBase64(cabecera(req, CABECERAS_EVIDENCIA.iv)),
        mime: v.mime(cabecera(req, CABECERAS_EVIDENCIA.mime)),
        actualizadoEn: v.instante(cabecera(req, CABECERAS_EVIDENCIA.actualizadoEn), this.reloj()),
      };
      const datos = await leerBytes(req, config.maxBytesEvidencia);
      const resultado = await this.datos.guardarEvidencia(cuentaId, { ...metadatos, datos: new Uint8Array(datos) });
      if (!resultado.ok) {
        const estado = resultado.error === 'caso_no_encontrado' ? 404 : resultado.error === 'vacia' ? 400 : 413;
        throw new ErrorHttp(estado, resultado.error, resultado.error === 'muy_grande' ? { maxBytes: config.maxBytesEvidencia } : {});
      }
      responder(res, 200, resultado.resultado);
      return;
    }
    if (metodo === 'DELETE') {
      const borrada = await this.datos.borrarEvidencia(cuentaId, idEvidencia);
      responder(res, 200, { borrada });
      return;
    }
    throw new ErrorHttp(405, 'metodo_no_permitido');
  }
}

/**
 * Envoltura para el servidor HTTP: inicia la API en segundo plano y, mientras arranca o si
 * la base no responde, contesta 503 sin tumbar el SPA ni /api/asistente.
 */
export function crearManejadorDatos(iniciar: () => Promise<ApiDatos> = () => ApiDatos.iniciar()): {
  listo: Promise<ApiDatos | null>;
  manejar: (req: IncomingMessage, res: ServerResponse) => Promise<boolean>;
} {
  const listo = iniciar().catch((error: unknown) => {
    // Solo el tipo de error: la URL de la base y los datos no se escriben en el log.
    console.error(`API de datos no disponible: ${error instanceof Error ? error.name : 'error'}`);
    return null;
  });
  return {
    listo,
    async manejar(req, res) {
      const ruta = new URL(req.url ?? '/', 'http://localhost').pathname;
      if (!ApiDatos.atiende(ruta)) return false;
      const api = await listo;
      if (!api) {
        responderError(res, new ErrorHttp(503, 'bd_no_disponible'));
        return true;
      }
      return api.manejar(req, res);
    },
  };
}
