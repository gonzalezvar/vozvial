import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { Caso } from '../../../../src/core/Caso';
import { CodigoRecuperacion } from '../../../../src/core/CodigoRecuperacion';
import { GestorClaves } from '../../../../src/core/GestorClaves';
import { migrar } from '../../../../src/servidor/bd/migraciones';
import { crearManejadorDatos } from '../../../../src/servidor/rutas';
import { ClienteCuentas } from '../../../../src/services/ClienteCuentas';
import { ClienteSincronizacion } from '../../../../src/services/ClienteSincronizacion';
import { ErrorApiDatos } from '../../../../src/services/PeticionApi';
import { crearEntorno, type EntornoApi } from './entorno';

const ITERACIONES = 1000;
const gestor = new GestorClaves(globalThis.crypto, { iteraciones: ITERACIONES });

let entorno: EntornoApi;
let siguienteCelular = 3100000000;

beforeAll(async () => {
  entorno = await crearEntorno({ maxBytesEvidencia: 4096, cuotaCuentaBytes: 10_000 });
});

afterAll(async () => {
  await entorno.cerrar();
});

function clienteCuentas(url = entorno.url): ClienteCuentas {
  return new ClienteCuentas({ baseUrl: url, crypto: globalThis.crypto, enLinea: () => true });
}

function clienteSync(token: () => string | null, url = entorno.url): ClienteSincronizacion {
  return new ClienteSincronizacion({ baseUrl: url, obtenerToken: token, enLinea: () => true });
}

async function errorDe(promesa: Promise<unknown>): Promise<ErrorApiDatos> {
  try {
    await promesa;
  } catch (error) {
    if (error instanceof ErrorApiDatos) return error;
    throw error;
  }
  throw new Error('Se esperaba un ErrorApiDatos');
}

/** Crea una cuenta como lo haria la app: clave de datos local, envolturas y perfil cifrado. */
async function nuevaCuenta(pin = '482915', nombre = 'Persona de Prueba') {
  const celular = String(siguienteCelular++);
  const codigo = CodigoRecuperacion.generar(globalThis.crypto);
  const claveDatos = await gestor.generarClaveDatos();
  const [claveEnvueltaPin, claveEnvueltaCodigo, perfilCifrado] = await Promise.all([
    gestor.envolver(claveDatos, pin),
    gestor.envolver(claveDatos, codigo),
    gestor.cifrar(claveDatos, JSON.stringify({ nombre, celular })),
  ]);
  const sesion = await clienteCuentas().registrarConSecretos({
    celular,
    pin,
    codigo,
    claveEnvueltaPin,
    claveEnvueltaCodigo,
    perfilCifrado,
  });
  return { celular, pin, codigo, claveDatos, nombre, sesion };
}

async function casoCifrado(claveDatos: CryptoKey, id: string, numeroNota = 'Nota privada') {
  const caso = Caso.crear({
    id,
    creadoEn: '2026-11-09T07:40:00-05:00',
    ubicacion: null,
    motivoSinUbicacion: 'denegada',
    conductor: { nombre: numeroNota },
  });
  return gestor.cifrar(claveDatos, JSON.stringify(caso.toJSON()));
}

describe('migraciones', () => {
  it('son idempotentes: la segunda corrida no aplica nada', async () => {
    await expect(migrar(entorno.bd)).resolves.toEqual([]);
  });
});

describe('registro y sesion', () => {
  it('registra sin guardar en claro el nombre ni el verificador del cliente', async () => {
    const cuenta = await nuevaCuenta('730264', 'Nombre Muy Privado');
    expect(cuenta.sesion.token.length).toBeGreaterThan(20);
    const filas = await entorno.bd.consultar<Record<string, unknown>>('SELECT * FROM cuentas WHERE celular = $1', [cuenta.celular]);
    expect(filas).toHaveLength(1);
    const texto = JSON.stringify(filas[0]);
    expect(texto).not.toContain('Nombre Muy Privado');
    expect(texto).not.toContain('730264');
    expect(String(filas[0]?.verificador_pin)).toMatch(/^scrypt\$/);
    const sesiones = await entorno.bd.consultar<{ token_hash: string }>('SELECT token_hash FROM sesiones');
    expect(sesiones.map((s) => s.token_hash)).not.toContain(cuenta.sesion.token);
  });

  it('no deja registrar dos veces el mismo celular', async () => {
    const cuenta = await nuevaCuenta();
    const claveDatos = await gestor.generarClaveDatos();
    const error = await errorDe(
      clienteCuentas().registrarConSecretos({
        celular: cuenta.celular,
        pin: '615038',
        codigo: CodigoRecuperacion.generar(globalThis.crypto),
        claveEnvueltaPin: await gestor.envolver(claveDatos, '615038'),
        claveEnvueltaCodigo: await gestor.envolver(claveDatos, 'ABCDEFGHJKMN'),
        perfilCifrado: await gestor.cifrar(claveDatos, '{}'),
      }),
    );
    expect(error.causa).toBe('ya_existe');
    expect(error.estado).toBe(409);
  });

  it('entra con el PIN correcto y recibe lo necesario para abrir los datos en otro dispositivo', async () => {
    const cuenta = await nuevaCuenta('615038', 'Rosa de Prueba');
    const remota = await clienteCuentas().entrarConPin(cuenta.celular, '615038');
    const claveDatos = await gestor.desenvolver(remota.claveEnvueltaPin, '615038');
    await expect(gestor.descifrarTexto(claveDatos, remota.perfilCifrado)).resolves.toContain('Rosa de Prueba');
    await expect(clienteSync(() => remota.token).listarCasos()).resolves.toMatchObject({ casos: [] });
  });

  it('con un PIN incorrecto responde credenciales_invalidas y cuenta los intentos', async () => {
    const cuenta = await nuevaCuenta();
    const error = await errorDe(clienteCuentas().entrarConPin(cuenta.celular, '000123'));
    expect(error.causa).toBe('credenciales_invalidas');
    expect(error.estado).toBe(401);
    expect(error.intentosRestantes).toBe(4);
  });

  it('bloquea la cuenta tras 5 fallos seguidos durante el tiempo configurado (CA-02.3)', async () => {
    const cuenta = await nuevaCuenta();
    const cliente = clienteCuentas();
    for (let i = 0; i < 4; i++) {
      await expect(errorDe(cliente.entrarConPin(cuenta.celular, '000123'))).resolves.toMatchObject({ causa: 'credenciales_invalidas' });
    }
    const quinto = await errorDe(cliente.entrarConPin(cuenta.celular, '000123'));
    expect(quinto.causa).toBe('bloqueada');
    expect(quinto.estado).toBe(423);
    expect(quinto.msRestantes).toBe(entorno.config.bloqueoMs);

    // Bloqueada: ni el PIN correcto entra.
    await expect(errorDe(cliente.entrarConPin(cuenta.celular, cuenta.pin))).resolves.toMatchObject({ causa: 'bloqueada' });

    entorno.reloj.avanzar(entorno.config.bloqueoMs);
    const remota = await cliente.entrarConPin(cuenta.celular, cuenta.pin);
    expect(remota.token).toBeTruthy();
    // Tras entrar, el contador vuelve a cero.
    await expect(errorDe(cliente.entrarConPin(cuenta.celular, '000123'))).resolves.toMatchObject({ intentosRestantes: 4 });
  });

  it('cerrar sesion invalida el token', async () => {
    const cuenta = await nuevaCuenta();
    await clienteCuentas().cerrarSesion(cuenta.sesion.token);
    await expect(errorDe(clienteSync(() => cuenta.sesion.token).listarCasos())).resolves.toMatchObject({ causa: 'no_autorizado' });
  });

  it('la sesion vence', async () => {
    const cuenta = await nuevaCuenta();
    entorno.reloj.avanzar(entorno.config.sesionMs + 1);
    await expect(errorDe(clienteSync(() => cuenta.sesion.token).listarCasos())).resolves.toMatchObject({ causa: 'no_autorizado' });
  });
});

describe('no revela si un celular esta registrado', () => {
  it('los parametros de un celular inexistente son estables y tienen la misma forma', async () => {
    const cliente = clienteCuentas();
    const cuenta = await nuevaCuenta();
    const real = await cliente.parametros(cuenta.celular);
    const falso1 = await cliente.parametros('3209998877');
    const falso2 = await cliente.parametros('320 999 8877');
    expect(falso1).toEqual(falso2);
    expect(Object.keys(falso1).sort()).toEqual(Object.keys(real).sort());
    expect(falso1.salAuth).toHaveLength(real.salAuth.length);
    expect(falso1.iteraciones).toBe(entorno.config.iteracionesAuth);
    await expect(cliente.parametros('3209998878')).resolves.not.toEqual(falso1);
  });

  it('el error de un celular inexistente es igual al de un PIN incorrecto, y tambien se bloquea', async () => {
    const cuenta = await nuevaCuenta();
    const cliente = clienteCuentas();
    const conCuenta = await errorDe(cliente.entrarConPin(cuenta.celular, '000123'));
    const sinCuenta = await errorDe(cliente.entrarConPin('3207776655', '000123'));
    expect({ ...sinCuenta, message: sinCuenta.message }).toEqual({ ...conCuenta, message: conCuenta.message });

    for (let i = 0; i < 3; i++) await errorDe(cliente.entrarConPin('3207776655', '000123'));
    await expect(errorDe(cliente.entrarConPin('3207776655', '000123'))).resolves.toMatchObject({ causa: 'bloqueada', estado: 423 });
    entorno.reloj.avanzar(entorno.config.bloqueoMs);
  });
});

describe('recuperacion con el codigo', () => {
  it('cambia el PIN, cierra las sesiones viejas y conserva la misma clave de datos', async () => {
    const cuenta = await nuevaCuenta('482915');
    const sync = clienteSync(() => cuenta.sesion.token);
    const cifrado = await casoCifrado(cuenta.claveDatos, 'caso-recuperacion-1');
    await sync.subirCaso({ id: 'caso-recuperacion-1', ...cifrado, actualizadoEn: entorno.reloj.ahora().toISOString() });

    const otroGestor = new GestorClaves(globalThis.crypto, { iteraciones: ITERACIONES });
    const { cuenta: remota, claveDatos } = await clienteCuentas().recuperarConCodigo(
      cuenta.celular,
      CodigoRecuperacion.formatear(cuenta.codigo).toLowerCase(),
      '730264',
      otroGestor,
    );

    await expect(errorDe(sync.listarCasos())).resolves.toMatchObject({ causa: 'no_autorizado' });
    await expect(errorDe(clienteCuentas().entrarConPin(cuenta.celular, '482915'))).resolves.toMatchObject({
      causa: 'credenciales_invalidas',
    });
    const nueva = await clienteCuentas().entrarConPin(cuenta.celular, '730264');
    expect(nueva.claveEnvueltaPin).toEqual(remota.claveEnvueltaPin);

    const { casos } = await clienteSync(() => nueva.token).listarCasos();
    const caso = casos.find((c) => c.id === 'caso-recuperacion-1');
    expect(caso).toBeDefined();
    const texto = await gestor.descifrarTexto(claveDatos, { iv: caso!.iv, datos: caso!.datos });
    expect(JSON.parse(texto)).toMatchObject({ id: 'caso-recuperacion-1' });
  });

  it('un codigo incorrecto responde codigo_invalido sin cambiar nada', async () => {
    const cuenta = await nuevaCuenta();
    const error = await errorDe(clienteCuentas().recuperarConCodigo(cuenta.celular, 'ABCD-EFGH-JKMN', '730264', gestor));
    expect(error.causa).toBe('codigo_invalido');
    await expect(clienteCuentas().entrarConPin(cuenta.celular, cuenta.pin)).resolves.toHaveProperty('token');
    await expect(
      errorDe(clienteCuentas().recuperarConCodigo('3201231231', 'ABCD-EFGH-JKMN', '730264', gestor)),
    ).resolves.toMatchObject({ causa: 'codigo_invalido' });
  });
});

describe('casos cifrados', () => {
  it('CRUD con gana el mas reciente y borrado con marca', async () => {
    const cuenta = await nuevaCuenta();
    const sync = clienteSync(() => cuenta.sesion.token);
    const t0 = entorno.reloj.ahora().toISOString();
    const v1 = await casoCifrado(cuenta.claveDatos, 'caso-crud-0001');
    await expect(sync.subirCaso({ id: 'caso-crud-0001', ...v1, actualizadoEn: t0 })).resolves.toMatchObject({ aplicado: true });

    const antiguo = await casoCifrado(cuenta.claveDatos, 'caso-crud-0001', 'version vieja');
    const tViejo = new Date(Date.parse(t0) - 60_000).toISOString();
    const rechazado = await sync.subirCaso({ id: 'caso-crud-0001', ...antiguo, actualizadoEn: tViejo });
    expect(rechazado.aplicado).toBe(false);
    expect(rechazado.actual.datos).toBe(v1.datos);

    entorno.reloj.avanzar(1000);
    const t1 = entorno.reloj.ahora().toISOString();
    const v2 = await casoCifrado(cuenta.claveDatos, 'caso-crud-0001', 'version nueva');
    await expect(sync.subirCaso({ id: 'caso-crud-0001', ...v2, actualizadoEn: t1 })).resolves.toMatchObject({ aplicado: true });
    await expect(sync.obtenerCaso('caso-crud-0001')).resolves.toMatchObject({ datos: v2.datos, actualizadoEn: t1, borrado: false });

    // Una marca del futuro se recorta a la hora del servidor.
    const futuro = await sync.subirCaso({ id: 'caso-crud-0002', ...v1, actualizadoEn: '2099-01-01T00:00:00Z' });
    expect(futuro.actual.actualizadoEn).toBe(t1);

    entorno.reloj.avanzar(1000);
    const t2 = entorno.reloj.ahora().toISOString();
    const borrado = await sync.borrarCaso('caso-crud-0001', t2);
    expect(borrado).toMatchObject({ aplicado: true, actual: { borrado: true, iv: '', datos: '' } });

    const { casos } = await sync.listarCasos();
    expect(casos.find((c) => c.id === 'caso-crud-0001')).toMatchObject({ borrado: true });
    const cambiados = await sync.listarCasos(t1);
    expect(cambiados.casos.map((c) => c.id)).toEqual(['caso-crud-0001']);

    await expect(sync.borrarCasos()).resolves.toBe(1);
    await expect(sync.obtenerCaso('no-existe-123')).resolves.toBeNull();
  });

  it('una cuenta no puede leer ni pisar los casos de otra', async () => {
    const a = await nuevaCuenta();
    const b = await nuevaCuenta();
    const syncA = clienteSync(() => a.sesion.token);
    const syncB = clienteSync(() => b.sesion.token);
    const ahora = entorno.reloj.ahora().toISOString();
    const deA = await casoCifrado(a.claveDatos, 'caso-aislado-01');
    await syncA.subirCaso({ id: 'caso-aislado-01', ...deA, actualizadoEn: ahora });

    await expect(syncB.obtenerCaso('caso-aislado-01')).resolves.toBeNull();
    await expect(syncB.listarCasos()).resolves.toMatchObject({ casos: [] });

    // B escribe el mismo id: queda como un caso propio de B; el de A no cambia.
    entorno.reloj.avanzar(1000);
    const deB = await casoCifrado(b.claveDatos, 'caso-aislado-01');
    await syncB.subirCaso({ id: 'caso-aislado-01', ...deB, actualizadoEn: entorno.reloj.ahora().toISOString() });
    await syncB.borrarCaso('caso-aislado-01', entorno.reloj.ahora().toISOString());
    await expect(syncA.obtenerCaso('caso-aislado-01')).resolves.toMatchObject({ datos: deA.datos, borrado: false });
  });

  it('rechaza datos invalidos con 400 sin repetir el contenido', async () => {
    const cuenta = await nuevaCuenta();
    const sync = clienteSync(() => cuenta.sesion.token);
    const error = await errorDe(sync.subirCaso({ id: 'caso-invalido', iv: 'corto', datos: 'xx', actualizadoEn: 'ayer' }));
    expect(error).toMatchObject({ causa: 'datos_invalidos', estado: 400 });
    // Un id con barras no llega a la base: se rechaza por formato.
    await expect(errorDe(sync.subirCaso({ id: '../../x', iv: 'a', datos: 'b', actualizadoEn: 'c' }))).resolves.toMatchObject({
      causa: 'datos_invalidos',
      estado: 400,
    });
  });

  it('sin token responde no_autorizado', async () => {
    const respuesta = await fetch(`${entorno.url}/api/casos`, { headers: { Authorization: 'Bearer token-que-no-existe-0000000' } });
    expect(respuesta.status).toBe(401);
    await expect(errorDe(clienteSync(() => null).listarCasos())).resolves.toMatchObject({ causa: 'no_autorizado' });
  });
});

describe('evidencias cifradas', () => {
  it('sube y baja el contenido cifrado tal cual, y la otra cuenta no lo ve', async () => {
    const a = await nuevaCuenta();
    const b = await nuevaCuenta();
    const syncA = clienteSync(() => a.sesion.token);
    const ahora = entorno.reloj.ahora().toISOString();
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const datos = new Uint8Array(await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, a.claveDatos, new Uint8Array([1, 2, 3, 4])));

    const sinCaso = await errorDe(syncA.subirEvidencia({ id: 'evid-0000001', casoId: 'caso-evid-01', iv, mime: 'audio/webm;codecs=opus', actualizadoEn: ahora }, datos));
    expect(sinCaso).toMatchObject({ causa: 'caso_no_encontrado', estado: 404 });

    await syncA.subirCaso({ id: 'caso-evid-01', ...(await casoCifrado(a.claveDatos, 'caso-evid-01')), actualizadoEn: ahora });
    const subida = await syncA.subirEvidencia({ id: 'evid-0000001', casoId: 'caso-evid-01', iv, mime: 'audio/webm;codecs=opus', actualizadoEn: ahora }, datos);
    expect(subida).toMatchObject({ aplicado: true, actual: { tamano: datos.byteLength, mime: 'audio/webm;codecs=opus' } });

    await expect(syncA.listarEvidencias()).resolves.toHaveLength(1);
    const bajada = await syncA.bajarEvidencia('evid-0000001');
    expect(bajada?.datos).toEqual(datos);
    expect(bajada?.casoId).toBe('caso-evid-01');
    const claro = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: Uint8Array.from(Buffer.from(bajada!.iv, 'base64')) },
      a.claveDatos,
      bajada!.datos,
    );
    expect(new Uint8Array(claro)).toEqual(new Uint8Array([1, 2, 3, 4]));

    const syncB = clienteSync(() => b.sesion.token);
    await expect(syncB.bajarEvidencia('evid-0000001')).resolves.toBeNull();
    await expect(syncB.listarEvidencias()).resolves.toEqual([]);
    await expect(syncB.borrarEvidencia('evid-0000001')).resolves.toBe(false);

    // Borrar el caso elimina sus evidencias.
    await syncA.borrarCaso('caso-evid-01', entorno.reloj.ahora().toISOString());
    await expect(syncA.bajarEvidencia('evid-0000001')).resolves.toBeNull();
  });

  it('respeta el limite de tamano por evidencia y la cuota de la cuenta', async () => {
    const cuenta = await nuevaCuenta();
    const sync = clienteSync(() => cuenta.sesion.token);
    const ahora = entorno.reloj.ahora().toISOString();
    await sync.subirCaso({ id: 'caso-limite-01', ...(await casoCifrado(cuenta.claveDatos, 'caso-limite-01')), actualizadoEn: ahora });
    const meta = (id: string) => ({ id, casoId: 'caso-limite-01', iv: new Uint8Array(12), mime: 'image/jpeg', actualizadoEn: ahora });

    const grande = await errorDe(sync.subirEvidencia(meta('evid-grande-1'), new Uint8Array(entorno.config.maxBytesEvidencia + 1)));
    expect(grande).toMatchObject({ causa: 'muy_grande', estado: 413 });

    // Cuota de 10 000 bytes: dos de 4096 caben, la tercera no.
    await sync.subirEvidencia(meta('evid-cuota-01'), new Uint8Array(4096).fill(1));
    await sync.subirEvidencia(meta('evid-cuota-02'), new Uint8Array(4096).fill(2));
    await expect(errorDe(sync.subirEvidencia(meta('evid-cuota-03'), new Uint8Array(4096)))).resolves.toMatchObject({
      causa: 'cuota_excedida',
    });
    // Reemplazar una existente no cuenta doble.
    entorno.reloj.avanzar(1000);
    await expect(
      sync.subirEvidencia({ ...meta('evid-cuota-02'), actualizadoEn: entorno.reloj.ahora().toISOString() }, new Uint8Array(4000)),
    ).resolves.toMatchObject({ aplicado: true });
  });

  it('el limite por peticion corta cuerpos JSON enormes', async () => {
    const cuenta = await nuevaCuenta();
    const respuesta = await fetch(`${entorno.url}/api/casos/caso-enorme-01`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${cuenta.sesion.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ iv: 'AAAAAAAAAAAAAAAA', datos: 'A'.repeat(entorno.config.maxBytesJson + 10), actualizadoEn: '2026-11-09T10:00:00Z' }),
    });
    expect(respuesta.status).toBe(413);
  });
});

describe('borrar cuenta', () => {
  it('exige el PIN y borra cuenta, sesiones, casos y evidencias', async () => {
    const cuenta = await nuevaCuenta();
    const sync = clienteSync(() => cuenta.sesion.token);
    const ahora = entorno.reloj.ahora().toISOString();
    await sync.subirCaso({ id: 'caso-borrar-01', ...(await casoCifrado(cuenta.claveDatos, 'caso-borrar-01')), actualizadoEn: ahora });
    await sync.subirEvidencia({ id: 'evid-borrar-1', casoId: 'caso-borrar-01', iv: new Uint8Array(12), mime: 'image/png', actualizadoEn: ahora }, new Uint8Array(10));

    const cliente = clienteCuentas();
    await expect(errorDe(cliente.borrarCuentaConPin(cuenta.sesion.token, cuenta.celular, '000123'))).resolves.toMatchObject({
      causa: 'credenciales_invalidas',
    });
    await cliente.borrarCuentaConPin(cuenta.sesion.token, cuenta.celular, cuenta.pin);

    await expect(errorDe(sync.listarCasos())).resolves.toMatchObject({ causa: 'no_autorizado' });
    const restos = await entorno.bd.consultar<{ n: number }>(
      `SELECT (SELECT count(*) FROM cuentas WHERE celular = $1)
            + (SELECT count(*) FROM casos WHERE id = 'caso-borrar-01')
            + (SELECT count(*) FROM evidencias WHERE id = 'evid-borrar-1') AS n`,
      [cuenta.celular],
    );
    expect(Number(restos[0]?.n)).toBe(0);
  });
});

describe('limites y disponibilidad', () => {
  it('limita las peticiones de sesion por IP', async () => {
    const pequeno = await crearEntorno({ peticionesPorMinuto: 3 });
    try {
      const cliente = new ClienteCuentas({ baseUrl: pequeno.url, crypto: globalThis.crypto, enLinea: () => true });
      const verificador = Buffer.alloc(32).toString('base64');
      for (let i = 0; i < 3; i++) await errorDe(cliente.entrar('3001231234', verificador));
      const error = await errorDe(cliente.entrar('3001231234', verificador));
      expect(error).toMatchObject({ causa: 'limite_peticiones', estado: 429 });
    } finally {
      await pequeno.cerrar();
    }
  });

  it('si la base no arranca responde 503 y deja pasar las otras rutas', async () => {
    const manejador = crearManejadorDatos(() => Promise.reject(new Error('sin base')));
    const espia = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const servidor = createServer((req, res) => {
      void manejador.manejar(req, res).then((atendida) => {
        if (!atendida) {
          res.statusCode = 299;
          res.end();
        }
      });
    });
    await new Promise<void>((r) => servidor.listen(0, '127.0.0.1', r));
    const { port } = servidor.address() as AddressInfo;
    try {
      const datos = await fetch(`http://127.0.0.1:${port}/api/casos`);
      expect(datos.status).toBe(503);
      await expect(datos.json()).resolves.toMatchObject({ error: 'bd_no_disponible' });
      expect((await fetch(`http://127.0.0.1:${port}/api/asistente`)).status).toBe(299);
      // El log solo dice el tipo de error, no el mensaje.
      expect(espia.mock.calls.flat().join(' ')).not.toContain('sin base');
    } finally {
      espia.mockRestore();
      await new Promise<void>((r) => servidor.close(() => r()));
    }
  });
});
