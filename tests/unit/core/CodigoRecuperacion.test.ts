import { CodigoRecuperacion } from '../../../src/core/CodigoRecuperacion';

describe('CodigoRecuperacion', () => {
  it('CA-01.1 genera codigos de 12 caracteres sin simbolos ambiguos', () => {
    const vistos = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const codigo = CodigoRecuperacion.generar(globalThis.crypto);
      expect(codigo).toHaveLength(12);
      expect(codigo).toMatch(/^[A-Z2-9]{12}$/);
      expect(codigo).not.toMatch(/[01OIL]/);
      expect(CodigoRecuperacion.esValido(codigo)).toBe(true);
      vistos.add(codigo);
    }
    expect(vistos.size).toBe(200);
  });

  it('el alfabeto tiene 31 simbolos y excluye 0, O, 1, I y L', () => {
    expect(CodigoRecuperacion.ALFABETO).toHaveLength(31);
    for (const s of '0O1IL') expect(CodigoRecuperacion.ALFABETO).not.toContain(s);
  });

  it('normaliza lo que escribe el usuario', () => {
    expect(CodigoRecuperacion.normalizar(' abcd-efgh jkmn ')).toBe('ABCDEFGHJKMN');
    expect(CodigoRecuperacion.esValido('abcd efgh jkmn')).toBe(true);
    expect(CodigoRecuperacion.esValido('ABCD-EFGH-JKM')).toBe(false);
    expect(CodigoRecuperacion.esValido('ABCD-EFGH-JKM0')).toBe(false);
  });

  it('formatea en grupos de 4', () => {
    expect(CodigoRecuperacion.formatear('abcdefghjkmn')).toBe('ABCD-EFGH-JKMN');
  });
});
