import { GestorClaves } from '../core/GestorClaves';
import { AlmacenCifrado } from '../services/AlmacenCifrado';
import { RepositorioCasos } from '../services/RepositorioCasos';
import { ServicioCuenta } from '../services/ServicioCuenta';
import { CONFIG } from './configuracion';
import { useSesion } from './sesion';

// Instancias unicas para la app. Las pruebas unitarias crean las suyas con sus propias opciones.
let almacen: AlmacenCifrado | null = null;
let cuenta: ServicioCuenta | null = null;
let casos: RepositorioCasos | null = null;

function cryptoDelNavegador(): Crypto {
  const c = globalThis.crypto;
  if (!c?.subtle) throw new Error('Este navegador no permite cifrar datos. Abre VozVial en un navegador actualizado.');
  return c;
}

export function obtenerAlmacen(): AlmacenCifrado {
  if (!almacen) {
    const crypto = cryptoDelNavegador();
    almacen = new AlmacenCifrado(new GestorClaves(crypto, { iteraciones: CONFIG.iteracionesPbkdf2 }), crypto);
  }
  return almacen;
}

export function obtenerServicioCuenta(): ServicioCuenta {
  cuenta ??= new ServicioCuenta(obtenerAlmacen(), {
    crypto: cryptoDelNavegador(),
    iteraciones: CONFIG.iteracionesPbkdf2,
    bloqueoMs: CONFIG.bloqueoMs,
  });
  return cuenta;
}

export function obtenerRepositorioCasos(): RepositorioCasos {
  casos ??= new RepositorioCasos(obtenerAlmacen(), () => useSesion.getState().claveDatos, cryptoDelNavegador());
  return casos;
}
