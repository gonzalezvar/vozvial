import { Caso, ErrorCaso, TEXTO_SIN_UBICACION } from '../../../src/core/Caso';
import { Comparendo } from '../../../src/core/Comparendo';
import { Evidencia } from '../../../src/core/Evidencia';
import { FechaCivil } from '../../../src/core/FechaCivil';

const creadoEn = '2026-11-13T20:40:00.000Z';
const ubicacion = { lat: 4.60971, lon: -74.08175, precision: 12.4 };

function nota(id: string, creadaEn: string): Evidencia {
  return Evidencia.crear({ id, tipo: 'nota', creadaEn, texto: `Nota ${id}` });
}

function campoDelError(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    if (e instanceof ErrorCaso) return e.campo;
    throw e;
  }
  throw new Error('No lanzó ErrorCaso');
}

describe('Caso', () => {
  it('se crea con ubicación y empieza registrando', () => {
    const caso = Caso.crear({ id: 'caso-1', creadoEn, ubicacion });
    expect(caso.estado).toBe('registrando');
    expect(caso.etiquetaEstado()).toBe('Registrando');
    expect(caso.tieneUbicacion()).toBe(true);
    expect(caso.motivoSinUbicacion).toBeNull();
    expect(caso.descripcionUbicacion()).toBe('4.60971, -74.08175 (precisión de 12 m)');
    expect(caso.evidencias).toEqual([]);
    expect(caso.comparendo).toBeNull();
  });

  it('se crea sin ubicación si se indica el motivo (CA-07.2)', () => {
    const caso = Caso.crear({ id: 'caso-2', creadoEn, ubicacion: null, motivoSinUbicacion: 'denegada' });
    expect(caso.tieneUbicacion()).toBe(false);
    expect(caso.descripcionUbicacion()).toBe(TEXTO_SIN_UBICACION);
    expect(TEXTO_SIN_UBICACION).toBe('Sin ubicación');
  });

  it('valida ubicación, motivo, id, instante y estado', () => {
    expect(campoDelError(() => Caso.crear({ id: 'x', creadoEn, ubicacion: null }))).toBe('motivoSinUbicacion');
    expect(
      campoDelError(() => Caso.crear({ id: 'x', creadoEn, ubicacion, motivoSinUbicacion: 'no_disponible' })),
    ).toBe('motivoSinUbicacion');
    expect(campoDelError(() => Caso.crear({ id: 'x', creadoEn, ubicacion: { lat: 91, lon: 0, precision: 1 } }))).toBe(
      'ubicacion',
    );
    expect(campoDelError(() => Caso.crear({ id: '', creadoEn, ubicacion }))).toBe('id');
    expect(campoDelError(() => Caso.crear({ id: 'x', creadoEn: 'ayer', ubicacion }))).toBe('creadoEn');
    expect(campoDelError(() => Caso.crear({ id: 'x', creadoEn, ubicacion, estado: 'raro' as never }))).toBe('estado');
    const e = nota('n1', creadoEn);
    expect(campoDelError(() => Caso.crear({ id: 'x', creadoEn, ubicacion, evidencias: [e, e] }))).toBe('evidencias');
  });

  it('agrega y quita evidencias sin mutar el caso original', () => {
    const caso = Caso.crear({ id: 'caso-3', creadoEn, ubicacion });
    const con = caso.agregarEvidencia(nota('n2', '2026-11-13T20:50:00Z')).agregarEvidencia(nota('n1', '2026-11-13T20:45:00Z'));
    expect(caso.evidencias).toHaveLength(0);
    expect(con.evidencias.map((e) => e.id)).toEqual(['n2', 'n1']);
    expect(con.evidenciasOrdenadas().map((e) => e.id)).toEqual(['n1', 'n2']);
    expect(con.buscarEvidencia('n1')?.texto).toBe('Nota n1');
    expect(con.quitarEvidencia('n2').evidencias.map((e) => e.id)).toEqual(['n1']);
    expect(() => con.agregarEvidencia(nota('n1', creadoEn))).toThrow(ErrorCaso);
  });

  it('actualiza conductor, comparendo y estado', () => {
    const comparendo = Comparendo.crear({
      numero: '123456789',
      fecha: FechaCivil.desdeISO('2026-11-13'),
      codigoInfraccion: 'C02',
      tipo: 'via',
    });
    const caso = Caso.crear({ id: 'caso-4', creadoEn, ubicacion })
      .conConductor({ nombre: '  Persona de Prueba ', celular: '' })
      .conConductor({ cedula: '1000000001' })
      .conComparendo(comparendo)
      .terminarRegistro();
    expect(caso.conductor).toEqual({ nombre: 'Persona de Prueba', cedula: '1000000001' });
    expect(caso.comparendo?.numero).toBe('123456789');
    expect(caso.estado).toBe('abierto');
    expect(caso.terminarRegistro()).toBe(caso);
    expect(caso.marcarSolicitudGenerada().etiquetaEstado()).toBe('Solicitud generada');
    expect(caso.cerrar().estado).toBe('cerrado');
  });

  it('ida y vuelta por JSON con evidencias y comparendo', () => {
    const caso = Caso.crear({
      id: 'caso-5',
      creadoEn,
      ubicacion: null,
      motivoSinUbicacion: 'no_disponible',
      evidencias: [nota('n1', creadoEn)],
      comparendo: Comparendo.crear({
        numero: '99999999',
        fecha: FechaCivil.desdeISO('2026-11-13'),
        codigoInfraccion: 'B01',
        tipo: 'fotodeteccion',
        fechaNotificacion: FechaCivil.desdeISO('2026-11-20'),
      }),
      conductor: { nombre: 'Persona de Prueba', ciudad: 'Ciudad de Prueba' },
      estado: 'abierto',
    });
    const json = JSON.parse(JSON.stringify(caso));
    expect(json.comparendo.fechaNotificacion).toBe('2026-11-20');
    expect(json.evidencias[0].id).toBe('n1');
    const otro = Caso.desdeJSON(json);
    expect(otro.toJSON()).toEqual(caso.toJSON());
    expect(otro.comparendo).toBeInstanceOf(Comparendo);
    expect(otro.evidencias[0]).toBeInstanceOf(Evidencia);
  });
});
