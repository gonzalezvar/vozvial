import { BaseNormativa, type EntradaNormativaJSON } from '../../../src/core/BaseNormativa';
import { obtenerBaseNormativa } from '../../../src/core/cargarDatos';
import { DerechosClave, IDS_DERECHOS_ME_PARARON } from '../../../src/core/DerechosClave';

function entrada(id: string, cambios: Partial<EntradaNormativaJSON> = {}): EntradaNormativaJSON {
  return {
    id,
    norma: 'Ley de prueba',
    articulo: id.split('art')[1] ?? '1',
    titulo: `Título ${id}`,
    texto_literal: `Texto literal de ${id}`,
    modificado_por: [],
    resumen_sencillo: `Resumen de ${id}`,
    url_fuente: 'https://www.secretariasenado.gov.co/',
    fecha_consulta: '2026-11-08',
    temas: [],
    verificado: true,
    verificado_por: 'Equipo',
    notas: '',
    ...cambios,
  };
}

describe('DerechosClave', () => {
  it('devuelve en orden solo las entradas verificadas, con su articulo y cita', () => {
    const base = new BaseNormativa([entrada('X-art2'), entrada('X-art1'), entrada('X-art3', { verificado: false })]);
    const derechos = new DerechosClave(base, ['X-art1', 'X-art3', 'X-art2']);
    const lista = derechos.lista();
    expect(lista.map((d) => d.id)).toEqual(['X-art1', 'X-art2']);
    expect(lista[0]!.cita.articulo).toBe('1');
    expect(lista[0]!.cita.textoLiteral).toBe('Texto literal de X-art1');
    expect(lista[0]!.resumen).toBe('Resumen de X-art1');
    expect(derechos.omitidos()).toEqual(['X-art3']);
  });

  it('omite ids inexistentes, repetidos o sin resumen', () => {
    const base = new BaseNormativa([entrada('X-art1'), entrada('X-art2', { resumen_sencillo: '  ' })]);
    const derechos = new DerechosClave(base, ['X-art1', 'X-art1', 'X-art9', 'X-art2']);
    expect(derechos.lista().map((d) => d.id)).toEqual(['X-art1']);
  });

  it('con la base real muestra los derechos verificados de "Me pararon"', () => {
    const base = obtenerBaseNormativa();
    const lista = new DerechosClave(base).lista();
    const esperados = IDS_DERECHOS_ME_PARARON.filter((id) => base.existe(id));
    expect(lista.map((d) => d.id)).toEqual(esperados);
    expect(lista.length).toBeGreaterThan(0);
    for (const d of lista) {
      expect(d.cita.urlFuente).toMatch(/^https?:\/\//);
      expect(d.cita.articulo.trim()).not.toBe('');
    }
  });
});
