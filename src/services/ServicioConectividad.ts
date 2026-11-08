/** Estado de la conexión del navegador (navigator.onLine y los eventos online/offline). */
export class ServicioConectividad {
  enLinea(): boolean {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine !== false;
  }

  /** Avisa cada cambio de conexión. Devuelve la función para dejar de escuchar. */
  suscribir(alCambiar: (enLinea: boolean) => void): () => void {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return () => {};
    const alConectar = () => alCambiar(true);
    const alDesconectar = () => alCambiar(false);
    window.addEventListener('online', alConectar);
    window.addEventListener('offline', alDesconectar);
    return () => {
      window.removeEventListener('online', alConectar);
      window.removeEventListener('offline', alDesconectar);
    };
  }
}

export const servicioConectividad = new ServicioConectividad();
