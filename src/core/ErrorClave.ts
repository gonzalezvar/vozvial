export type MotivoErrorClave = 'secreto_incorrecto' | 'datos_invalidos' | 'descifrado_fallido';

/** Error de GestorClaves: secreto que no corresponde, datos dañados o cifrado alterado. */
export class ErrorClave extends Error {
  constructor(
    readonly motivo: MotivoErrorClave,
    mensaje: string,
    opciones?: { cause?: unknown },
  ) {
    super(mensaje, opciones);
    this.name = 'ErrorClave';
    // Mantiene instanceof cuando el codigo se transpila a ES5 (Babel).
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
