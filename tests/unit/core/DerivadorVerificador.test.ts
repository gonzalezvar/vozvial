import { CodificacionBase64 } from '../../../src/core/CodificacionBase64';
import { DerivadorPBKDF2 } from '../../../src/core/DerivadorPBKDF2';
import { DerivadorVerificador } from '../../../src/core/DerivadorVerificador';
import { GestorClaves } from '../../../src/core/GestorClaves';

const ITERACIONES = 1000;

describe('DerivadorVerificador', () => {
  const derivador = new DerivadorVerificador(globalThis.crypto);

  it('genera parametros con sal de 16 bytes y es determinista para el mismo PIN y sal', async () => {
    const parametros = derivador.nuevosParametros(ITERACIONES);
    expect(CodificacionBase64.decodificar(parametros.salAuth)).toHaveLength(16);
    expect(DerivadorVerificador.esParametros(parametros)).toBe(true);
    const a = await derivador.verificadorPin('482915', parametros);
    const b = await derivador.verificadorPin('482915', parametros);
    expect(a).toBe(b);
    expect(CodificacionBase64.decodificar(a)).toHaveLength(32);
  });

  it('cambia con otro PIN, otra sal u otras iteraciones', async () => {
    const parametros = derivador.nuevosParametros(ITERACIONES);
    const base = await derivador.verificadorPin('482915', parametros);
    await expect(derivador.verificadorPin('482916', parametros)).resolves.not.toBe(base);
    await expect(derivador.verificadorPin('482915', derivador.nuevosParametros(ITERACIONES))).resolves.not.toBe(base);
    await expect(derivador.verificadorPin('482915', { ...parametros, iteraciones: ITERACIONES + 1 })).resolves.not.toBe(base);
  });

  it('el verificador del PIN no coincide con PBKDF2 directo del PIN (separacion de dominio)', async () => {
    const parametros = derivador.nuevosParametros(ITERACIONES);
    const sal = CodificacionBase64.decodificar(parametros.salAuth);
    const directo = await new DerivadorPBKDF2(globalThis.crypto).derivarBits('482915', sal, ITERACIONES, 256);
    await expect(derivador.verificadorPin('482915', parametros)).resolves.not.toBe(CodificacionBase64.codificar(directo));
  });

  it('el verificador no abre la clave de datos aunque se use la misma sal que la envoltura', async () => {
    const gestor = new GestorClaves(globalThis.crypto, { iteraciones: ITERACIONES });
    const claveDatos = await gestor.generarClaveDatos();
    const envuelta = await gestor.envolver(claveDatos, '482915');
    const verificador = await derivador.verificadorPin('482915', { salAuth: envuelta.sal, iteraciones: ITERACIONES });
    await expect(gestor.desenvolver(envuelta, verificador)).rejects.toThrow();
  });

  it('PIN y codigo derivan valores distintos y el codigo se normaliza', async () => {
    const parametros = derivador.nuevosParametros(ITERACIONES);
    const conGuiones = await derivador.verificadorCodigo('rsen-dema-4827', parametros);
    await expect(derivador.verificadorCodigo('RSENDEMA4827', parametros)).resolves.toBe(conGuiones);
    await expect(derivador.verificadorPin('RSENDEMA4827', parametros)).resolves.not.toBe(conGuiones);
  });

  it('rechaza parametros invalidos', async () => {
    expect(DerivadorVerificador.esParametros({ salAuth: 'corta', iteraciones: 10 })).toBe(false);
    expect(DerivadorVerificador.esParametros({ salAuth: derivador.generarSal(), iteraciones: 0 })).toBe(false);
    expect(DerivadorVerificador.esParametros(null)).toBe(false);
    await expect(derivador.verificadorPin('482915', { salAuth: 'AAAA', iteraciones: 1000 })).rejects.toThrow(RangeError);
  });
});
