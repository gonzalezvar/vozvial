import { CodigoRecuperacion } from '../../../src/core/CodigoRecuperacion';
import { ErrorClave } from '../../../src/core/ErrorClave';
import { GestorClaves } from '../../../src/core/GestorClaves';

const ITERACIONES = 1000;

describe('GestorClaves', () => {
  const gestor = new GestorClaves(globalThis.crypto, { iteraciones: ITERACIONES });

  it('cifra y descifra texto y bytes con la clave de datos', async () => {
    const clave = await gestor.generarClaveDatos();
    const cifrado = await gestor.cifrar(clave, 'Caso del 8 de noviembre');
    expect(cifrado.datos).not.toContain('noviembre');
    await expect(gestor.descifrarTexto(clave, cifrado)).resolves.toBe('Caso del 8 de noviembre');

    const bytes = new Uint8Array([1, 2, 3, 250]);
    const cifradoBytes = await gestor.cifrar(clave, bytes);
    await expect(gestor.descifrar(clave, cifradoBytes)).resolves.toEqual(bytes);
  });

  it('cada cifrado usa un iv distinto', async () => {
    const clave = await gestor.generarClaveDatos();
    const a = await gestor.cifrar(clave, 'igual');
    const b = await gestor.cifrar(clave, 'igual');
    expect(a.iv).not.toBe(b.iv);
    expect(a.datos).not.toBe(b.datos);
  });

  it('envuelve con PIN y con codigo, y ambos desenvuelven la misma clave', async () => {
    const pin = '482915';
    const codigo = CodigoRecuperacion.generar(globalThis.crypto);
    const claveDatos = await gestor.generarClaveDatos();
    const conPin = await gestor.envolver(claveDatos, pin);
    const conCodigo = await gestor.envolver(claveDatos, codigo);

    expect(conPin.iteraciones).toBe(ITERACIONES);
    expect(conPin.sal).not.toBe(conCodigo.sal);
    expect(JSON.stringify(conPin)).not.toContain(pin);

    const cifrado = await gestor.cifrar(claveDatos, 'evidencia');
    const desdePin = await gestor.desenvolver(conPin, pin);
    const desdeCodigo = await gestor.desenvolver(conCodigo, codigo);
    await expect(gestor.descifrarTexto(desdePin, cifrado)).resolves.toBe('evidencia');
    await expect(gestor.descifrarTexto(desdeCodigo, cifrado)).resolves.toBe('evidencia');

    const crudoA = new Uint8Array(await globalThis.crypto.subtle.exportKey('raw', desdePin));
    const crudoB = new Uint8Array(await globalThis.crypto.subtle.exportKey('raw', desdeCodigo));
    expect(crudoA).toEqual(crudoB);
  });

  it('acepta una sal dada y rechaza sales de otro largo', async () => {
    const claveDatos = await gestor.generarClaveDatos();
    const sal = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const envuelta = await gestor.envolver(claveDatos, '482915', sal);
    expect(envuelta.sal).toBe(Buffer.from(sal).toString('base64'));
    await expect(gestor.envolver(claveDatos, '482915', new Uint8Array(8))).rejects.toThrow(RangeError);
  });

  it('CA-03.2 un secreto incorrecto lanza ErrorClave', async () => {
    const claveDatos = await gestor.generarClaveDatos();
    const envuelta = await gestor.envolver(claveDatos, 'ABCDEFGHJKMN');
    const error = await gestor.desenvolver(envuelta, 'ABCDEFGHJKMP').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorClave);
    expect((error as ErrorClave).motivo).toBe('secreto_incorrecto');
  });

  it('una envoltura dañada lanza ErrorClave por datos invalidos', async () => {
    const claveDatos = await gestor.generarClaveDatos();
    const envuelta = await gestor.envolver(claveDatos, '482915');
    const error = await gestor
      .desenvolver({ ...envuelta, iv: 'AAAA' }, '482915')
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorClave);
    expect((error as ErrorClave).motivo).toBe('datos_invalidos');
  });

  it('descifrar con otra clave o datos alterados lanza ErrorClave', async () => {
    const clave = await gestor.generarClaveDatos();
    const otra = await gestor.generarClaveDatos();
    const cifrado = await gestor.cifrar(clave, 'secreto');
    await expect(gestor.descifrar(otra, cifrado)).rejects.toMatchObject({
      name: 'ErrorClave',
      motivo: 'descifrado_fallido',
    });
    const bytes = Buffer.from(cifrado.datos, 'base64');
    bytes[0] = (bytes[0] ?? 0) ^ 1;
    await expect(
      gestor.descifrar(clave, { ...cifrado, datos: bytes.toString('base64') }),
    ).rejects.toBeInstanceOf(ErrorClave);
  });

  it('CA-03.1 cambiar el PIN con el codigo mantiene descifrables los datos', async () => {
    const pinViejo = '482915';
    const pinNuevo = '739204';
    const codigo = CodigoRecuperacion.generar(globalThis.crypto);
    const claveDatos = await gestor.generarClaveDatos();
    const conPin = await gestor.envolver(claveDatos, pinViejo);
    const conCodigo = await gestor.envolver(claveDatos, codigo);
    const caso = await gestor.cifrar(claveDatos, '{"id":"caso-1"}');

    // El usuario olvido el PIN: escribe el codigo con espacios y minusculas.
    const escrito = CodigoRecuperacion.formatear(codigo).toLowerCase().replace(/-/g, ' ');
    const nuevaConPin = await gestor.reenvolver(
      conCodigo,
      CodigoRecuperacion.normalizar(escrito),
      pinNuevo,
    );

    const clave = await gestor.desenvolver(nuevaConPin, pinNuevo);
    await expect(gestor.descifrarTexto(clave, caso)).resolves.toBe('{"id":"caso-1"}');
    await expect(gestor.desenvolver(nuevaConPin, pinViejo)).rejects.toBeInstanceOf(ErrorClave);
    // La envoltura vieja sigue abriendo con el PIN viejo hasta que la app la reemplace.
    await expect(gestor.desenvolver(conPin, pinViejo)).resolves.toBeDefined();
  });

  it('desenvuelve con las iteraciones guardadas aunque el gestor cambie', async () => {
    const claveDatos = await gestor.generarClaveDatos();
    const envuelta = await gestor.envolver(claveDatos, '482915');
    const otro = new GestorClaves(globalThis.crypto, { iteraciones: 1500 });
    await expect(otro.desenvolver(envuelta, '482915')).resolves.toBeDefined();
  });
});
