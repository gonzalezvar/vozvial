import { CalculadoraPlazos } from '../../../src/core/CalculadoraPlazos';
import { FechaCivil } from '../../../src/core/FechaCivil';
import { FestivosColombia, type CalendarioFestivos } from '../../../src/core/FestivosColombia';
import { ParametrosPlazos, type ParametrosJSON } from '../../../src/core/ParametrosPlazos';
import fixture from './fixtures/parametros-prueba.json';

const fecha = (iso: string) => FechaCivil.desdeISO(iso);
// Fixture con 5 y 11 días: los valores reales salen de la base normativa verificada.
const parametros = ParametrosPlazos.desdeJSON(fixture as ParametrosJSON);
const calculadora = new CalculadoraPlazos(new FestivosColombia(), parametros);

describe('CalculadoraPlazos', () => {
  describe('tabla de docs/base-normativa.md', () => {
    it.each([
      ['2026-11-06', 'via', 5, '2026-11-13'],
      ['2026-11-13', 'via', 5, '2026-11-23'],
      ['2026-11-13', 'fotodeteccion', 11, '2026-12-01'],
      ['2026-12-04', 'via', 5, '2026-12-14'],
      ['2026-12-18', 'fotodeteccion', 11, '2027-01-06'],
    ] as const)('evento %s, %s (%i días hábiles) -> %s', (base, tipo, dias, limite) => {
      const r = calculadora.calcular({ tipo, fechaBase: fecha(base) });
      expect(r.diasHabiles).toBe(dias);
      expect(r.fechaLimite.aISO()).toBe(limite);
      expect(r.fechaBase.aISO()).toBe(base);
      expect(r.tipo).toBe(tipo);
    });
  });

  it('CA-11.1: comparendo en vía del 13 nov 2026 vence el lunes 23 nov (el 16 es festivo)', () => {
    const r = calculadora.calcular({ tipo: 'via', fechaBase: fecha('2026-11-13') });
    expect(r.fechaLimite.formatoLargo()).toBe('lunes 23 de noviembre de 2026');
    expect(r.puntoPartida).toBe('dia_siguiente_evento');
    expect(r.festivosOmitidos.map((f) => f.fecha.aISO())).toEqual(['2026-11-16']);
    expect(r.explicacion).toContain(
      'Contamos desde el día siguiente al comparendo: usamos la fecha del comparendo, viernes 13 de noviembre de 2026.',
    );
    expect(r.explicacion).toContain('lunes 16 de noviembre de 2026 (Independencia de Cartagena)');
    expect(r.explicacion).toContain('Tu fecha límite es el lunes 23 de noviembre de 2026.');
  });

  it('CA-11.2 y CA-11.3: fotodetección cuenta desde la notificación y dice qué fecha usó', () => {
    const r = calculadora.calcular({ tipo: 'fotodeteccion', fechaBase: fecha('2026-11-13') });
    expect(r.fechaLimite.aISO()).toBe('2026-12-01');
    expect(r.puntoPartida).toBe('dia_siguiente_notificacion');
    expect(r.explicacion).toContain(
      'Contamos desde el día siguiente a la notificación: usamos la fecha en que recibiste la notificación, viernes 13 de noviembre de 2026.',
    );
    expect(r.explicacion).toContain('Sumamos 11 días hábiles, sin sábados, domingos ni festivos.');
    expect(r.explicacion).toContain('Tu fecha límite es el martes 1 de diciembre de 2026.');
  });

  it('salta varios festivos y lo explica en plural', () => {
    const r = calculadora.calcular({ tipo: 'fotodeteccion', fechaBase: fecha('2026-12-18') });
    expect(r.festivosOmitidos.map((f) => f.fecha.aISO())).toEqual(['2026-12-25', '2027-01-01']);
    expect(r.explicacion).toContain('No contamos estos festivos: viernes 25 de diciembre de 2026 (Navidad); viernes 1 de enero de 2027 (Año Nuevo).');
  });

  it('sin festivos en el periodo no los menciona', () => {
    const r = calculadora.calcular({ tipo: 'via', fechaBase: fecha('2026-11-06') });
    expect(r.festivosOmitidos).toEqual([]);
    expect(r.explicacion).not.toContain('No contamos');
    expect(r.advertencias).toEqual([]);
  });

  it('si la fecha base es fin de semana, empieza a contar el lunes', () => {
    const r = calculadora.calcular({ tipo: 'via', fechaBase: fecha('2026-11-07') });
    expect(r.fechaLimite.aISO()).toBe('2026-11-13');
  });

  it('el sustento combina el parámetro y la Ley 51 de 1983', () => {
    const r = calculadora.calcular({ tipo: 'via', fechaBase: fecha('2026-11-13') });
    expect(r.sustento).toEqual(['TEST', 'L51-1983-art1']);
  });

  it('el número de días sale de los parámetros, no de la clase', () => {
    const json = JSON.parse(JSON.stringify(fixture)) as ParametrosJSON;
    for (const p of json.parametros) if (p.id === 'dias_habiles_via') p.valor = 1;
    const otra = new CalculadoraPlazos(new FestivosColombia(), ParametrosPlazos.desdeJSON(json));
    expect(otra.calcular({ tipo: 'via', fechaBase: fecha('2026-11-13') }).fechaLimite.aISO()).toBe('2026-11-17');
  });

  it('acepta otro calendario inyectado', () => {
    const sinFestivos: CalendarioFestivos = {
      esFestivo: () => false,
      festivo: () => null,
      enRevision: () => null,
      sustento: [],
    };
    const r = new CalculadoraPlazos(sinFestivos, parametros).calcular({ tipo: 'via', fechaBase: fecha('2026-11-13') });
    expect(r.fechaLimite.aISO()).toBe('2026-11-20');
    expect(r.sustento).toEqual(['TEST']);
  });

  describe('9 de julio en revisión (Ley 2578 de 2026)', () => {
    it('no lo cuenta como festivo pero lo advierte', () => {
      const r = calculadora.calcular({ tipo: 'via', fechaBase: fecha('2026-07-03') });
      expect(r.fechaLimite.aISO()).toBe('2026-07-10');
      expect(r.diasEnRevision.map((d) => d.fecha.aISO())).toEqual(['2026-07-09']);
      expect(r.advertencias).toHaveLength(1);
      expect(r.advertencias[0]).toContain('jueves 9 de julio de 2026 podría ser festivo');
      expect(r.explicacion).toContain('Si lo fuera, tu plazo iría un día hábil más.');
    });

    it("con la regla 'fijo' lo salta", () => {
      const conFijo = new CalculadoraPlazos(new FestivosColombia({ reglaNueveDeJulio: 'fijo' }), parametros);
      const r = conFijo.calcular({ tipo: 'via', fechaBase: fecha('2026-07-03') });
      expect(r.fechaLimite.aISO()).toBe('2026-07-13');
      expect(r.advertencias).toEqual([]);
      expect(r.sustento).toEqual(['TEST', 'L51-1983-art1', 'L2578-2026-art6']);
    });
  });

  describe('diasHabilesRestantes (CA-11.4, CA-12.x)', () => {
    const limite = fecha('2026-11-23');

    it('cuenta los días hábiles después de hoy hasta la fecha límite, sin festivos', () => {
      expect(calculadora.diasHabilesRestantes(fecha('2026-11-13'), limite)).toEqual({ dias: 5, vencido: false, esHoy: false });
      expect(calculadora.diasHabilesRestantes(fecha('2026-11-19'), limite)).toEqual({ dias: 2, vencido: false, esHoy: false });
      expect(calculadora.diasHabilesRestantes(fecha('2026-11-20'), limite)).toEqual({ dias: 1, vencido: false, esHoy: false });
      expect(calculadora.diasHabilesRestantes(fecha('2026-11-21'), limite)).toEqual({ dias: 1, vencido: false, esHoy: false });
    });

    it('hoy es el día límite', () => {
      expect(calculadora.diasHabilesRestantes(fecha('2026-11-23'), limite)).toEqual({ dias: 0, vencido: false, esHoy: true });
    });

    it('plazo vencido', () => {
      expect(calculadora.diasHabilesRestantes(fecha('2026-11-24'), limite)).toEqual({ dias: 0, vencido: true, esHoy: false });
      expect(calculadora.diasHabilesRestantes(fecha('2027-01-10'), limite)).toEqual({ dias: 0, vencido: true, esHoy: false });
    });

    it('coincide con el cálculo del plazo', () => {
      const base = fecha('2026-11-13');
      const r = calculadora.calcular({ tipo: 'fotodeteccion', fechaBase: base });
      expect(calculadora.diasHabilesRestantes(base, r.fechaLimite).dias).toBe(11);
    });
  });

  it('esDiaHabil descarta fines de semana y festivos', () => {
    expect(calculadora.esDiaHabil(fecha('2026-11-13'))).toBe(true);
    expect(calculadora.esDiaHabil(fecha('2026-11-14'))).toBe(false);
    expect(calculadora.esDiaHabil(fecha('2026-11-16'))).toBe(false);
  });
});
