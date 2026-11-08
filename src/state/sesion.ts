import { create } from 'zustand';

import type { Perfil } from '../services/ServicioCuenta';

export type MotivoCierre = 'inactividad' | 'usuario' | null;

interface EstadoSesion {
  /** Clave de datos AES-GCM. Vive solo en memoria: al recargar la pagina hay que volver a entrar. */
  claveDatos: CryptoKey | null;
  perfil: Perfil | null;
  /** Instante (ms) del ultimo toque o tecla. Lo usa el cierre por inactividad. */
  ultimaActividad: number;
  /** Por que se cerro la ultima sesion. La pantalla "Entrar" lo usa para explicar el cierre. */
  motivoCierre: MotivoCierre;
  iniciar: (claveDatos: CryptoKey, perfil: Perfil) => void;
  cerrar: (motivo?: Exclude<MotivoCierre, null>) => void;
  tocar: () => void;
  olvidarMotivoCierre: () => void;
}

// Sin middleware persist a proposito: la clave nunca se escribe en almacenamiento.
export const useSesion = create<EstadoSesion>()((set) => ({
  claveDatos: null,
  perfil: null,
  ultimaActividad: Date.now(),
  motivoCierre: null,
  iniciar: (claveDatos, perfil) => set({ claveDatos, perfil, ultimaActividad: Date.now(), motivoCierre: null }),
  cerrar: (motivo = 'usuario') => set({ claveDatos: null, perfil: null, motivoCierre: motivo }),
  tocar: () => set({ ultimaActividad: Date.now() }),
  olvidarMotivoCierre: () => set({ motivoCierre: null }),
}));

export function haySesion(): boolean {
  return useSesion.getState().claveDatos !== null;
}
