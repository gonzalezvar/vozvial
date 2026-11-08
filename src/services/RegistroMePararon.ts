import type { Caso } from '../core/Caso';
import { Evidencia } from '../core/Evidencia';
import { ErrorGrabacion, MOTIVO_GRABACION_NO_DISPONIBLE, type AudioGrabado } from './GrabadorAudio';
import type { RepositorioCasos } from './RepositorioCasos';
import type { ResultadoUbicacion } from './ServicioUbicacion';

export interface Grabador {
  iniciar(): Promise<void>;
  detener(): Promise<AudioGrabado | null>;
  cancelar(): void;
}

export interface FuenteUbicacion {
  obtener(): Promise<ResultadoUbicacion>;
}

export type ResultadoInicioGrabacion = { grabando: true; desde: number } | { grabando: false; motivo: string };

/**
 * Orquesta el modo "Me pararon" (HU-07): al iniciar empieza a grabar y, en paralelo, crea el caso
 * con la fecha y hora del toque y la ubicacion si se puede. Al terminar guarda el audio cifrado.
 */
export class RegistroMePararon {
  private casoCreado: Promise<Caso> | null = null;
  private inicioGrabacion: Promise<ResultadoInicioGrabacion> | null = null;
  /** Audio ya detenido que aun no se pudo guardar: se reintenta en el siguiente terminar(). */
  private audioPendiente: AudioGrabado | null = null;
  private terminado = false;
  readonly instanteInicio: Date;

  constructor(
    private readonly repositorio: Pick<RepositorioCasos, 'crear' | 'guardar' | 'agregarEvidencia' | 'nuevoId'>,
    private readonly grabador: Grabador,
    private readonly ubicacion: FuenteUbicacion,
    reloj: () => Date = () => new Date(),
  ) {
    this.instanteInicio = reloj();
  }

  iniciarGrabacion(): Promise<ResultadoInicioGrabacion> {
    this.inicioGrabacion ??= this.grabador.iniciar().then(
      (): ResultadoInicioGrabacion => ({ grabando: true, desde: Date.now() }),
      (e: unknown): ResultadoInicioGrabacion => ({
        grabando: false,
        motivo: e instanceof ErrorGrabacion ? e.message : MOTIVO_GRABACION_NO_DISPONIBLE,
      }),
    );
    return this.inicioGrabacion;
  }

  /** Crea el caso una sola vez. Sin permiso de ubicacion el caso se crea igual (CA-07.2). */
  crearCaso(): Promise<Caso> {
    this.casoCreado ??= this.ubicacion
      .obtener()
      .catch((): ResultadoUbicacion => ({ ubicacion: null, motivo: 'no_disponible' }))
      .then((r) =>
        this.repositorio.crear({
          creadoEn: this.instanteInicio.toISOString(),
          ubicacion: r.ubicacion,
          motivoSinUbicacion: r.motivo,
          estado: 'registrando',
        }),
      );
    return this.casoCreado;
  }

  get yaTermino(): boolean {
    return this.terminado;
  }

  /**
   * Detiene la grabacion, guarda el audio cifrado en el caso y lo deja "Abierto".
   * Recibe el caso mas reciente (con las fotos o notas agregadas mientras tanto).
   */
  async terminar(casoActual?: Caso | null): Promise<Caso> {
    this.terminado = true;
    const creado = await this.crearCaso();
    let caso = casoActual && casoActual.id === creado.id ? casoActual : creado;

    // Si el microfono aun se estaba abriendo, se espera para no dejarlo encendido.
    if (this.inicioGrabacion) await this.inicioGrabacion;
    const audio = this.audioPendiente ?? (await this.grabador.detener());
    this.audioPendiente = audio;
    if (audio && audio.bytes.byteLength > 0) {
      const evidencia = Evidencia.crear({
        id: this.repositorio.nuevoId(),
        tipo: 'audio',
        creadaEn: new Date(audio.iniciadoEn).toISOString(),
        mime: audio.mime,
        tamano: audio.bytes.byteLength,
        duracionMs: audio.duracionMs,
      });
      caso = await this.repositorio.agregarEvidencia(caso, evidencia, audio.bytes);
    }
    this.audioPendiente = null;

    const abierto = caso.terminarRegistro();
    if (abierto !== caso) await this.repositorio.guardar(abierto);
    return abierto;
  }
}
