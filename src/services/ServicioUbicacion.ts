import * as Location from 'expo-location';
import { Platform } from 'react-native';

import type { MotivoSinUbicacion, Ubicacion } from '../core/Caso';

export type ResultadoUbicacion = { ubicacion: Ubicacion; motivo: null } | { ubicacion: null; motivo: MotivoSinUbicacion };

/** Tiempo maximo de espera: si el GPS tarda mas, el caso se crea "Sin ubicación". */
export const ESPERA_UBICACION_MS = 10_000;

const CODIGO_PERMISO_DENEGADO = 1;

/**
 * Ubicacion actual una sola vez. Nunca lanza: si se niega el permiso devuelve motivo 'denegada';
 * si no hay GPS o tarda demasiado, 'no_disponible'. La ubicacion solo se guarda cifrada en el caso.
 */
export class ServicioUbicacion {
  constructor(private readonly esperaMs: number = ESPERA_UBICACION_MS) {}

  async obtener(): Promise<ResultadoUbicacion> {
    return Platform.OS === 'web' ? this.obtenerWeb() : this.obtenerNativa();
  }

  private obtenerWeb(): Promise<ResultadoUbicacion> {
    const geo = typeof navigator !== 'undefined' ? navigator.geolocation : undefined;
    if (!geo) return Promise.resolve({ ubicacion: null, motivo: 'no_disponible' });
    return new Promise((resolver) => {
      let listo = false;
      const responder = (r: ResultadoUbicacion) => {
        if (listo) return;
        listo = true;
        clearTimeout(reserva);
        resolver(r);
      };
      // Reserva por si el navegador nunca responde (por ejemplo, el aviso de permiso queda abierto).
      const reserva = setTimeout(() => responder({ ubicacion: null, motivo: 'no_disponible' }), this.esperaMs + 1000);
      try {
        geo.getCurrentPosition(
          (pos) =>
            responder({
              ubicacion: { lat: pos.coords.latitude, lon: pos.coords.longitude, precision: pos.coords.accuracy ?? 0 },
              motivo: null,
            }),
          (error) =>
            responder({ ubicacion: null, motivo: error.code === CODIGO_PERMISO_DENEGADO ? 'denegada' : 'no_disponible' }),
          { enableHighAccuracy: true, timeout: this.esperaMs, maximumAge: 60_000 },
        );
      } catch {
        responder({ ubicacion: null, motivo: 'no_disponible' });
      }
    });
  }

  private async obtenerNativa(): Promise<ResultadoUbicacion> {
    try {
      const permiso = await Location.requestForegroundPermissionsAsync();
      if (permiso.status !== 'granted') return { ubicacion: null, motivo: 'denegada' };
      const pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise<null>((r) => setTimeout(() => r(null), this.esperaMs)),
      ]);
      if (!pos) return { ubicacion: null, motivo: 'no_disponible' };
      return {
        ubicacion: { lat: pos.coords.latitude, lon: pos.coords.longitude, precision: pos.coords.accuracy ?? 0 },
        motivo: null,
      };
    } catch {
      return { ubicacion: null, motivo: 'no_disponible' };
    }
  }
}

/** Texto para la persona cuando el caso queda sin ubicacion. */
export function explicacionSinUbicacion(motivo: MotivoSinUbicacion): string {
  return motivo === 'denegada'
    ? 'No diste permiso de ubicación. El caso se guarda igual.'
    : 'No pudimos saber dónde estás. El caso se guarda igual.';
}
