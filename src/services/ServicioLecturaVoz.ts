import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

export interface OpcionesLectura {
  /** Se llama una sola vez cuando la lectura termina, se detiene o falla. */
  alTerminar?: () => void;
}

/**
 * Lectura en voz alta con expo-speech en espanol de Colombia.
 * En web usa speechSynthesis del navegador; si no existe, disponible() devuelve false.
 */
export class ServicioLecturaVoz {
  constructor(
    private readonly idioma: string = 'es-CO',
    private readonly velocidad: number = 0.9,
  ) {}

  disponible(): boolean {
    if (Platform.OS !== 'web') return true;
    return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  }

  leer(texto: string, opciones: OpcionesLectura = {}): boolean {
    const limpio = texto.replace(/\s+/g, ' ').trim();
    if (!limpio || !this.disponible()) {
      opciones.alTerminar?.();
      return false;
    }

    let terminado = false;
    const terminar = () => {
      if (terminado) return;
      terminado = true;
      opciones.alTerminar?.();
    };

    void Speech.stop();
    try {
      Speech.speak(limpio.slice(0, Speech.maxSpeechInputLength), {
        language: this.idioma,
        rate: this.velocidad,
        onDone: terminar,
        onStopped: terminar,
        onError: terminar,
      });
      return true;
    } catch {
      terminar();
      return false;
    }
  }

  detener(): void {
    void Speech.stop();
  }
}

export const servicioLecturaVoz = new ServicioLecturaVoz();
