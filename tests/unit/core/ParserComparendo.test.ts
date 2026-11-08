import { ParserComparendo, type PalabraOCR } from '../../../src/core/ParserComparendo';

// Texto sintético con datos ficticios. No corresponde a ningún comparendo real.
const TEXTO_VIA = `ORDEN DE COMPARENDO NACIONAL
Comparendo No. 99999000000012345678
Fecha: 13/11/2026  Hora: 15:40
Placa: XYZ 123   Servicio: Particular
Código de infracción: C.02
Lugar: Calle de prueba 1
Nombre: PERSONA FICTICIA  Identificación No. 1000000001`;

function palabrasDe(texto: string, confianza: number, bajas: Record<string, number> = {}): PalabraOCR[] {
  return texto
    .split(/\s+/)
    .filter((t) => t !== '')
    .map((t) => ({ texto: t, confianza: bajas[t] ?? confianza }));
}

describe('ParserComparendo', () => {
  const parser = new ParserComparendo();

  it('extrae los campos de un comparendo en vía', () => {
    const { campos } = parser.analizar(TEXTO_VIA);
    expect(campos.numero).toEqual({ valor: '99999000000012345678', confianza: 100, dudoso: false });
    expect(campos.fecha).toEqual({ valor: '2026-11-13', confianza: 100, dudoso: false });
    expect(campos.placa).toEqual({ valor: 'XYZ123', confianza: 100, dudoso: false });
    expect(campos.codigoInfraccion).toEqual({ valor: 'C02', confianza: 100, dudoso: false });
    expect(campos.tipo).toEqual({ valor: null, confianza: 0, dudoso: true });
  });

  it('combina la confianza con las palabras del OCR y marca dudosos', () => {
    const palabras = palabrasDe(TEXTO_VIA, 95, { '123': 40, 'C.02': 88 });
    const { campos } = parser.analizar(TEXTO_VIA, palabras);
    expect(campos.numero.confianza).toBe(95);
    expect(campos.numero.dudoso).toBe(false);
    expect(campos.placa).toEqual({ valor: 'XYZ123', confianza: 40, dudoso: true });
    expect(campos.codigoInfraccion.confianza).toBe(88);
  });

  it('el umbral de duda es configurable', () => {
    const palabras = palabrasDe(TEXTO_VIA, 80);
    expect(new ParserComparendo({ umbralDuda: 90 }).analizar(TEXTO_VIA, palabras).campos.fecha.dudoso).toBe(true);
    expect(new ParserComparendo({ umbralDuda: 70 }).analizar(TEXTO_VIA, palabras).campos.fecha.dudoso).toBe(false);
    expect(() => new ParserComparendo({ umbralDuda: 120 })).toThrow(RangeError);
  });

  it('reconoce fotodetección, fecha larga y no confunde la fecha de notificación', () => {
    const texto = `COMPARENDO ELECTRÓNICO - SISTEMA DE FOTODETECCIÓN
Número 88888000000098765432
Fecha de notificación: 20/11/2026
Fecha de la infracción: 13 de noviembre de 2026
Placa del vehículo: abc12d
Infracción C 29`;
    const { campos } = parser.analizar(texto);
    expect(campos.tipo).toEqual({ valor: 'fotodeteccion', confianza: 100, dudoso: false });
    expect(campos.fecha.valor).toBe('2026-11-13');
    expect(campos.numero.valor).toBe('88888000000098765432');
    expect(campos.placa.valor).toBe('ABC12D');
    expect(campos.codigoInfraccion.valor).toBe('C29');
  });

  it('acepta fecha AAAA-MM-DD y abreviaturas de mes', () => {
    expect(parser.analizar('Fecha 2026-11-13').campos.fecha.valor).toBe('2026-11-13');
    expect(parser.analizar('Fecha: 5 nov. 2026').campos.fecha.valor).toBe('2026-11-05');
    expect(parser.analizar('Fecha: 31/02/2026').campos.fecha.valor).toBeNull();
  });

  it('tolera O en lugar de 0 pero deja el dato para revisar', () => {
    const { campos } = parser.analizar('Comparendo No. 1234O0567890\nPlaca: XYZ 1O3\nCódigo: CO2');
    expect(campos.numero.valor).toBe('123400567890');
    expect(campos.numero.dudoso).toBe(true);
    expect(campos.placa.valor).toBe('XYZ103');
    expect(campos.placa.dudoso).toBe(true);
    expect(campos.codigoInfraccion.valor).toBe('C02');
    expect(campos.codigoInfraccion.dudoso).toBe(true);
  });

  it('acepta códigos con letra de sufijo', () => {
    expect(parser.analizar('Código de infracción: C.12A').campos.codigoInfraccion.valor).toBe('C12A');
  });

  it('sin etiquetas extrae lo que puede y lo marca dudoso', () => {
    const { campos } = parser.analizar('XYZ123 C02 99999000000012345678');
    expect(campos.placa).toEqual({ valor: 'XYZ123', confianza: 60, dudoso: true });
    expect(campos.codigoInfraccion).toEqual({ valor: 'C02', confianza: 60, dudoso: true });
    expect(campos.numero).toEqual({ valor: '99999000000012345678', confianza: 60, dudoso: true });
  });

  it('no toma el correo electrónico como fotodetección', () => {
    expect(parser.analizar('Correo electrónico: persona@ejemplo.test').campos.tipo.valor).toBeNull();
  });

  it('con texto vacío todos los campos quedan vacíos y dudosos', () => {
    const { campos } = parser.analizar('');
    for (const campo of Object.values(campos)) expect(campo).toEqual({ valor: null, confianza: 0, dudoso: true });
  });

  it('valida el formato de cada campo', () => {
    expect(ParserComparendo.formatoValido('numero', '12345')).toBe(false);
    expect(ParserComparendo.formatoValido('fecha', '2026-02-30')).toBe(false);
    expect(ParserComparendo.formatoValido('placa', 'AB1234')).toBe(false);
    expect(ParserComparendo.formatoValido('codigoInfraccion', 'C.02')).toBe(false);
    expect(ParserComparendo.formatoValido('codigoInfraccion', 'C02')).toBe(true);
    expect(ParserComparendo.formatoValido('tipo', 'via')).toBe(true);
  });
});
