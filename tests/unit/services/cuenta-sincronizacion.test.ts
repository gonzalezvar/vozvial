import 'fake-indexeddb/auto';

import { webcrypto } from 'node:crypto';

import { Evidencia } from '../../../src/core/Evidencia';
import { GestorClaves } from '../../../src/core/GestorClaves';
import { AlmacenCifrado } from '../../../src/services/AlmacenCifrado';
import { RepositorioCasos } from '../../../src/services/RepositorioCasos';
import { ErrorCuenta, ServicioCuenta } from '../../../src/services/ServicioCuenta';
import { SincronizadorCasos, type EstadoSincronizacion } from '../../../src/services/SincronizadorCasos';
import { ServidorFalso } from './servidorFalso';

const crypto = webcrypto as unknown as Crypto;
const ITERACIONES = 1000;
const PIN = '482915';
const PIN_NUEVO = '739164';
const NOMBRE = 'Rosa Elena Prueba';
const CELULAR = '3001234567';
const NOTA = 'El agente no me mostró el equipo de medición';

let contador = 0;

/** Un "dispositivo": su propia base IndexedDB, su cuenta, su repositorio y su sincronizador contra el mismo servidor. */
function dispositivo(servidor: ServidorFalso) {
  const nombreBase = `vozvial-sync-${++contador}`;
  const gestor = new GestorClaves(crypto, { iteraciones: ITERACIONES });
  const almacen = new AlmacenCifrado(gestor, crypto, nombreBase);
  const cuenta = new ServicioCuenta(almacen, { crypto, iteraciones: ITERACIONES, remoto: servidor.cuentasRemotas() });
  const sesion = { clave: null as CryptoKey | null, token: null as string | null };
  const estados: EstadoSincronizacion[] = [];
  const reintentos: (() => void)[] = [];
  let cambios = 0;
  const sincronizador = new SincronizadorCasos({
    almacen,
    gestor,
    remoto: servidor.sincronizacion(() => sesion.token),
    obtenerClave: () => sesion.clave,
    alCambiarEstado: (e) => estados.push(e),
    alCambiarDatos: () => cambios++,
    programar: (fn) => {
      reintentos.push(fn);
      return () => undefined;
    },
  });
  const repositorio = new RepositorioCasos(almacen, () => sesion.clave, crypto, () => new Date(), () =>
    sesion.token ? sincronizador : null,
  );
  return {
    nombreBase,
    almacen,
    cuenta,
    repositorio,
    sincronizador,
    sesion,
    estados,
    reintentos,
    cambios: () => cambios,
    abrir(clave: CryptoKey, token: string | null) {
      sesion.clave = clave;
      sesion.token = token;
    },
  };
}

/** Espera a que terminen las subidas que el repositorio lanza en segundo plano. */
async function esperarFila(s: SincronizadorCasos): Promise<void> {
  await s.sincronizarTodo();
}

describe('ServicioCuenta con el servidor', () => {
  it('crea la cuenta en el servidor y en el dispositivo sin enviar el PIN, el codigo ni el nombre', async () => {
    const servidor = new ServidorFalso(crypto);
    const a = dispositivo(servidor);
    const creada = await a.cuenta.crearCuenta({ nombre: NOMBRE, celular: CELULAR, pin: PIN });

    expect(creada.respaldo).toBe('servidor');
    expect(creada.sesion?.token).toEqual(expect.any(String));
    expect(await a.cuenta.estadoServidor()).toBe('registrada');
    const guardada = servidor.cuentas.get(CELULAR);
    expect(guardada?.verificadorPin).toEqual(expect.any(String));
    const enviado = servidor.recibido.join('\n');
    expect(enviado).not.toContain(PIN);
    expect(enviado).not.toContain(NOMBRE);
    expect(enviado).not.toContain(creada.codigoRecuperacion.replace(/-/g, ''));
  });

  it('si el celular ya tiene cuenta en el servidor no crea nada en el dispositivo', async () => {
    const servidor = new ServidorFalso(crypto);
    await dispositivo(servidor).cuenta.crearCuenta({ nombre: NOMBRE, celular: CELULAR, pin: PIN });
    const b = dispositivo(servidor);
    await expect(b.cuenta.crearCuenta({ nombre: 'Otra Persona', celular: CELULAR, pin: PIN_NUEVO })).rejects.toMatchObject({
      motivo: 'celular_en_uso',
    });
    expect(await b.cuenta.existeCuenta()).toBe(false);
  });

  it('sin conexion crea la cuenta pendiente y la registra al entrar con internet', async () => {
    const servidor = new ServidorFalso(crypto);
    servidor.enLinea = false;
    const a = dispositivo(servidor);
    const creada = await a.cuenta.crearCuenta({ nombre: NOMBRE, celular: CELULAR, pin: PIN });
    expect(creada.respaldo).toBe('pendiente');
    expect(creada.sesion).toBeNull();
    expect(await a.cuenta.estadoServidor()).toBe('pendiente');

    servidor.enLinea = true;
    const entrada = await a.cuenta.entrar(PIN);
    if (!entrada.ok) throw new Error('debia entrar');
    const conexion = await a.cuenta.conectarServidor(PIN, entrada.perfil);
    expect(conexion.estado).toBe('registrada');
    expect(conexion.sesion?.token).toEqual(expect.any(String));
    expect(await a.almacen.leerCuenta()).toMatchObject({ servidor: { estado: 'registrada' } });
    expect((await a.almacen.leerCuenta())?.servidor?.registroPendiente).toBeUndefined();

    // El codigo que vio la persona sirve en el servidor: recupera desde otro dispositivo.
    const b = dispositivo(servidor);
    const r = await b.cuenta.recuperar(creada.codigoRecuperacion, PIN_NUEVO, CELULAR);
    expect(r.ok).toBe(true);
  });

  it('entra en otro dispositivo con celular y PIN, y luego solo con el PIN', async () => {
    const servidor = new ServidorFalso(crypto);
    await dispositivo(servidor).cuenta.crearCuenta({ nombre: NOMBRE, celular: CELULAR, pin: PIN });

    const b = dispositivo(servidor);
    const mal = await b.cuenta.entrarConCelular(CELULAR, '000001');
    expect(mal).toMatchObject({ ok: false, motivo: 'credenciales', intentosRestantes: 4 });
    expect(await b.cuenta.existeCuenta()).toBe(false);

    const r = await b.cuenta.entrarConCelular('300 123 4567', PIN);
    if (!r.ok) throw new Error('debia entrar');
    expect(r.perfil).toEqual({ nombre: NOMBRE, celular: CELULAR });
    expect(r.sesion.token).toEqual(expect.any(String));
    const local = await b.cuenta.entrar(PIN);
    expect(local).toMatchObject({ ok: true, perfil: { nombre: NOMBRE } });
  });

  it('valida el celular antes de llamar al servidor', async () => {
    const b = dispositivo(new ServidorFalso(crypto));
    expect(await b.cuenta.entrarConCelular('12345', PIN)).toMatchObject({ ok: false, motivo: 'celular_invalido' });
  });

  it('recuperar en el dispositivo cambia tambien el PIN del servidor', async () => {
    const servidor = new ServidorFalso(crypto);
    const a = dispositivo(servidor);
    const { codigoRecuperacion } = await a.cuenta.crearCuenta({ nombre: NOMBRE, celular: CELULAR, pin: PIN });
    const r = await a.cuenta.recuperar(codigoRecuperacion.toLowerCase(), PIN_NUEVO);
    expect(r).toMatchObject({ ok: true, aviso: null });
    if (r.ok) expect(r.sesion?.token).toEqual(expect.any(String));

    const b = dispositivo(servidor);
    expect(await b.cuenta.entrarConCelular(CELULAR, PIN)).toMatchObject({ ok: false, motivo: 'credenciales' });
    expect(await b.cuenta.entrarConCelular(CELULAR, PIN_NUEVO)).toMatchObject({ ok: true });
  });

  it('recuperar sin internet cambia el PIN solo en el dispositivo y lo avisa', async () => {
    const servidor = new ServidorFalso(crypto);
    const a = dispositivo(servidor);
    const { codigoRecuperacion } = await a.cuenta.crearCuenta({ nombre: NOMBRE, celular: CELULAR, pin: PIN });
    servidor.enLinea = false;
    const r = await a.cuenta.recuperar(codigoRecuperacion, PIN_NUEVO);
    expect(r).toMatchObject({ ok: true, sesion: null, aviso: expect.stringContaining('cuando tengas internet') });
    expect(await a.cuenta.estadoServidor()).toBe('pin_distinto');
    expect(await a.cuenta.entrar(PIN_NUEVO)).toMatchObject({ ok: true });
  });

  it('recupera desde un dispositivo nuevo con celular y codigo; un codigo ajeno se rechaza', async () => {
    const servidor = new ServidorFalso(crypto);
    const { codigoRecuperacion } = await dispositivo(servidor).cuenta.crearCuenta({ nombre: NOMBRE, celular: CELULAR, pin: PIN });
    const b = dispositivo(servidor);
    const ajeno = (codigoRecuperacion[0] === 'A' ? 'B' : 'A') + codigoRecuperacion.slice(1);
    expect(await b.cuenta.recuperar(ajeno, PIN_NUEVO, CELULAR)).toMatchObject({ ok: false, error: 'codigo_incorrecto' });
    expect(await b.cuenta.existeCuenta()).toBe(false);

    const r = await b.cuenta.recuperar(codigoRecuperacion, PIN_NUEVO, CELULAR);
    expect(r).toMatchObject({ ok: true, perfil: { nombre: NOMBRE } });
    expect(await b.cuenta.entrar(PIN_NUEVO)).toMatchObject({ ok: true });
  });

  it('borrarTodo borra la cuenta del servidor y del dispositivo; con PIN incorrecto no borra nada', async () => {
    const servidor = new ServidorFalso(crypto);
    const a = dispositivo(servidor);
    const creada = await a.cuenta.crearCuenta({ nombre: NOMBRE, celular: CELULAR, pin: PIN });
    await expect(a.cuenta.borrarTodo('000001', creada.sesion?.token)).rejects.toBeInstanceOf(ErrorCuenta);
    expect(servidor.cuentas.has(CELULAR)).toBe(true);

    // Sin internet no borra nada: asi no queda una copia en el servidor que la persona crea borrada.
    servidor.enLinea = false;
    await expect(a.cuenta.borrarTodo(PIN, creada.sesion?.token)).rejects.toMatchObject({ motivo: 'servidor_no_disponible' });
    expect(await a.cuenta.existeCuenta()).toBe(true);

    servidor.enLinea = true;
    await a.cuenta.borrarTodo(PIN, creada.sesion?.token);
    expect(servidor.cuentas.has(CELULAR)).toBe(false);
    expect(await a.cuenta.existeCuenta()).toBe(false);
  });
});

describe('SincronizadorCasos', () => {
  async function cuentaEnDosDispositivos() {
    const servidor = new ServidorFalso(crypto);
    const a = dispositivo(servidor);
    const creada = await a.cuenta.crearCuenta({ nombre: NOMBRE, celular: CELULAR, pin: PIN });
    a.abrir(creada.claveDatos, creada.sesion!.token);
    const b = dispositivo(servidor);
    const entrada = await b.cuenta.entrarConCelular(CELULAR, PIN);
    if (!entrada.ok) throw new Error('debia entrar');
    b.abrir(entrada.claveDatos, entrada.sesion.token);
    return { servidor, a, b };
  }

  it('un caso con evidencias guardado en un dispositivo aparece completo en el otro', async () => {
    const { servidor, a, b } = await cuentaEnDosDispositivos();
    const audio = new TextEncoder().encode('contenido de audio de prueba');
    let caso = await a.repositorio.crear({ ubicacion: null, motivoSinUbicacion: 'denegada' });
    caso = await a.repositorio.agregarEvidencia(
      caso,
      Evidencia.crear({ id: 'ev-audio', tipo: 'audio', creadaEn: new Date().toISOString(), mime: 'audio/webm', tamano: audio.length }),
      audio,
    );
    await a.repositorio.agregarEvidencia(caso, Evidencia.crear({ id: 'ev-nota', tipo: 'nota', creadaEn: new Date().toISOString(), texto: NOTA }));
    await esperarFila(a.sincronizador);

    // Al servidor solo llego material cifrado.
    const enviado = servidor.recibido.join('\n');
    expect(enviado).not.toContain(NOTA);
    expect(enviado).not.toContain('contenido de audio');
    expect(servidor.casos.get(CELULAR)?.size).toBe(1);
    expect(servidor.evidencias.get(CELULAR)?.size).toBe(1);

    const resumen = await b.sincronizador.sincronizarTodo();
    expect(resumen).toMatchObject({ bajados: 1, evidenciasBajadas: 1 });
    expect(b.cambios()).toBeGreaterThan(0);
    const [enB] = await b.repositorio.listar();
    expect(enB?.id).toBe(caso.id);
    expect(enB?.buscarEvidencia('ev-nota')?.texto).toBe(NOTA);
    expect(new TextDecoder().decode(await b.repositorio.leerContenido('ev-audio'))).toBe('contenido de audio de prueba');
    expect(b.estados.at(-1)).toBe('al_dia');
  });

  it('borrar un caso en un dispositivo lo borra del servidor y del otro dispositivo', async () => {
    const { servidor, a, b } = await cuentaEnDosDispositivos();
    const caso = await a.repositorio.crear({ ubicacion: null, motivoSinUbicacion: 'denegada' });
    await esperarFila(a.sincronizador);
    await b.sincronizador.sincronizarTodo();
    expect(await b.repositorio.listar()).toHaveLength(1);

    await b.repositorio.borrar(caso.id);
    await esperarFila(b.sincronizador);
    expect(servidor.casos.get(CELULAR)?.get(caso.id)?.borrado).toBe(true);

    const resumen = await a.sincronizador.sincronizarTodo();
    expect(resumen?.borradosLocal).toBe(1);
    expect(await a.repositorio.listar()).toHaveLength(0);
  });

  it('gana el cambio mas reciente', async () => {
    const { a, b } = await cuentaEnDosDispositivos();
    const caso = await a.repositorio.crear({ ubicacion: null, motivoSinUbicacion: 'denegada' });
    await esperarFila(a.sincronizador);
    await b.sincronizador.sincronizarTodo();
    const enB = (await b.repositorio.obtener(caso.id))!;
    await new Promise((r) => setTimeout(r, 5));
    await b.repositorio.agregarEvidencia(enB, Evidencia.crear({ id: 'ev-b', tipo: 'nota', creadaEn: new Date().toISOString(), texto: 'Nota de B' }));
    await esperarFila(b.sincronizador);

    await a.sincronizador.sincronizarTodo();
    expect((await a.repositorio.obtener(caso.id))?.buscarEvidencia('ev-b')?.texto).toBe('Nota de B');
  });

  it('sin conexion deja el cambio en el dispositivo, avisa y lo sube al reintentar', async () => {
    const { servidor, a } = await cuentaEnDosDispositivos();
    servidor.enLinea = false;
    const caso = await a.repositorio.crear({ ubicacion: null, motivoSinUbicacion: 'denegada' });
    await esperarFila(a.sincronizador);
    expect(a.estados.at(-1)).toBe('sin_conexion');
    expect(await a.repositorio.obtener(caso.id)).not.toBeNull();
    expect(a.reintentos.length).toBeGreaterThan(0);

    servidor.enLinea = true;
    a.reintentos.at(-1)!();
    await esperarFila(a.sincronizador);
    expect(servidor.casos.get(CELULAR)?.has(caso.id)).toBe(true);
    expect(a.estados.at(-1)).toBe('al_dia');
  });

  it('detenido no vuelve a tocar el servidor', async () => {
    const { a } = await cuentaEnDosDispositivos();
    a.sincronizador.detener();
    expect(await a.sincronizador.sincronizarTodo()).toBeNull();
  });
});
