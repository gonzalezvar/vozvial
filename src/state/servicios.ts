import { GestorClaves } from '../core/GestorClaves';
import { AlmacenCifrado } from '../services/AlmacenCifrado';
import { ClienteCuentas } from '../services/ClienteCuentas';
import { ClienteSincronizacion } from '../services/ClienteSincronizacion';
import { RepositorioCasos } from '../services/RepositorioCasos';
import { ServicioCuenta } from '../services/ServicioCuenta';
import { SincronizadorCasos } from '../services/SincronizadorCasos';
import { CONFIG } from './configuracion';
import { useSesion } from './sesion';
import { useSincronizacion } from './sincronizacion';

// Instancias unicas para la app. Las pruebas unitarias crean las suyas con sus propias opciones.
let almacen: AlmacenCifrado | null = null;
let cuenta: ServicioCuenta | null = null;
let casos: RepositorioCasos | null = null;
let sincronizador: SincronizadorCasos | null = null;
let tokenDelSincronizador: string | null = null;
const oyentesDatos = new Set<() => void>();

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
  if (!cuenta) {
    const crypto = cryptoDelNavegador();
    cuenta = new ServicioCuenta(obtenerAlmacen(), {
      crypto,
      iteraciones: CONFIG.iteracionesPbkdf2,
      bloqueoMs: CONFIG.bloqueoMs,
      // Mismo origen (Railway y e2e) o EXPO_PUBLIC_API_URL.
      remoto: new ClienteCuentas({ crypto }),
    });
  }
  return cuenta;
}

export function obtenerRepositorioCasos(): RepositorioCasos {
  casos ??= new RepositorioCasos(
    obtenerAlmacen(),
    () => useSesion.getState().claveDatos,
    cryptoDelNavegador(),
    () => new Date(),
    obtenerSincronizador,
  );
  return casos;
}

/** Avisa cuando llegan casos del servidor (la lista de casos se suscribe para recargarse). */
export function alCambiarDatosRemotos(oyente: () => void): () => void {
  oyentesDatos.add(oyente);
  return () => oyentesDatos.delete(oyente);
}

/**
 * Sincronizador de la sesion con el servidor. null si no hay token (sin internet al entrar o
 * cuenta solo en el dispositivo): los cambios quedan en IndexedDB y se suben en la proxima sesion.
 */
export function obtenerSincronizador(): SincronizadorCasos | null {
  const token = useSesion.getState().tokenServidor;
  if (!token) {
    detenerSincronizador();
    return null;
  }
  if (!sincronizador || tokenDelSincronizador !== token) {
    sincronizador?.detener();
    tokenDelSincronizador = token;
    sincronizador = new SincronizadorCasos({
      almacen: obtenerAlmacen(),
      gestor: obtenerServicioCuenta().gestorClaves,
      remoto: new ClienteSincronizacion({ obtenerToken: () => useSesion.getState().tokenServidor }),
      obtenerClave: () => useSesion.getState().claveDatos,
      alCambiarDatos: () => oyentesDatos.forEach((o) => o()),
      alCambiarEstado: (estado, mensaje) => useSincronizacion.getState().fijar(estado, mensaje),
    });
  }
  return sincronizador;
}

export function detenerSincronizador(): void {
  sincronizador?.detener();
  sincronizador = null;
  tokenDelSincronizador = null;
}
