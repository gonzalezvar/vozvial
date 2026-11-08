import { create } from 'zustand';

import type { EstadoSincronizacion } from '../services/SincronizadorCasos';
import type { EstadoServidorCuenta } from '../services/ServicioCuenta';

interface EstadoCopia {
  /** null = no hay sesion con el servidor (sin internet al entrar, o cuenta solo en el dispositivo). */
  estado: EstadoSincronizacion | null;
  /** Relacion de la cuenta con el servidor (registrada, pendiente, pin_distinto...). */
  cuenta: EstadoServidorCuenta | null;
  mensaje: string | null;
  /** Fecha ISO de la ultima vez que todo quedo al dia. */
  ultimaVez: string | null;
  fijar: (estado: EstadoSincronizacion | null, mensaje: string | null) => void;
  fijarCuenta: (cuenta: EstadoServidorCuenta | null, mensaje?: string | null) => void;
  reiniciar: () => void;
}

/** Estado de la copia cifrada en el servidor, para mostrarlo en Ajustes. */
export const useSincronizacion = create<EstadoCopia>()((set) => ({
  estado: null,
  cuenta: null,
  mensaje: null,
  ultimaVez: null,
  fijar: (estado, mensaje) =>
    set((previo) => ({
      estado,
      mensaje,
      ultimaVez: estado === 'al_dia' ? new Date().toISOString() : previo.ultimaVez,
    })),
  fijarCuenta: (cuenta, mensaje) => set((previo) => ({ cuenta, mensaje: mensaje === undefined ? previo.mensaje : mensaje })),
  reiniciar: () => set({ estado: null, cuenta: null, mensaje: null, ultimaVez: null }),
}));
