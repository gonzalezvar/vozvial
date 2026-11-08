import { MENSAJES_REGISTRO, ValidadorRegistro, type DatosRegistro } from '../../../src/core/ValidadorRegistro';

const validos: DatosRegistro = {
  nombre: 'María Pérez',
  celular: '3001234567',
  pin: '482915',
  confirmacionPin: '482915',
  autorizaDatos: true,
};

function errores(cambios: Partial<DatosRegistro>) {
  return ValidadorRegistro.validar({ ...validos, ...cambios }).errores;
}

describe('ValidadorRegistro', () => {
  it('acepta datos validos', () => {
    expect(ValidadorRegistro.validar(validos)).toEqual({ valido: true, errores: [] });
    expect(new ValidadorRegistro().validar(validos).valido).toBe(true);
  });

  it('CA-01.2 marca cada campo vacio como obligatorio', () => {
    const resultado = ValidadorRegistro.validar({
      nombre: '  ',
      celular: '',
      pin: '',
      confirmacionPin: '',
      autorizaDatos: false,
    });
    expect(resultado.valido).toBe(false);
    expect(resultado.errores.map((e) => [e.campo, e.regla])).toEqual([
      ['nombre', 'obligatorio'],
      ['celular', 'obligatorio'],
      ['pin', 'obligatorio'],
      ['confirmacionPin', 'obligatorio'],
      ['autorizaDatos', 'obligatorio'],
    ]);
    for (const e of resultado.errores) expect(e.mensaje.length).toBeGreaterThan(5);
  });

  it('nombre necesita al menos 2 letras', () => {
    expect(errores({ nombre: 'J' })).toEqual([
      { campo: 'nombre', regla: 'nombre_minimo_letras', mensaje: MENSAJES_REGISTRO.nombreMinimo },
    ]);
    expect(errores({ nombre: '1 2' })[0]?.regla).toBe('nombre_minimo_letras');
    expect(errores({ nombre: 'Íñ' })).toEqual([]);
  });

  it.each(['300123456', '30012345678', '2001234567', '300123456a', '+573001234567'])(
    'CA-01.3 rechaza el celular %s con el mensaje literal',
    (celular) => {
      expect(errores({ celular })).toEqual([
        {
          campo: 'celular',
          regla: 'celular_formato',
          mensaje: 'Escribe tu celular de 10 dígitos, por ejemplo 3001234567',
        },
      ]);
    },
  );

  it('acepta celular con espacios o guiones', () => {
    expect(errores({ celular: '300 123-4567' })).toEqual([]);
    expect(ValidadorRegistro.normalizarCelular('(300) 123.45 67')).toBe('3001234567');
  });

  it.each(['12345', '1234567', '12a456', '12 456'])('CA-01.4 rechaza PIN sin 6 digitos: %s', (pin) => {
    const e = errores({ pin, confirmacionPin: pin });
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ campo: 'pin', regla: 'pin_seis_digitos' });
  });

  it.each(['123456', '654321', '234567', '987654', '012345', '456789', '543210'])(
    'CA-01.4 rechaza la secuencia %s',
    (pin) => {
      const e = errores({ pin, confirmacionPin: pin });
      expect(e).toEqual([
        { campo: 'pin', regla: 'pin_secuencia', mensaje: MENSAJES_REGISTRO.pinSecuencia },
      ]);
      expect(e[0]?.mensaje).toContain('secuencia como 123456');
    },
  );

  it.each(['000000', '111111', '999999'])('CA-01.4 rechaza digitos iguales %s', (pin) => {
    expect(errores({ pin, confirmacionPin: pin })).toEqual([
      { campo: 'pin', regla: 'pin_digitos_iguales', mensaje: MENSAJES_REGISTRO.pinIguales },
    ]);
  });

  it.each(['123457', '135791', '112233', '890123'])('acepta PIN no trivial %s', (pin) => {
    expect(errores({ pin, confirmacionPin: pin })).toEqual([]);
  });

  it('CA-01.4 rechaza confirmacion distinta', () => {
    expect(errores({ confirmacionPin: '482916' })).toEqual([
      {
        campo: 'confirmacionPin',
        regla: 'pin_confirmacion',
        mensaje: MENSAJES_REGISTRO.confirmacionDistinta,
      },
    ]);
  });

  it('PIN debil y confirmacion distinta dan un error por regla', () => {
    const e = errores({ pin: '111111', confirmacionPin: '222222' });
    expect(e.map((x) => x.regla)).toEqual(['pin_digitos_iguales', 'pin_confirmacion']);
  });

  it('CA-01.5 exige la autorizacion de datos', () => {
    expect(errores({ autorizaDatos: false })).toEqual([
      {
        campo: 'autorizaDatos',
        regla: 'obligatorio',
        mensaje: MENSAJES_REGISTRO.autorizacionObligatoria,
      },
    ]);
  });
});
