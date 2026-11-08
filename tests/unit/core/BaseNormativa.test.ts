import { BaseNormativa, type EntradaNormativaJSON } from '../../../src/core/BaseNormativa';
import { ARCHIVOS_NORMATIVA, obtenerBaseNormativa } from '../../../src/core/cargarDatos';

function entrada(id: string, cambios: Partial<EntradaNormativaJSON> = {}): EntradaNormativaJSON {
  return {
    id,
    norma: 'Ley de prueba',
    articulo: id.split('art')[1] ?? '1',
    titulo: `Título ${id}`,
    texto_literal: `Texto literal de ${id}`,
    modificado_por: [],
    resumen_sencillo: 'Resumen',
    url_fuente: 'https://www.secretariasenado.gov.co/',
    fecha_consulta: '2026-11-08',
    temas: ['plazos'],
    verificado: true,
    verificado_por: 'Equipo',
    notas: '',
    ...cambios,
  };
}

describe('BaseNormativa', () => {
  it('filtra las entradas no verificadas', () => {
    const base = new BaseNormativa([entrada('X-art1'), entrada('X-art2', { verificado: false })]);
    expect(base.todas().map((e) => e.id)).toEqual(['X-art1']);
    expect(base.porId('X-art2')).toBeNull();
    expect(base.cita('X-art2')).toBeNull();
    expect(base.idsDescartados()).toEqual(['X-art2']);
  });

  it('descarta entradas sin texto literal o sin fuente aunque digan verificado', () => {
    const base = new BaseNormativa([entrada('X-art1', { texto_literal: ' ' }), entrada('X-art2', { url_fuente: '' })]);
    expect(base.todas()).toHaveLength(0);
  });

  it('arma la cita completa y busca por tema', () => {
    const base = new BaseNormativa([entrada('X-art1'), entrada('X-art2', { temas: ['audiencia'] })]);
    expect(base.cita('X-art1')).toEqual({
      id: 'X-art1',
      norma: 'Ley de prueba',
      articulo: '1',
      titulo: 'Título X-art1',
      textoLiteral: 'Texto literal de X-art1',
      urlFuente: 'https://www.secretariasenado.gov.co/',
      fechaConsulta: '2026-11-08',
    });
    expect(base.porTema('AUDIENCIA').map((e) => e.id)).toEqual(['X-art2']);
    expect(base.citas(['X-art2', 'no-existe', 'X-art2']).map((c) => c.id)).toEqual(['X-art2']);
  });

  it('rechaza ids duplicados', () => {
    expect(() => new BaseNormativa([entrada('X-art1'), entrada('X-art1')])).toThrow(/duplicado/);
  });

  it('con los datos reales solo expone entradas verificadas', () => {
    const base = obtenerBaseNormativa();
    const todas = ARCHIVOS_NORMATIVA.flatMap((a) => a.entradas);
    const noVerificadas = todas.filter((e) => !e.verificado).map((e) => e.id);
    expect(noVerificadas.length).toBeGreaterThan(0);
    for (const id of noVerificadas) expect(base.porId(id)).toBeNull();
    expect(base.todas().length).toBe(todas.length - noVerificadas.length);
  });
});
