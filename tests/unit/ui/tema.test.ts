import { colores, escalaTipografica, PARES_CONTROL, PARES_TEXTO, razonContraste, TAMANOS_LETRA } from '../../../src/ui/tema';

describe('tema accesible', () => {
  test.each(PARES_TEXTO)('texto %s sobre %s cumple WCAG AA (4,5:1)', (frente, fondo) => {
    expect(razonContraste(colores[frente], colores[fondo])).toBeGreaterThanOrEqual(4.5);
  });

  test.each(PARES_CONTROL)('borde %s sobre %s cumple 3:1', (frente, fondo) => {
    expect(razonContraste(colores[frente], colores[fondo])).toBeGreaterThanOrEqual(3);
  });

  test('razon de contraste conocida: negro sobre blanco es 21', () => {
    expect(razonContraste('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
  });

  test('los tamanos base son 18, 22 y 26 px (CA-04.1)', () => {
    expect(TAMANOS_LETRA.map((t) => t.base)).toEqual([18, 22, 26]);
  });

  test('ningun texto de la escala baja de 18 px', () => {
    for (const { base } of TAMANOS_LETRA) {
      const e = escalaTipografica(base);
      expect(Math.min(e.base, e.nota, e.subtitulo, e.titulo, e.tituloPantalla, e.destacado)).toBeGreaterThanOrEqual(18);
    }
  });
});
