import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import { crearTema, type TamanoLetra, type Tema } from './tema';

export const CLAVE_AJUSTES = 'vozvial.ajustes';

interface EstadoAjustes {
  tamanoLetra: TamanoLetra;
  cambiarTamanoLetra: (tamano: TamanoLetra) => void;
}

// En web usa localStorage (CA-04.1: la eleccion se conserva al volver a entrar).
// Si el navegador lo bloquea (modo privado, datos borrados) o no es web, queda en memoria.
const memoria = new Map<string, string>();

function localStorageDisponible(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

const almacenAjustes: StateStorage = {
  getItem: (clave) => {
    try {
      const ls = localStorageDisponible();
      if (ls) return ls.getItem(clave);
    } catch {
      // Se usa la copia en memoria.
    }
    return memoria.get(clave) ?? null;
  },
  setItem: (clave, valor) => {
    memoria.set(clave, valor);
    try {
      localStorageDisponible()?.setItem(clave, valor);
    } catch {
      // Sin persistencia: la eleccion dura mientras la pestana siga abierta.
    }
  },
  removeItem: (clave) => {
    memoria.delete(clave);
    try {
      localStorageDisponible()?.removeItem(clave);
    } catch {
      // Nada que borrar.
    }
  },
};

export const useAjustes = create<EstadoAjustes>()(
  persist(
    (set) => ({
      tamanoLetra: 'normal',
      cambiarTamanoLetra: (tamanoLetra) => set({ tamanoLetra }),
    }),
    {
      name: CLAVE_AJUSTES,
      version: 1,
      storage: createJSONStorage(() => almacenAjustes),
      partialize: (estado) => ({ tamanoLetra: estado.tamanoLetra }),
    },
  ),
);

/** Tema activo segun el tamano de letra elegido. Las pantallas y componentes lo leen de aqui. */
export function useTema(): Tema {
  const tamano = useAjustes((estado) => estado.tamanoLetra);
  return crearTema(tamano);
}
