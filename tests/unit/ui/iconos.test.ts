import { ICONOS, NOMBRES_ICONOS } from '../../../src/ui/iconos';

describe('iconos propios', () => {
  test('cada icono tiene al menos una forma', () => {
    for (const nombre of NOMBRES_ICONOS) expect(ICONOS[nombre].length).toBeGreaterThan(0);
  });

  test('circulos y rectangulos quedan dentro de la reticula de 24 x 24 y las rutas empiezan con M', () => {
    for (const nombre of NOMBRES_ICONOS) {
      for (const f of ICONOS[nombre]) {
        if (f.t === 'path') {
          expect(f.d.startsWith('M')).toBe(true);
          continue;
        }
        const [x0, y0, x1, y1] = f.t === 'circle' ? [f.cx - f.r, f.cy - f.r, f.cx + f.r, f.cy + f.r] : [f.x, f.y, f.x + f.w, f.y + f.h];
        expect(Math.min(x0, y0)).toBeGreaterThanOrEqual(0);
        expect(Math.max(x1, y1)).toBeLessThanOrEqual(24);
      }
    }
  });

  test('estan los iconos que usa el sistema de diseno', () => {
    for (const nombre of ['volver', 'escuchar', 'detener', 'microfono', 'casos', 'comparendo', 'ley', 'alerta', 'info', 'check', 'siguiente'])
      expect(NOMBRES_ICONOS).toContain(nombre);
  });
});
