import { FechaCivil } from '../../../src/core/FechaCivil';
import { ErrorAnioNoSoportado, FestivosColombia } from '../../../src/core/FestivosColombia';

const fecha = (iso: string) => FechaCivil.desdeISO(iso);

describe('FestivosColombia', () => {
  const festivos = new FestivosColombia();

  describe('Domingo de Pascua (computus gregoriano anónimo)', () => {
    it.each([
      [2000, '2000-04-23'],
      [2008, '2008-03-23'],
      [2011, '2011-04-24'],
      [2019, '2019-04-21'],
      [2024, '2024-03-31'],
      [2025, '2025-04-20'],
      [2026, '2026-04-05'],
      [2027, '2027-03-28'],
      [2038, '2038-04-25'],
      [2285, '2285-03-22'],
    ])('Pascua %i = %s', (anio, iso) => {
      const pascua = FestivosColombia.domingoDePascua(anio);
      expect(pascua.aISO()).toBe(iso);
      expect(pascua.diaSemana()).toBe(0);
    });
  });

  describe('tabla de docs/base-normativa.md (2026-2027)', () => {
    it.each([
      ['2026-10-12', 'Día de la Raza', false],
      ['2026-11-02', 'Todos los Santos', true],
      ['2026-11-16', 'Independencia de Cartagena', true],
      ['2026-12-08', 'Inmaculada Concepción', false],
      ['2026-12-25', 'Navidad', false],
      ['2027-01-01', 'Año Nuevo', false],
      ['2027-01-11', 'Reyes Magos', true],
    ])('%s es festivo: %s (trasladado: %s)', (iso, nombre, trasladado) => {
      const f = festivos.festivo(fecha(iso));
      expect(f).not.toBeNull();
      expect(f?.nombre).toBe(nombre);
      expect(f?.trasladado).toBe(trasladado);
      expect(festivos.esFestivo(fecha(iso))).toBe(true);
    });

    it.each(['2026-11-01', '2026-11-11', '2027-01-06'])('%s no es festivo porque se trasladó al lunes', (iso) => {
      expect(festivos.esFestivo(fecha(iso))).toBe(false);
    });

    it('los festivos trasladados caen en lunes', () => {
      for (const anio of [2024, 2025, 2026, 2027]) {
        for (const f of festivos.festivosDelAnio(anio)) {
          if (f.trasladado) expect(f.fecha.diaSemana()).toBe(1);
        }
      }
    });
  });

  it('calcula los 18 festivos de 2026', () => {
    expect(festivos.festivosDelAnio(2026).map((f) => f.fecha.aISO())).toEqual([
      '2026-01-01',
      '2026-01-12',
      '2026-03-23',
      '2026-04-02',
      '2026-04-03',
      '2026-05-01',
      '2026-05-18',
      '2026-06-08',
      '2026-06-15',
      '2026-06-29',
      '2026-07-20',
      '2026-08-07',
      '2026-08-17',
      '2026-10-12',
      '2026-11-02',
      '2026-11-16',
      '2026-12-08',
      '2026-12-25',
    ]);
  });

  it('calcula los festivos de 2027', () => {
    expect(festivos.festivosDelAnio(2027).map((f) => f.fecha.aISO())).toEqual([
      '2027-01-01',
      '2027-01-11',
      '2027-03-22',
      '2027-03-25',
      '2027-03-26',
      '2027-05-01',
      '2027-05-10',
      '2027-05-31',
      '2027-06-07',
      '2027-07-05',
      '2027-07-20',
      '2027-08-07',
      '2027-08-16',
      '2027-10-18',
      '2027-11-01',
      '2027-11-15',
      '2027-12-08',
      '2027-12-25',
    ]);
  });

  it('calcula los festivos de 2024', () => {
    expect(festivos.festivosDelAnio(2024).map((f) => f.fecha.aISO())).toEqual([
      '2024-01-01',
      '2024-01-08',
      '2024-03-25',
      '2024-03-28',
      '2024-03-29',
      '2024-05-01',
      '2024-05-13',
      '2024-06-03',
      '2024-06-10',
      '2024-07-01',
      '2024-07-20',
      '2024-08-07',
      '2024-08-19',
      '2024-10-14',
      '2024-11-04',
      '2024-11-11',
      '2024-12-08',
      '2024-12-25',
    ]);
  });

  it('en 2025 Sagrado Corazón y San Pedro caen el mismo lunes: 17 días festivos', () => {
    const lista = festivos.festivosDelAnio(2025);
    expect(lista).toHaveLength(17);
    const junio30 = festivos.festivo(fecha('2025-06-30'));
    expect(junio30?.celebraciones).toEqual(['San Pedro y San Pablo', 'Sagrado Corazón de Jesús']);
    expect(junio30?.nombre).toBe('San Pedro y San Pablo / Sagrado Corazón de Jesús');
    expect(lista.map((f) => f.fecha.aISO())).toEqual([
      '2025-01-01',
      '2025-01-06',
      '2025-03-24',
      '2025-04-17',
      '2025-04-18',
      '2025-05-01',
      '2025-06-02',
      '2025-06-23',
      '2025-06-30',
      '2025-07-20',
      '2025-08-07',
      '2025-08-18',
      '2025-10-13',
      '2025-11-03',
      '2025-11-17',
      '2025-12-08',
      '2025-12-25',
    ]);
  });

  it('Jueves y Viernes Santo no se trasladan', () => {
    expect(festivos.festivo(fecha('2026-04-02'))?.nombre).toBe('Jueves Santo');
    expect(festivos.festivo(fecha('2026-04-03'))?.nombre).toBe('Viernes Santo');
    expect(festivos.festivo(fecha('2026-04-02'))?.trasladado).toBe(false);
  });

  it('Ascensión, Corpus Christi y Sagrado Corazón pasan al lunes siguiente', () => {
    expect(festivos.festivo(fecha('2026-05-18'))?.nombre).toBe('Ascensión del Señor');
    expect(festivos.festivo(fecha('2026-06-08'))?.nombre).toBe('Corpus Christi');
    expect(festivos.festivo(fecha('2026-06-15'))?.nombre).toBe('Sagrado Corazón de Jesús');
    // Sus días originales (jueves y viernes) no son festivos.
    expect(festivos.esFestivo(fecha('2026-05-14'))).toBe(false);
    expect(festivos.esFestivo(fecha('2026-06-04'))).toBe(false);
    expect(festivos.esFestivo(fecha('2026-06-12'))).toBe(false);
  });

  it('un festivo no trasladable en domingo se queda en domingo', () => {
    // 20 de julio de 2025 fue domingo y no está en la lista de traslado.
    expect(festivos.festivo(fecha('2025-07-20'))?.trasladado).toBe(false);
    expect(festivos.esFestivo(fecha('2025-07-21'))).toBe(false);
  });

  it('cada festivo cita la Ley 51 de 1983', () => {
    expect(festivos.sustento).toEqual(['L51-1983-art1']);
    for (const f of festivos.festivosDelAnio(2026)) expect(f.sustento).toEqual(['L51-1983-art1']);
  });

  it('rechaza años anteriores a la Ley 51 de 1983', () => {
    expect(() => festivos.festivosDelAnio(1983)).toThrow(ErrorAnioNoSoportado);
    expect(() => festivos.esFestivo(fecha('1980-01-01'))).toThrow(ErrorAnioNoSoportado);
  });

  it('festivosDelAnio devuelve una copia', () => {
    festivos.festivosDelAnio(2026).pop();
    expect(festivos.festivosDelAnio(2026)).toHaveLength(18);
  });

  describe('9 de julio (Ley 2578 de 2026), regla en revisión', () => {
    it('por defecto no se cuenta como festivo y queda en revisión, con sus dos fechas posibles', () => {
      expect(festivos.reglaNueveDeJulio).toBe('en_revision');
      expect(festivos.esFestivo(fecha('2026-07-09'))).toBe(false);
      expect(festivos.esFestivo(fecha('2026-07-13'))).toBe(false);
      expect(festivos.festivosEnRevisionDelAnio(2026).map((f) => f.fecha.aISO())).toEqual(['2026-07-09', '2026-07-13']);
      expect(festivos.enRevision(fecha('2026-07-09'))?.sustento).toEqual(['L2578-2026-art6']);
      expect(festivos.enRevision(fecha('2026-07-10'))).toBeNull();
    });

    it('no aplica antes de 2026', () => {
      expect(festivos.festivosEnRevisionDelAnio(2025)).toEqual([]);
    });

    it('si el 9 de julio cae en lunes, solo hay una fecha en revisión', () => {
      // 9 de julio de 2029 es lunes.
      expect(fecha('2029-07-09').diaSemana()).toBe(1);
      expect(festivos.festivosEnRevisionDelAnio(2029).map((f) => f.fecha.aISO())).toEqual(['2029-07-09']);
    });

    it("con la regla 'fijo' es festivo el mismo 9 de julio", () => {
      const fijo = new FestivosColombia({ reglaNueveDeJulio: 'fijo' });
      expect(fijo.esFestivo(fecha('2026-07-09'))).toBe(true);
      expect(fijo.esFestivo(fecha('2026-07-13'))).toBe(false);
      expect(fijo.festivosEnRevisionDelAnio(2026)).toEqual([]);
      expect(fijo.sustento).toEqual(['L51-1983-art1', 'L2578-2026-art6']);
      expect(fijo.festivo(fecha('2026-07-09'))?.sustento).toEqual(['L2578-2026-art6']);
      expect(fijo.esFestivo(fecha('2025-07-09'))).toBe(false);
    });

    it("con la regla 'trasladable' pasa al lunes siguiente", () => {
      const trasladable = new FestivosColombia({ reglaNueveDeJulio: 'trasladable' });
      expect(trasladable.esFestivo(fecha('2026-07-09'))).toBe(false);
      expect(trasladable.festivo(fecha('2026-07-13'))?.trasladado).toBe(true);
      expect(trasladable.festivosDelAnio(2026)).toHaveLength(19);
    });
  });
});
