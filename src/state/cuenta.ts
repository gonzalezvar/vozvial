import type { SesionRemota } from '../services/ClienteCuentas';
import type { Perfil } from '../services/ServicioCuenta';
import { detenerSincronizador, obtenerServicioCuenta, obtenerSincronizador } from './servicios';
import { useSesion, type MotivoCierre } from './sesion';
import { useSincronizacion } from './sincronizacion';

/** Espera maxima de la primera sincronizacion al entrar en un dispositivo nuevo, antes de mostrar el inicio. */
const ESPERA_PRIMERA_SINCRONIZACION_MS = 20_000;

/**
 * Abre la sesion en memoria y, si hay sesion con el servidor, sincroniza los casos.
 * Con esperar, la promesa termina cuando los casos ya bajaron (o al pasar el tiempo maximo).
 */
export async function abrirSesion(
  datos: { claveDatos: CryptoKey; perfil: Perfil; sesion: SesionRemota | null },
  opciones: { esperarCasos?: boolean } = {},
): Promise<void> {
  useSincronizacion.getState().reiniciar();
  useSesion.getState().iniciar(datos.claveDatos, datos.perfil, datos.sesion?.token ?? null);
  void actualizarEstadoCuenta();
  const sincronizacion = obtenerSincronizador()?.sincronizarTodo();
  if (!sincronizacion || !opciones.esperarCasos) return;
  await Promise.race([sincronizacion, new Promise((r) => setTimeout(r, ESPERA_PRIMERA_SINCRONIZACION_MS))]);
}

/**
 * Despues de entrar con el PIN en este dispositivo: abre la sesion con el servidor en segundo plano
 * para no demorar la entrada (y para que funcione sin internet).
 */
export function conectarServidorEnSegundoPlano(pin: string, perfil: Perfil): void {
  const claveAlEntrar = useSesion.getState().claveDatos;
  void obtenerServicioCuenta()
    .conectarServidor(pin, perfil)
    .then((r) => {
      // Si la sesion se cerro o cambio mientras tanto, no se usa el token.
      if (useSesion.getState().claveDatos !== claveAlEntrar || !claveAlEntrar) {
        if (r.sesion) void obtenerServicioCuenta().cerrarSesionServidor(r.sesion.token);
        return;
      }
      useSincronizacion.getState().fijarCuenta(r.estado, r.mensaje);
      if (!r.sesion) return;
      useSesion.getState().fijarToken(r.sesion.token);
      void obtenerSincronizador()?.sincronizarTodo();
    })
    .catch(() => undefined);
}

/** Cierra la sesion en memoria y en el servidor. */
export function cerrarSesion(motivo: Exclude<MotivoCierre, null> = 'usuario'): void {
  const token = useSesion.getState().tokenServidor;
  detenerSincronizador();
  useSesion.getState().cerrar(motivo);
  useSincronizacion.getState().reiniciar();
  if (token) void obtenerServicioCuenta().cerrarSesionServidor(token);
}

/** CA-14.4: borra la cuenta y los datos del servidor y del dispositivo. Lanza ErrorCuenta si algo falla. */
export async function borrarTodosMisDatos(pin: string): Promise<void> {
  const token = useSesion.getState().tokenServidor;
  detenerSincronizador();
  await obtenerServicioCuenta().borrarTodo(pin, token);
  useSesion.getState().cerrar('usuario');
  useSincronizacion.getState().reiniciar();
}

async function actualizarEstadoCuenta(): Promise<void> {
  try {
    const estado = await obtenerServicioCuenta().estadoServidor();
    if (useSincronizacion.getState().cuenta === null) useSincronizacion.getState().fijarCuenta(estado);
  } catch {
    // Sin IndexedDB no hay nada que mostrar.
  }
}
