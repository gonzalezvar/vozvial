import { BLOQUEO_MS_POR_DEFECTO } from '../core/ControlIntentos';
import { ITERACIONES_PBKDF2_POR_DEFECTO } from '../core/DerivadorPBKDF2';

/** CA-02.4: la sesion se cierra tras 10 minutos sin actividad. */
export const INACTIVIDAD_MS_POR_DEFECTO = 10 * 60 * 1000;

function entero(valor: string | undefined, porDefecto: number): number {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : porDefecto;
}

/**
 * Tiempos y costo de PBKDF2. Expo reemplaza process.env.EXPO_PUBLIC_* al compilar, por eso
 * se leen con el nombre completo. Solo el build de e2e los acorta (scripts/build-e2e.sh).
 */
export const CONFIG = {
  bloqueoMs: entero(process.env.EXPO_PUBLIC_BLOQUEO_MS, BLOQUEO_MS_POR_DEFECTO),
  inactividadMs: entero(process.env.EXPO_PUBLIC_INACTIVIDAD_MS, INACTIVIDAD_MS_POR_DEFECTO),
  iteracionesPbkdf2: entero(process.env.EXPO_PUBLIC_PBKDF2_ITERACIONES, ITERACIONES_PBKDF2_POR_DEFECTO),
} as const;
