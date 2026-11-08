import { CodificacionBase64 } from '../../../src/core/CodificacionBase64';

describe('CodificacionBase64', () => {
  it.each([0, 1, 2, 3, 4, 5, 31, 32, 33, 100])('coincide con Buffer para %i bytes', (n) => {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(n));
    const texto = CodificacionBase64.codificar(bytes);
    expect(texto).toBe(Buffer.from(bytes).toString('base64'));
    expect(CodificacionBase64.decodificar(texto)).toEqual(bytes);
  });

  it('rechaza texto que no es base64', () => {
    expect(() => CodificacionBase64.decodificar('abc')).toThrow(TypeError);
    expect(() => CodificacionBase64.decodificar('ab!d')).toThrow(TypeError);
  });
});
