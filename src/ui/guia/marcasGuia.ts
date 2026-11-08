// Marcas de la guia en localStorage: si ya se vio el recorrido y si ya se ofrecio en el inicio.
// Son una comodidad de este navegador; si el almacenamiento falla, la app sigue igual.

export const CLAVE_RECORRIDO_VISTO = 'vozvial.guia.recorridoVisto';
export const CLAVE_OFERTA_MOSTRADA = 'vozvial.guia.ofertaMostrada';

/** Lo minimo de Storage que se usa; permite probar sin navegador. */
export interface AlmacenMarcas {
  getItem(clave: string): string | null;
  setItem(clave: string, valor: string): void;
}

function almacenNavegador(): AlmacenMarcas | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function leer(clave: string, almacen: AlmacenMarcas | null): string | null | undefined {
  if (!almacen) return undefined;
  try {
    return almacen.getItem(clave);
  } catch {
    return undefined;
  }
}

function escribir(clave: string, almacen: AlmacenMarcas | null): void {
  if (!almacen) return;
  try {
    almacen.setItem(clave, new Date().toISOString());
  } catch {
    // Sin almacenamiento la marca no se guarda; no es un error para la persona.
  }
}

/**
 * Se ofrece el recorrido una sola vez: si no se vio antes y no se ofrecio ya.
 * Si no se puede leer el almacenamiento no se ofrece, para no insistir en cada visita.
 */
export function debeOfrecerRecorrido(almacen: AlmacenMarcas | null = almacenNavegador()): boolean {
  const visto = leer(CLAVE_RECORRIDO_VISTO, almacen);
  const ofrecido = leer(CLAVE_OFERTA_MOSTRADA, almacen);
  if (visto === undefined || ofrecido === undefined) return false;
  return visto === null && ofrecido === null;
}

export function marcarOfertaMostrada(almacen: AlmacenMarcas | null = almacenNavegador()): void {
  escribir(CLAVE_OFERTA_MOSTRADA, almacen);
}

export function marcarRecorridoVisto(almacen: AlmacenMarcas | null = almacenNavegador()): void {
  escribir(CLAVE_RECORRIDO_VISTO, almacen);
}
