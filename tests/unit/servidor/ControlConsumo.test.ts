import { ControlConsumo, LIMITES_PREDETERMINADOS } from '../../../src/servidor/ControlConsumo';

describe('ControlConsumo', () => {
  it('tope por minuto por IP y se reabre al minuto siguiente', () => {
    let ahora = 0;
    const c = new ControlConsumo({ porMinuto: 2, porDia: 100, globalPorDia: 100 }, () => ahora);
    expect(c.registrarCliente('a').permitido).toBe(true);
    expect(c.registrarCliente('a').permitido).toBe(true);
    const bloqueo = c.registrarCliente('a');
    expect(bloqueo.permitido).toBe(false);
    expect(bloqueo.msRestantes).toBe(60_000);
    // Otra IP tiene su propio cupo.
    expect(c.registrarCliente('b').permitido).toBe(true);
    ahora = 60_000;
    expect(c.registrarCliente('a').permitido).toBe(true);
  });

  it('tope por día por IP', () => {
    let ahora = 0;
    const c = new ControlConsumo({ porMinuto: 100, porDia: 3, globalPorDia: 100 }, () => ahora);
    for (let i = 0; i < 3; i += 1) expect(c.registrarCliente('a').permitido).toBe(true);
    ahora = 2 * 60_000;
    const r = c.registrarCliente('a');
    expect(r.permitido).toBe(false);
    expect(r.msRestantes).toBe(24 * 60 * 60_000 - 2 * 60_000);
  });

  it('cupo global diario', () => {
    let ahora = 0;
    const c = new ControlConsumo({ porMinuto: 1, porDia: 1, globalPorDia: 2 }, () => ahora);
    expect(c.consumirGlobal()).toBe(true);
    expect(c.consumirGlobal()).toBe(true);
    expect(c.consumirGlobal()).toBe(false);
    ahora = 24 * 60 * 60_000;
    expect(c.consumirGlobal()).toBe(true);
  });

  it('lee los límites del entorno e ignora valores inválidos', () => {
    expect(ControlConsumo.limitesDesdeEntorno({})).toEqual(LIMITES_PREDETERMINADOS);
    expect(
      ControlConsumo.limitesDesdeEntorno({ ASISTENTE_LIMITE_MINUTO: '5', ASISTENTE_LIMITE_DIA: '0', ASISTENTE_LIMITE_GLOBAL_DIA: 'x' }),
    ).toEqual({ ...LIMITES_PREDETERMINADOS, porMinuto: 5 });
  });
});
