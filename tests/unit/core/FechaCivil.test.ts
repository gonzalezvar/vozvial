import { ErrorFechaInvalida, FechaCivil } from '../../../src/core/FechaCivil';

describe('FechaCivil', () => {
  it('lee y escribe ISO AAAA-MM-DD', () => {
    const f = FechaCivil.desdeISO('2026-11-13');
    expect([f.anio, f.mes, f.dia]).toEqual([2026, 11, 13]);
    expect(f.aISO()).toBe('2026-11-13');
    expect(JSON.stringify({ f })).toBe('{"f":"2026-11-13"}');
  });

  it.each(['2026-02-29', '2026-04-31', '2026-13-01', '2026-00-10', '2026-1-5', '13/11/2026', ''])(
    'rechaza la fecha inválida "%s"',
    (texto) => {
      expect(() => FechaCivil.desdeISO(texto)).toThrow(ErrorFechaInvalida);
    },
  );

  it('acepta el 29 de febrero en años bisiestos', () => {
    expect(FechaCivil.desdeISO('2024-02-29').aISO()).toBe('2024-02-29');
    expect(FechaCivil.desdeISO('2000-02-29').aISO()).toBe('2000-02-29');
    expect(() => FechaCivil.de(1900, 2, 29)).toThrow(ErrorFechaInvalida);
  });

  it.each([
    ['1970-01-01', 4],
    ['2026-11-13', 5],
    ['2026-11-15', 0],
    ['2026-11-16', 1],
    ['2026-11-14', 6],
    ['2027-01-11', 1],
    ['1969-12-31', 3],
  ])('%s cae en el día de semana %i (0 = domingo)', (iso, esperado) => {
    expect(FechaCivil.desdeISO(iso).diaSemana()).toBe(esperado);
  });

  it('suma días cruzando meses, años y febrero', () => {
    expect(FechaCivil.desdeISO('2026-12-31').sumarDias(1).aISO()).toBe('2027-01-01');
    expect(FechaCivil.desdeISO('2024-02-28').sumarDias(1).aISO()).toBe('2024-02-29');
    expect(FechaCivil.desdeISO('2026-03-01').sumarDias(-1).aISO()).toBe('2026-02-28');
    expect(FechaCivil.desdeISO('2026-11-13').sumarDias(365).aISO()).toBe('2027-11-13');
    expect(() => FechaCivil.desdeISO('2026-11-13').sumarDias(1.5)).toThrow(ErrorFechaInvalida);
  });

  it('compara fechas', () => {
    const a = FechaCivil.desdeISO('2026-11-13');
    const b = FechaCivil.desdeISO('2026-11-23');
    expect(a.comparar(b)).toBe(-1);
    expect(b.comparar(a)).toBe(1);
    expect(a.comparar(FechaCivil.de(2026, 11, 13))).toBe(0);
    expect(a.esIgual(FechaCivil.de(2026, 11, 13))).toBe(true);
    expect(a.esAnterior(b)).toBe(true);
    expect(b.esPosterior(a)).toBe(true);
    expect(a.diasHasta(b)).toBe(10);
  });

  it('formatea en español largo', () => {
    expect(FechaCivil.desdeISO('2026-11-13').formatoLargo()).toBe('viernes 13 de noviembre de 2026');
    expect(FechaCivil.desdeISO('2026-12-01').formatoLargo()).toBe('martes 1 de diciembre de 2026');
    expect(FechaCivil.desdeISO('2027-01-06').formatoLargo()).toBe('miércoles 6 de enero de 2027');
    expect(FechaCivil.desdeISO('2026-11-14').formatoLargo()).toBe('sábado 14 de noviembre de 2026');
  });

  it('hoy() usa la fecha local del reloj inyectado', () => {
    // 23:30 hora local: con toISOString (UTC) podría correrse al día siguiente.
    const reloj = () => new Date(2026, 10, 13, 23, 30);
    expect(FechaCivil.hoy(reloj).aISO()).toBe('2026-11-13');
    expect(() => FechaCivil.hoy(() => new Date(Number.NaN))).toThrow(ErrorFechaInvalida);
  });

  it('es inmutable', () => {
    const f = FechaCivil.desdeISO('2026-11-13');
    expect(Object.isFrozen(f)).toBe(true);
    f.sumarDias(3);
    expect(f.aISO()).toBe('2026-11-13');
  });
});
