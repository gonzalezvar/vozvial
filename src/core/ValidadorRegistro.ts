export type CampoRegistro = 'nombre' | 'celular' | 'pin' | 'confirmacionPin' | 'autorizaDatos';

export type ReglaRegistro =
  | 'obligatorio'
  | 'nombre_minimo_letras'
  | 'celular_formato'
  | 'pin_seis_digitos'
  | 'pin_secuencia'
  | 'pin_digitos_iguales'
  | 'pin_confirmacion';

export interface DatosRegistro {
  nombre: string;
  celular: string;
  pin: string;
  confirmacionPin: string;
  autorizaDatos: boolean;
}

export interface ErrorRegistro {
  campo: CampoRegistro;
  regla: ReglaRegistro;
  mensaje: string;
}

export interface ResultadoValidacionRegistro {
  valido: boolean;
  errores: ErrorRegistro[];
}

/** Textos que ve y escucha el usuario (CA-01.2 a CA-01.5). */
export const MENSAJES_REGISTRO = {
  nombreObligatorio: 'Escribe tu nombre.',
  nombreMinimo: 'Tu nombre debe tener al menos 2 letras.',
  celularObligatorio: 'Escribe tu número de celular.',
  // Literal de CA-01.3 en docs/historias-usuario.md.
  celularFormato: 'Escribe tu celular de 10 dígitos, por ejemplo 3001234567',
  pinObligatorio: 'Escribe un PIN de 6 números.',
  pinSeisDigitos: 'Tu PIN debe tener exactamente 6 números, sin letras ni espacios.',
  pinSecuencia: 'Tu PIN no puede ser una secuencia como 123456 o 654321.',
  pinIguales: 'Tu PIN no puede tener todos los números iguales, como 111111.',
  confirmacionObligatoria: 'Escribe tu PIN otra vez para confirmarlo.',
  confirmacionDistinta: 'La confirmación no es igual a tu PIN. Escríbelo otra vez.',
  autorizacionObligatoria:
    'Para crear tu cuenta, marca que autorizas el tratamiento de tus datos.',
} as const;

/** Reglas del formulario de HU-01. Devuelve un error por cada regla que falla. */
export class ValidadorRegistro {
  static validar(datos: DatosRegistro): ResultadoValidacionRegistro {
    return new ValidadorRegistro().validar(datos);
  }

  validar(datos: DatosRegistro): ResultadoValidacionRegistro {
    const errores: ErrorRegistro[] = [
      ...this.validarNombre(datos.nombre),
      ...this.validarCelular(datos.celular),
      ...this.validarPin(datos.pin),
      ...this.validarConfirmacion(datos.pin, datos.confirmacionPin),
      ...this.validarAutorizacion(datos.autorizaDatos),
    ];
    return { valido: errores.length === 0, errores };
  }

  /** Quita espacios, guiones, puntos y parentesis: "300 123-4567" -> "3001234567". */
  static normalizarCelular(celular: string): string {
    return celular.replace(/[\s\-.()]/g, '');
  }

  static esSecuencia(pin: string): boolean {
    if (!/^\d{2,}$/.test(pin)) return false;
    const digitos = [...pin].map(Number);
    const paso = (digitos[1] ?? 0) - (digitos[0] ?? 0);
    if (paso !== 1 && paso !== -1) return false;
    return digitos.every((d, i) => i === 0 || d - (digitos[i - 1] ?? 0) === paso);
  }

  static todosIguales(pin: string): boolean {
    return pin.length > 0 && [...pin].every((c) => c === pin[0]);
  }

  private validarNombre(nombre: string): ErrorRegistro[] {
    const limpio = (nombre ?? '').trim();
    if (limpio === '') {
      return [{ campo: 'nombre', regla: 'obligatorio', mensaje: MENSAJES_REGISTRO.nombreObligatorio }];
    }
    const letras = limpio.match(/\p{L}/gu)?.length ?? 0;
    if (letras < 2) {
      return [
        { campo: 'nombre', regla: 'nombre_minimo_letras', mensaje: MENSAJES_REGISTRO.nombreMinimo },
      ];
    }
    return [];
  }

  private validarCelular(celular: string): ErrorRegistro[] {
    const limpio = ValidadorRegistro.normalizarCelular(celular ?? '');
    if (limpio === '') {
      return [
        { campo: 'celular', regla: 'obligatorio', mensaje: MENSAJES_REGISTRO.celularObligatorio },
      ];
    }
    if (!/^3\d{9}$/.test(limpio)) {
      return [
        { campo: 'celular', regla: 'celular_formato', mensaje: MENSAJES_REGISTRO.celularFormato },
      ];
    }
    return [];
  }

  private validarPin(pin: string): ErrorRegistro[] {
    const valor = pin ?? '';
    if (valor === '') {
      return [{ campo: 'pin', regla: 'obligatorio', mensaje: MENSAJES_REGISTRO.pinObligatorio }];
    }
    if (!/^\d{6}$/.test(valor)) {
      return [{ campo: 'pin', regla: 'pin_seis_digitos', mensaje: MENSAJES_REGISTRO.pinSeisDigitos }];
    }
    if (ValidadorRegistro.todosIguales(valor)) {
      return [{ campo: 'pin', regla: 'pin_digitos_iguales', mensaje: MENSAJES_REGISTRO.pinIguales }];
    }
    if (ValidadorRegistro.esSecuencia(valor)) {
      return [{ campo: 'pin', regla: 'pin_secuencia', mensaje: MENSAJES_REGISTRO.pinSecuencia }];
    }
    return [];
  }

  private validarConfirmacion(pin: string, confirmacion: string): ErrorRegistro[] {
    const valor = confirmacion ?? '';
    if (valor === '') {
      return [
        {
          campo: 'confirmacionPin',
          regla: 'obligatorio',
          mensaje: MENSAJES_REGISTRO.confirmacionObligatoria,
        },
      ];
    }
    // Sin PIN no hay contra que comparar; ese error ya lo reporta el campo pin.
    if ((pin ?? '') !== '' && valor !== pin) {
      return [
        {
          campo: 'confirmacionPin',
          regla: 'pin_confirmacion',
          mensaje: MENSAJES_REGISTRO.confirmacionDistinta,
        },
      ];
    }
    return [];
  }

  private validarAutorizacion(autoriza: boolean): ErrorRegistro[] {
    if (autoriza !== true) {
      return [
        {
          campo: 'autorizaDatos',
          regla: 'obligatorio',
          mensaje: MENSAJES_REGISTRO.autorizacionObligatoria,
        },
      ];
    }
    return [];
  }
}
