import { ResolvedorSincronizacion, type MarcaRegistro } from '../../../src/core/ResolvedorSincronizacion';

const m = (id: string, actualizadoEn: string, borrado = false): MarcaRegistro => ({ id, actualizadoEn, borrado });

describe('ResolvedorSincronizacion', () => {
  it('sube lo que solo esta en el dispositivo y baja lo que solo esta en el servidor', () => {
    const plan = ResolvedorSincronizacion.planear([m('a', '2026-11-08T10:00:00Z')], [m('b', '2026-11-08T09:00:00Z')]);
    expect(plan.subir.map((r) => r.id)).toEqual(['a']);
    expect(plan.bajar.map((r) => r.id)).toEqual(['b']);
    expect(plan.borrarLocal).toEqual([]);
  });

  it('gana el mas reciente por actualizadoEn', () => {
    const plan = ResolvedorSincronizacion.planear(
      [m('a', '2026-11-08T10:00:00Z'), m('b', '2026-11-08T08:00:00Z'), m('c', '2026-11-08T08:00:00Z')],
      [m('a', '2026-11-08T09:00:00Z'), m('b', '2026-11-08T09:00:00Z'), m('c', '2026-11-08T08:00:00.000Z')],
    );
    expect(plan.subir.map((r) => r.id)).toEqual(['a']);
    expect(plan.bajar.map((r) => r.id)).toEqual(['b']);
  });

  it('un borrado mas nuevo en el servidor borra la copia local', () => {
    const plan = ResolvedorSincronizacion.planear([m('a', '2026-11-08T08:00:00Z')], [m('a', '2026-11-08T09:00:00Z', true)]);
    expect(plan.borrarLocal.map((r) => r.id)).toEqual(['a']);
    expect(plan.bajar).toEqual([]);
  });

  it('un borrado local mas nuevo se sube; uno que el servidor no conoce se ignora', () => {
    const plan = ResolvedorSincronizacion.planear(
      [m('a', '2026-11-08T10:00:00Z', true), m('z', '2026-11-08T10:00:00Z', true)],
      [m('a', '2026-11-08T09:00:00Z')],
    );
    expect(plan.subir.map((r) => r.id)).toEqual(['a']);
  });

  it('no baja marcas de borrado de casos que el dispositivo nunca tuvo', () => {
    const plan = ResolvedorSincronizacion.planear([], [m('x', '2026-11-08T09:00:00Z', true)]);
    expect(plan).toEqual({ subir: [], bajar: [], borrarLocal: [] });
  });

  it('una edicion local mas nueva gana sobre un borrado remoto viejo', () => {
    const plan = ResolvedorSincronizacion.planear([m('a', '2026-11-08T10:00:00Z')], [m('a', '2026-11-08T09:00:00Z', true)]);
    expect(plan.subir.map((r) => r.id)).toEqual(['a']);
    expect(plan.borrarLocal).toEqual([]);
  });
});
