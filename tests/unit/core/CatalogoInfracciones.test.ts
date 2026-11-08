import fixture from './fixtures/infracciones-prueba.json';
import infraccionesReales from '../../../data/infracciones.json';
import {
  CatalogoInfracciones,
  MENSAJE_CODIGO_NO_EXISTE,
  type CatalogoInfraccionesJSON,
} from '../../../src/core/CatalogoInfracciones';

describe('CatalogoInfracciones', () => {
  const catalogo = new CatalogoInfracciones(fixture as CatalogoInfraccionesJSON);

  it('normaliza las formas en que se escribe un código', () => {
    for (const texto of ['C02', 'C.02', 'C 02', 'c2', 'c-02', 'C. 02', 'CO2', 'cO2']) {
      expect(CatalogoInfracciones.normalizarCodigo(texto)).toBe('C02');
    }
    expect(CatalogoInfracciones.normalizarCodigo('C.12A')).toBe('C12A');
    expect(CatalogoInfracciones.normalizarCodigo('c12a')).toBe('C12A');
  });

  it('rechaza textos que no tienen forma de código', () => {
    for (const texto of ['', 'C', 'C00', 'Z02', 'C123', '02', 'CC02', 'F']) {
      expect(CatalogoInfracciones.normalizarCodigo(texto)).toBeNull();
    }
  });

  it('solo expone entradas verificadas y con forma de código', () => {
    const codigos = catalogo.todas().map((i) => i.codigo);
    expect(codigos).toEqual(['A01', 'C02', 'C12A']);
    expect(catalogo.existe('D05')).toBe(false);
  });

  it('busca normalizando el código y devuelve los datos de la entrada', () => {
    const infraccion = catalogo.buscar('c.2');
    expect(infraccion).not.toBeNull();
    expect(infraccion?.codigo).toBe('C02');
    expect(infraccion?.descripcionSencilla).toBe('Descripción sencilla de prueba C2.');
    expect(infraccion?.valorReferencia).toEqual({ pesos: 1000, vigencia: 2026, fuente: 'Fuente de prueba' });
    expect(catalogo.buscar('B99')).toBeNull();
    expect(catalogo.buscar('basura')).toBeNull();
  });

  it('valida el código con el mensaje del criterio CA-09.3', () => {
    expect(catalogo.validarCodigo('B01')).toEqual({ valido: false, motivo: 'no_existe', mensaje: MENSAJE_CODIGO_NO_EXISTE });
    expect(MENSAJE_CODIGO_NO_EXISTE).toBe('Ese código no aparece en el Código de Tránsito. Revísalo.');
    const formato = catalogo.validarCodigo('XYZ');
    expect(formato.valido).toBe(false);
    if (!formato.valido) expect(formato.motivo).toBe('formato');
    const ok = catalogo.validarCodigo('C 02');
    expect(ok.valido).toBe(true);
    if (ok.valido) expect(ok.codigo).toBe('C02');
  });

  it('las entradas quedan congeladas', () => {
    const infraccion = catalogo.buscar('A01');
    expect(Object.isFrozen(infraccion)).toBe(true);
  });

  it('carga el catálogo real sin incluir entradas no verificadas', () => {
    const real = infraccionesReales as CatalogoInfraccionesJSON;
    const reales = new CatalogoInfracciones(real);
    const verificados = new Set(real.infracciones.filter((i) => i.verificado).map((i) => i.codigo));
    expect(reales.todas().length).toBeGreaterThan(0);
    for (const i of reales.todas()) expect(verificados.has(i.codigo)).toBe(true);
    for (const i of real.infracciones.filter((x) => !x.verificado)) expect(reales.existe(i.codigo)).toBe(false);
  });
});
