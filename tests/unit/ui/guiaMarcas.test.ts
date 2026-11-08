import {
  CLAVE_OFERTA_MOSTRADA,
  CLAVE_RECORRIDO_VISTO,
  debeOfrecerRecorrido,
  marcarOfertaMostrada,
  marcarRecorridoVisto,
  type AlmacenMarcas,
} from '../../../src/ui/guia/marcasGuia';

function almacenMemoria(): AlmacenMarcas & { datos: Map<string, string> } {
  const datos = new Map<string, string>();
  return {
    datos,
    getItem: (clave) => datos.get(clave) ?? null,
    setItem: (clave, valor) => void datos.set(clave, valor),
  };
}

const almacenQueFalla: AlmacenMarcas = {
  getItem: () => {
    throw new Error('bloqueado');
  },
  setItem: () => {
    throw new Error('bloqueado');
  },
};

describe('marcas de la guia', () => {
  test('la primera vez se ofrece y despues de mostrarla ya no', () => {
    const almacen = almacenMemoria();
    expect(debeOfrecerRecorrido(almacen)).toBe(true);
    marcarOfertaMostrada(almacen);
    expect(almacen.datos.has(CLAVE_OFERTA_MOSTRADA)).toBe(true);
    expect(debeOfrecerRecorrido(almacen)).toBe(false);
  });

  test('si ya vio el recorrido (por ejemplo desde la bienvenida), no se ofrece', () => {
    const almacen = almacenMemoria();
    marcarRecorridoVisto(almacen);
    expect(almacen.datos.has(CLAVE_RECORRIDO_VISTO)).toBe(true);
    expect(debeOfrecerRecorrido(almacen)).toBe(false);
  });

  test('sin almacenamiento o si falla no se rompe y no insiste', () => {
    expect(debeOfrecerRecorrido(null)).toBe(false);
    expect(debeOfrecerRecorrido(almacenQueFalla)).toBe(false);
    expect(() => marcarOfertaMostrada(almacenQueFalla)).not.toThrow();
    expect(() => marcarRecorridoVisto(null)).not.toThrow();
  });
});
