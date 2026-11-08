import {
  ErrorParametroNoVerificado,
  ErrorParametroPlazo,
  ParametrosPlazos,
  type ParametrosJSON,
} from '../../../src/core/ParametrosPlazos';
import fixture from './fixtures/parametros-prueba.json';

const copia = (): ParametrosJSON => JSON.parse(JSON.stringify(fixture)) as ParametrosJSON;

function modificar(id: string, cambio: Record<string, unknown>): ParametrosJSON {
  const json = copia();
  json.parametros = json.parametros.map((p) => (p.id === id ? ({ ...p, ...cambio } as typeof p) : p));
  return json;
}

describe('ParametrosPlazos', () => {
  it('lee los parámetros de vía y fotodetección del JSON', () => {
    const parametros = ParametrosPlazos.desdeJSON(copia());
    expect(parametros.obtener('via')).toMatchObject({
      id: 'dias_habiles_via',
      diasHabiles: 5,
      puntoPartida: 'dia_siguiente_evento',
      sustento: ['TEST'],
    });
    expect(parametros.obtener('fotodeteccion')).toMatchObject({
      id: 'dias_habiles_fotodeteccion',
      diasHabiles: 11,
      puntoPartida: 'dia_siguiente_notificacion',
      sustento: ['TEST'],
    });
  });

  it('lanza ErrorParametroNoVerificado si el parámetro no está verificado', () => {
    const json = modificar('dias_habiles_fotodeteccion', { verificado: false });
    expect(() => ParametrosPlazos.desdeJSON(json)).toThrow(ErrorParametroNoVerificado);
    try {
      ParametrosPlazos.desdeJSON(json);
    } catch (e) {
      expect((e as ErrorParametroNoVerificado).idParametro).toBe('dias_habiles_fotodeteccion');
    }
  });

  it('lanza error si falta un parámetro', () => {
    const json = copia();
    json.parametros = json.parametros.filter((p) => p.id !== 'dias_habiles_via');
    expect(() => ParametrosPlazos.desdeJSON(json)).toThrow(ErrorParametroPlazo);
    expect(() => ParametrosPlazos.desdeJSON({} as ParametrosJSON)).toThrow(ErrorParametroPlazo);
  });

  it.each([
    [{ valor: 0 }],
    [{ valor: 5.5 }],
    [{ unidad: 'meses' }],
    [{ punto_partida: 'dia_del_evento' }],
    [{ punto_partida: undefined }],
    [{ sustento: [] }],
  ])('rechaza el parámetro mal formado %j', (cambio) => {
    expect(() => ParametrosPlazos.desdeJSON(modificar('dias_habiles_via', cambio))).toThrow(ErrorParametroPlazo);
  });

  it('no deja modificar los parámetros desde afuera', () => {
    const parametros = ParametrosPlazos.desdeJSON(copia());
    parametros.obtener('via').sustento.push('OTRO');
    expect(parametros.obtener('via').sustento).toEqual(['TEST']);
  });

  it('mapea el tipo al id de parametros.json', () => {
    expect(ParametrosPlazos.idDe('via')).toBe('dias_habiles_via');
    expect(ParametrosPlazos.idDe('fotodeteccion')).toBe('dias_habiles_fotodeteccion');
  });
});
