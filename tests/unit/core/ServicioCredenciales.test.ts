import { CodificacionBase64 } from '../../../src/core/CodificacionBase64';
import { ServicioCredenciales } from '../../../src/core/ServicioCredenciales';

const ITERACIONES = 1000;

describe('ServicioCredenciales', () => {
  const servicio = new ServicioCredenciales(globalThis.crypto, { iteraciones: ITERACIONES });

  it('CA-01.6 la credencial solo tiene hash, sal e iteraciones; nunca el PIN', async () => {
    const pin = '482915';
    const cred = await servicio.crearCredencial(pin);
    expect(Object.keys(cred).sort()).toEqual(['algoritmo', 'hash', 'iteraciones', 'sal']);
    expect(cred.algoritmo).toBe('PBKDF2-SHA256');
    expect(cred.iteraciones).toBe(ITERACIONES);
    expect(CodificacionBase64.decodificar(cred.sal)).toHaveLength(16);
    expect(CodificacionBase64.decodificar(cred.hash)).toHaveLength(32);
    const serializada = JSON.stringify(cred);
    expect(serializada).not.toContain(pin);
    expect(serializada).not.toContain(CodificacionBase64.codificar(new TextEncoder().encode(pin)));
  });

  it('usa sal aleatoria: el mismo PIN da hashes distintos', async () => {
    const a = await servicio.crearCredencial('482915');
    const b = await servicio.crearCredencial('482915');
    expect(a.sal).not.toBe(b.sal);
    expect(a.hash).not.toBe(b.hash);
  });

  it('verifica el PIN correcto y rechaza el incorrecto', async () => {
    const cred = await servicio.crearCredencial('482915');
    await expect(servicio.verificar('482915', cred)).resolves.toBe(true);
    await expect(servicio.verificar('482916', cred)).resolves.toBe(false);
    await expect(servicio.verificar('', cred)).resolves.toBe(false);
  });

  it('verifica con las iteraciones guardadas aunque el servicio cambie', async () => {
    const cred = await servicio.crearCredencial('482915');
    const otro = new ServicioCredenciales(globalThis.crypto, { iteraciones: 2000 });
    await expect(otro.verificar('482915', cred)).resolves.toBe(true);
  });

  it('rechaza credenciales mal formadas o alteradas sin lanzar', async () => {
    const cred = await servicio.crearCredencial('482915');
    await expect(servicio.verificar('482915', { ...cred, hash: 'no-es-base64!' })).resolves.toBe(false);
    await expect(servicio.verificar('482915', { ...cred, iteraciones: 1001 })).resolves.toBe(false);
    await expect(
      servicio.verificar('482915', { ...cred, algoritmo: 'MD5' } as never),
    ).resolves.toBe(false);
  });

  it('por defecto usa 600000 iteraciones y rechaza valores invalidos', () => {
    expect(new ServicioCredenciales(globalThis.crypto).iteraciones).toBe(600000);
    expect(() => new ServicioCredenciales(globalThis.crypto, { iteraciones: 0 })).toThrow(RangeError);
  });

  it('compara en tiempo constante sin cortar en el primer byte distinto', () => {
    const igual = ServicioCredenciales.igualesTiempoConstante;
    expect(igual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true);
    expect(igual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false);
    expect(igual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 0]))).toBe(false);
  });
});
