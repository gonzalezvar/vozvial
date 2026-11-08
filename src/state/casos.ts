import { create } from 'zustand';

import type { Caso } from '../core/Caso';
import { alCambiarDatosRemotos, obtenerRepositorioCasos } from './servicios';
import { useSesion } from './sesion';

interface EstadoCasos {
  casos: Caso[];
  cargando: boolean;
  error: string | null;
  recargar: () => Promise<Caso[]>;
  /** Reemplaza un caso en la lista despues de guardarlo, sin releer todo el almacen. */
  actualizarEnLista: (caso: Caso) => void;
  quitarDeLista: (id: string) => void;
}

export const useCasos = create<EstadoCasos>()((set, get) => ({
  casos: [],
  cargando: false,
  error: null,
  recargar: async () => {
    set({ cargando: true, error: null });
    try {
      const casos = await obtenerRepositorioCasos().listar();
      set({ casos, cargando: false });
      return casos;
    } catch {
      set({ cargando: false, error: 'No pudimos abrir tus casos. Intenta de nuevo.' });
      return get().casos;
    }
  },
  actualizarEnLista: (caso) => {
    const otros = get().casos.filter((c) => c.id !== caso.id);
    set({ casos: [caso, ...otros].sort((a, b) => Date.parse(b.creadoEn) - Date.parse(a.creadoEn)) });
  },
  quitarDeLista: (id) => set({ casos: get().casos.filter((c) => c.id !== id) }),
}));

// Cuando llegan casos de otro dispositivo, la lista se vuelve a leer del almacen.
alCambiarDatosRemotos(() => {
  if (useSesion.getState().claveDatos) void useCasos.getState().recargar();
});

// Al cerrar la sesion no quedan casos descifrados en memoria.
useSesion.subscribe((estado, anterior) => {
  if (anterior.claveDatos && !estado.claveDatos) useCasos.setState({ casos: [], error: null });
});
