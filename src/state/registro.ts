import { create } from 'zustand';

interface EstadoRegistro {
  /** Codigo de recuperacion recien generado. Solo en memoria, para mostrarlo una vez. */
  codigoRecuperacion: string | null;
  fijarCodigo: (codigo: string) => void;
  olvidarCodigo: () => void;
}

export const useRegistro = create<EstadoRegistro>()((set) => ({
  codigoRecuperacion: null,
  fijarCodigo: (codigoRecuperacion) => set({ codigoRecuperacion }),
  olvidarCodigo: () => set({ codigoRecuperacion: null }),
}));
