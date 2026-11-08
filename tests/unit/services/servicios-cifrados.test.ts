import 'fake-indexeddb/auto';

import { webcrypto } from 'node:crypto';

import { Caso } from '../../../src/core/Caso';
import { CodificacionBase64 } from '../../../src/core/CodificacionBase64';
import { Evidencia } from '../../../src/core/Evidencia';
import { GestorClaves } from '../../../src/core/GestorClaves';
import { AlmacenCifrado } from '../../../src/services/AlmacenCifrado';
import { ErrorSinSesion, RepositorioCasos, type DatosNuevoCaso } from '../../../src/services/RepositorioCasos';
import { ErrorCuenta, ServicioCuenta } from '../../../src/services/ServicioCuenta';

const crypto = webcrypto as unknown as Crypto;
const ITERACIONES = 1000;
const PIN = '482915';
const NOMBRE = 'Rosa Elena Prueba';
const CELULAR = '3001234567';
const NOTA = 'El agente no me mostró el equipo de medición';

let contador = 0;
function preparar(opciones: { bloqueoMs?: number; reloj?: () => Date } = {}) {
  // Base distinta por prueba para que no se mezclen datos.
  const nombreBase = `vozvial-prueba-${++contador}`;
  const gestor = new GestorClaves(crypto, { iteraciones: ITERACIONES });
  const almacen = new AlmacenCifrado(gestor, crypto, nombreBase);
  const cuenta = new ServicioCuenta(almacen, { crypto, iteraciones: ITERACIONES, ...opciones });
  let clave: CryptoKey | null = null;
  const repositorio = new RepositorioCasos(almacen, () => clave, crypto);
  return { nombreBase, almacen, cuenta, repositorio, fijarClave: (k: CryptoKey | null) => (clave = k) };
}

/** Vuelca todos los stores en texto, con los binarios en base64 y tambien decodificados como UTF-8. */
async function volcarBase(nombreBase: string): Promise<string> {
  const db = await new Promise<IDBDatabase>((ok, mal) => {
    const s = indexedDB.open(nombreBase);
    s.onsuccess = () => ok(s.result);
    s.onerror = () => mal(s.error);
  });
  const partes: string[] = [];
  for (const store of Array.from(db.objectStoreNames)) {
    const valores = await new Promise<unknown[]>((ok, mal) => {
      const s = db.transaction(store, 'readonly').objectStore(store).getAll();
      s.onsuccess = () => ok(s.result as unknown[]);
      s.onerror = () => mal(s.error);
    });
    partes.push(
      JSON.stringify(valores, (_k, v: unknown) => {
        if (v instanceof ArrayBuffer || ArrayBuffer.isView(v)) {
          const bytes = v instanceof ArrayBuffer ? new Uint8Array(v) : new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
          return `${CodificacionBase64.codificar(bytes)} ${new TextDecoder().decode(bytes)}`;
        }
        return v;
      }),
    );
  }
  db.close();
  return partes.join('\n');
}

function casoBase(): DatosNuevoCaso {
  return { ubicacion: null, motivoSinUbicacion: 'denegada' };
}

describe('ServicioCuenta', () => {
  it('crea la cuenta y devuelve un codigo de 12 caracteres en grupos de 4', async () => {
    const { cuenta } = preparar();
    expect(await cuenta.existeCuenta()).toBe(false);
    const creada = await cuenta.crearCuenta({ nombre: NOMBRE, celular: CELULAR, pin: PIN });
    expect(creada.codigoRecuperacion).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(creada.perfil).toEqual({ nombre: NOMBRE, celular: CELULAR });
    expect(await cuenta.existeCuenta()).toBe(true);
    await expect(cuenta.crearCuenta({ nombre: NOMBRE, celular: CELULAR, pin: PIN })).rejects.toBeInstanceOf(ErrorCuenta);
  });

  it('rechaza datos invalidos con los errores del validador', async () => {
    const { cuenta } = preparar();
    await expect(cuenta.crearCuenta({ nombre: NOMBRE, celular: '123', pin: '123456' })).rejects.toMatchObject({
      motivo: 'datos_invalidos',
      errores: expect.arrayContaining([expect.objectContaining({ campo: 'celular' }), expect.objectContaining({ campo: 'pin' })]),
    });
    expect(await cuenta.existeCuenta()).toBe(false);
  });

  it('entra con el PIN correcto y devuelve el perfil descifrado', async () => {
    const { cuenta } = preparar();
    await cuenta.crearCuenta({ nombre: NOMBRE, celular: CELULAR, pin: PIN });
    const r = await cuenta.entrar(PIN);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.perfil.nombre).toBe(NOMBRE);
  });

  it('cuenta los fallos, bloquea al quinto y libera cuando vence el tiempo', async () => {
    let ahora = new Date('2026-11-08T10:00:00Z').getTime();
    const { cuenta } = preparar({ bloqueoMs: 3000, reloj: () => new Date(ahora) });
    await cuenta.crearCuenta({ nombre: NOMBRE, celular: CELULAR, pin: PIN });
    for (const restantes of [4, 3, 2, 1]) {
      expect(await cuenta.entrar('000001')).toEqual({ ok: false, bloqueado: false, intentosRestantes: restantes });
    }
    expect(await cuenta.entrar('000001')).toEqual({ ok: false, bloqueado: true, msRestantes: 3000 });
    // Bloqueado incluso con el PIN correcto.
    expect(await cuenta.entrar(PIN)).toMatchObject({ ok: false, bloqueado: true });
    expect(await cuenta.estadoIntentos()).toMatchObject({ bloqueado: true });
    ahora += 3000;
    expect((await cuenta.entrar(PIN)).ok).toBe(true);
  });

  it('recupera con el codigo, cambia el PIN y conserva los casos', async () => {
    const { cuenta, repositorio, fijarClave } = preparar();
    const creada = await cuenta.crearCuenta({ nombre: NOMBRE, celular: CELULAR, pin: PIN });
    fijarClave(creada.claveDatos);
    const caso = await repositorio.crear(casoBase());

    const malo = await cuenta.recuperar('ABCD-EFGH-JKMN', '730518');
    expect(malo).toMatchObject({ ok: false, error: 'codigo_incorrecto' });
    expect((await cuenta.entrar(PIN)).ok).toBe(true);

    const r = await cuenta.recuperar(creada.codigoRecuperacion.toLowerCase(), '730518');
    expect(r.ok).toBe(true);
    expect((await cuenta.entrar(PIN)).ok).toBe(false);
    const entrada = await cuenta.entrar('730518');
    expect(entrada.ok).toBe(true);
    if (!entrada.ok) return;
    fijarClave(entrada.claveDatos);
    expect((await repositorio.obtener(caso.id))?.id).toBe(caso.id);
  });

  it('borrarTodo exige el PIN y elimina la cuenta', async () => {
    const { cuenta } = preparar();
    await cuenta.crearCuenta({ nombre: NOMBRE, celular: CELULAR, pin: PIN });
    await expect(cuenta.borrarTodo('000001')).rejects.toMatchObject({ motivo: 'pin_incorrecto' });
    await cuenta.borrarTodo(PIN);
    expect(await cuenta.existeCuenta()).toBe(false);
  });
});

describe('RepositorioCasos y AlmacenCifrado', () => {
  it('sin sesion no lee ni guarda casos', async () => {
    const { repositorio } = preparar();
    await expect(repositorio.listar()).rejects.toBeInstanceOf(ErrorSinSesion);
  });

  it('guarda, lista, agrega evidencias con contenido y borra en cascada', async () => {
    const { cuenta, repositorio, fijarClave, nombreBase } = preparar();
    const { claveDatos } = await cuenta.crearCuenta({ nombre: NOMBRE, celular: CELULAR, pin: PIN });
    fijarClave(claveDatos);
    const viejo = await repositorio.crear({ ...casoBase(), creadoEn: '2026-11-01T10:00:00.000Z' });
    let caso = await repositorio.crear(casoBase());
    expect((await repositorio.listar()).map((c) => c.id)).toEqual([caso.id, viejo.id]);

    const audio = new TextEncoder().encode('contenido de audio de prueba');
    caso = await repositorio.agregarEvidencia(
      caso,
      Evidencia.crear({ id: 'ev-audio', tipo: 'audio', creadaEn: new Date().toISOString(), mime: 'audio/webm', tamano: audio.length }),
      audio,
    );
    caso = await repositorio.agregarEvidencia(
      caso,
      Evidencia.crear({ id: 'ev-nota', tipo: 'nota', creadaEn: new Date().toISOString(), texto: NOTA }),
    );
    const leido = await repositorio.obtener(caso.id);
    expect(leido).toBeInstanceOf(Caso);
    expect(leido?.buscarEvidencia('ev-nota')?.texto).toBe(NOTA);
    expect(new TextDecoder().decode(await repositorio.leerContenido('ev-audio'))).toBe('contenido de audio de prueba');

    await repositorio.borrar(caso.id);
    expect(await repositorio.obtener(caso.id)).toBeNull();
    await expect(repositorio.leerContenido('ev-audio')).rejects.toThrow();
    expect((await repositorio.listar()).map((c) => c.id)).toEqual([viejo.id]);
    expect(await volcarBase(nombreBase)).not.toContain('ev-audio');
  });

  it('en el almacen no aparece el PIN, el nombre, el celular ni el texto de una nota', async () => {
    const { cuenta, repositorio, fijarClave, nombreBase } = preparar();
    const { claveDatos } = await cuenta.crearCuenta({ nombre: NOMBRE, celular: CELULAR, pin: PIN });
    fijarClave(claveDatos);
    const caso = await repositorio.crear(casoBase());
    const bytes = new TextEncoder().encode(`foto ${NOTA}`);
    await repositorio.agregarEvidencia(
      caso,
      Evidencia.crear({ id: 'ev-foto', tipo: 'foto', creadaEn: new Date().toISOString(), mime: 'image/jpeg', tamano: bytes.length }),
      bytes,
    );
    const conNota = await repositorio.obtener(caso.id);
    await repositorio.agregarEvidencia(
      conNota!,
      Evidencia.crear({ id: 'ev-nota', tipo: 'nota', creadaEn: new Date().toISOString(), texto: NOTA }),
    );

    const volcado = await volcarBase(nombreBase);
    expect(volcado).toContain('PBKDF2-SHA256');
    for (const secreto of [PIN, NOMBRE, 'Rosa', CELULAR, NOTA, 'agente']) {
      expect(volcado).not.toContain(secreto);
    }
  });

  it('una clave distinta no puede descifrar los casos', async () => {
    const { cuenta, repositorio, fijarClave } = preparar();
    const { claveDatos } = await cuenta.crearCuenta({ nombre: NOMBRE, celular: CELULAR, pin: PIN });
    fijarClave(claveDatos);
    const caso = await repositorio.crear(casoBase());
    fijarClave(await new GestorClaves(crypto, { iteraciones: ITERACIONES }).generarClaveDatos());
    await expect(repositorio.obtener(caso.id)).rejects.toThrow();
  });
});
