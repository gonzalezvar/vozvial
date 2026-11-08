import { Comparendo, ErrorComparendo, type DatosComparendo } from '../../../src/core/Comparendo';
import { FechaCivil } from '../../../src/core/FechaCivil';

const f = (iso: string) => FechaCivil.desdeISO(iso);

const base: DatosComparendo = {
  numero: '1100 1000-0000 4567',
  fecha: f('2026-11-13'),
  placa: 'abc-123',
  codigoInfraccion: 'C.02',
  tipo: 'via',
};

function errorDe(fn: () => unknown): ErrorComparendo {
  try {
    fn();
  } catch (e) {
    if (e instanceof ErrorComparendo) return e;
    throw e;
  }
  throw new Error('No lanzó ErrorComparendo');
}

describe('Comparendo', () => {
  it('normaliza número, placa y código', () => {
    const c = Comparendo.crear(base);
    expect(c.numero).toBe('1100100000004567');
    expect(c.placa).toBe('ABC123');
    expect(c.codigoInfraccion).toBe('C02');
    expect(c.fechaNotificacion).toBeNull();
    expect(c.organismo).toBeNull();
    expect(Object.isFrozen(c)).toBe(true);
  });

  it('acepta placa de moto y placa ausente', () => {
    expect(Comparendo.crear({ ...base, placa: 'XYZ12D' }).placa).toBe('XYZ12D');
    expect(Comparendo.crear({ ...base, placa: null }).placa).toBeNull();
    expect(Comparendo.crear({ ...base, placa: '  ' }).placa).toBeNull();
  });

  it('rechaza datos con el campo que falló', () => {
    expect(errorDe(() => Comparendo.crear({ ...base, numero: '' })).campo).toBe('numero');
    expect(errorDe(() => Comparendo.crear({ ...base, numero: '12AB34' })).campo).toBe('numero');
    expect(errorDe(() => Comparendo.crear({ ...base, placa: 'AB1234' })).campo).toBe('placa');
    expect(errorDe(() => Comparendo.crear({ ...base, codigoInfraccion: '' })).message).toBe(
      'Falta el código de la infracción.',
    );
    expect(errorDe(() => Comparendo.crear({ ...base, codigoInfraccion: 'Z9' })).campo).toBe('codigoInfraccion');
    expect(
      errorDe(() => Comparendo.crear({ ...base, fecha: null as unknown as FechaCivil })).message,
    ).toBe('Falta la fecha del comparendo.');
  });

  it('exige la fecha de notificación si es por fotodetección', () => {
    const e = errorDe(() => Comparendo.crear({ ...base, tipo: 'fotodeteccion' }));
    expect(e.campo).toBe('fechaNotificacion');
    expect(e.message).toBe('Falta la fecha en que recibiste la notificación.');
    expect(
      errorDe(() =>
        Comparendo.crear({ ...base, tipo: 'fotodeteccion', fechaNotificacion: f('2026-11-12') }),
      ).campo,
    ).toBe('fechaNotificacion');
  });

  it('elige la fecha base del plazo según el tipo', () => {
    const via = Comparendo.crear({ ...base, fechaNotificacion: f('2026-11-20') });
    expect(via.fechaNotificacion).toBeNull();
    expect(via.fechaBasePlazo().aISO()).toBe('2026-11-13');
    const foto = Comparendo.crear({ ...base, tipo: 'fotodeteccion', fechaNotificacion: f('2026-11-20') });
    expect(foto.fechaBasePlazo().aISO()).toBe('2026-11-20');
  });

  it('confirma campos y aplica cambios sin mutar el original', () => {
    const c = Comparendo.crear(base);
    const confirmado = c.confirmar('placa', 'numero', 'placa');
    expect(confirmado.camposConfirmados).toEqual(['placa', 'numero']);
    expect(confirmado.estaConfirmado('placa')).toBe(true);
    expect(c.estaConfirmado('placa')).toBe(false);
    const cambiado = confirmado.con({ organismo: '  Secretaría de prueba ' });
    expect(cambiado.organismo).toBe('Secretaría de prueba');
    expect(cambiado.camposConfirmados).toEqual(['placa', 'numero']);
    expect(() => c.confirmar('inventado' as never)).toThrow(ErrorComparendo);
  });

  it('ida y vuelta por JSON', () => {
    const c = Comparendo.crear({
      ...base,
      tipo: 'fotodeteccion',
      fechaNotificacion: f('2026-11-13'),
      organismo: 'Organismo de prueba',
      camposConfirmados: ['fecha'],
    });
    const json = JSON.parse(JSON.stringify(c));
    expect(json).toEqual({
      numero: '1100100000004567',
      fecha: '2026-11-13',
      placa: 'ABC123',
      codigoInfraccion: 'C02',
      tipo: 'fotodeteccion',
      fechaNotificacion: '2026-11-13',
      organismo: 'Organismo de prueba',
      camposConfirmados: ['fecha'],
    });
    const otra = Comparendo.desdeJSON(json);
    expect(otra.toJSON()).toEqual(c.toJSON());
    expect(otra.fecha.esIgual(c.fecha)).toBe(true);
  });
});
