import {
  colores,
  elevacion,
  escalaTipografica,
  espacio,
  PARES_CONTROL,
  PARES_TEXTO,
  peso,
  razonContraste,
  TAMANOS_LETRA,
} from '../../../src/ui/tema';

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

  test('todos los colores son #RRGGBB', () => {
    for (const valor of Object.values(colores)) expect(valor).toMatch(/^#[0-9A-F]{6}$/);
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

  test('la escala crece en orden: nota <= base < subtitulo < titulo < tituloPantalla < destacado', () => {
    for (const { base } of TAMANOS_LETRA) {
      const e = escalaTipografica(base);
      expect(e.nota).toBeLessThanOrEqual(e.base);
      expect(e.base).toBeLessThan(e.subtitulo);
      expect(e.subtitulo).toBeLessThan(e.titulo);
      expect(e.titulo).toBeLessThan(e.tituloPantalla);
      expect(e.tituloPantalla).toBeLessThan(e.destacado);
    }
  });

  test('interlineado: 1,5 en texto corrido y 1,25 en titulos', () => {
    const e = escalaTipografica(18);
    expect(e.alturaLinea(e.base)).toBe(27);
    expect(e.alturaLinea(e.tituloPantalla) / e.tituloPantalla).toBeCloseTo(1.25, 1);
  });

  test('tres pesos de letra y ninguno por encima de 700', () => {
    expect(Object.values(peso)).toHaveLength(3);
    for (const p of Object.values(peso)) expect(Number(p)).toBeLessThanOrEqual(700);
  });

  test('el espaciado va en multiplos de 4 px', () => {
    for (const v of Object.values(espacio)) expect(v % 4).toBe(0);
  });

  test('las sombras son suaves (alfa menor a 0,08)', () => {
    for (const nivel of Object.values(elevacion)) {
      const sombra = (nivel as { boxShadow?: string }).boxShadow;
      if (!sombra) continue;
      const alfa = Number(/rgba\([^)]*,\s*([\d.]+)\)/.exec(sombra)?.[1]);
      expect(alfa).toBeLessThan(0.08);
    }
  });
});
