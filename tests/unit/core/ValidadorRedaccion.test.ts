import type { EntradaNormativa } from '../../../src/core/BaseNormativa';
import { ValidadorRedaccion } from '../../../src/core/ValidadorRedaccion';

const entrada = (textoLiteral: string, resumenSencillo = ''): EntradaNormativa => ({
  id: 'X-1',
  norma: 'Ley 769 de 2002',
  articulo: '135',
  titulo: 'Procedimiento',
  textoLiteral,
  modificadoPor: [],
  resumenSencillo,
  urlFuente: 'https://ejemplo.gov.co',
  fechaConsulta: '2026-11-08',
  temas: [],
});

describe('ValidadorRedaccion', () => {
  const v = new ValidadorRedaccion();
  const citada = entrada('dentro de los cinco (5) días hábiles siguientes; multa de diez mil pesos ($10.000.00)');

  it('cifras normaliza dígitos, separadores, centavos y números en palabras', () => {
    expect(ValidadorRedaccion.cifras('$10.000.00 y 10.000 y 1.423.500 y 007')).toEqual(['10000', '10000', '1423500', '7']);
    expect(ValidadorRedaccion.cifras('Tienes cinco días y DIECISÉIS horas, un comparendo')).toEqual(['5', '16']);
  });

  it('acepta las cifras de la entrada citada, de su norma y de su artículo', () => {
    expect(v.validar('Tienes 5 días hábiles. Lo dice el artículo 135 de la Ley 769 de 2002.', [citada])).toEqual({ valida: true });
    expect(v.validar('La multa es de $10.000, es decir, diez mil pesos.', [citada])).toEqual({ valida: true });
    expect(v.validar('Puedes pedir una audiencia.', [citada])).toEqual({ valida: true });
  });

  it('rechaza cifras que no están en lo citado', () => {
    expect(v.validar('Tienes 30 días.', [citada])).toEqual({ valida: false, motivo: 'cifra_sin_sustento' });
    expect(v.validar('Tienes veinte días.', [citada])).toEqual({ valida: false, motivo: 'cifra_sin_sustento' });
    expect(v.validar('Tienes 5 días.', [])).toEqual({ valida: false, motivo: 'cifra_sin_sustento' });
  });

  it('rechaza promesas y datos de contacto', () => {
    expect(v.validar('Te aseguro que sale bien.', [citada])).toEqual({ valida: false, motivo: 'frase_prohibida' });
    expect(v.validar('Está GARANTIZADA.', [citada])).toEqual({ valida: false, motivo: 'frase_prohibida' });
    expect(v.validar('Mira https://x.co/a', [citada])).toEqual({ valida: false, motivo: 'contacto' });
    expect(v.validar('Llama al 601 234 5678', [citada])).toEqual({ valida: false, motivo: 'contacto' });
  });
});
