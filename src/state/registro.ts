import { create } from 'zustand';

import type { RespaldoCuenta } from '../services/ServicioCuenta';

interface EstadoRegistro {
  /** Codigo de recuperacion recien generado. Solo en memoria, para mostrarlo una vez. */
  codigoRecuperacion: string | null;
  /** Donde quedo la cuenta recien creada, para avisar si falta la copia en el servidor. */
  respaldo: RespaldoCuenta | null;
  fijarCodigo: (codigo: string, respaldo?: RespaldoCuenta) => void;
  olvidarCodigo: () => void;
}

export const useRegistro = create<EstadoRegistro>()((set) => ({
  codigoRecuperacion: null,
  respaldo: null,
  fijarCodigo: (codigoRecuperacion, respaldo = 'solo_local') => set({ codigoRecuperacion, respaldo }),
  olvidarCodigo: () => set({ codigoRecuperacion: null, respaldo: null }),
}));
