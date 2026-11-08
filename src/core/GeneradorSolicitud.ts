import { CatalogoInfracciones } from './CatalogoInfracciones';
import { Caso, type DatosConductor } from './Caso';
import type { TipoComparendo } from './Comparendo';
import type { Evidencia, TipoEvidencia } from './Evidencia';
import { FechaCivil } from './FechaCivil';

export type CampoSolicitud =
  | 'nombre'
  | 'cedula'
  | 'celular'
  | 'correo'
  | 'numeroComparendo'
  | 'fechaComparendo'
  | 'codigoInfraccion'
  | 'fechaNotificacion';

export interface Faltante {
  campo: CampoSolicitud;
  mensaje: string;
}

/**
 * Datos sueltos del formulario, antes de existir un Comparendo válido. Sirve
 * para decir qué falta mientras el conductor llena la pantalla.
 */
export interface DatosSolicitud {
  conductor: DatosConductor;
  comparendo: {
    numero?: string | null;
    fecha?: FechaCivil | null;
    codigoInfraccion?: string | null;
    tipo?: TipoComparendo | null;
    fechaNotificacion?: FechaCivil | null;
  } | null;
}

/**
 * Norma que el llamador ya verificó. Coincide con la forma de Cita del
 * asistente, así se le puede pasar una Cita directamente.
 */
export interface NormaParaCitar {
  id: string;
  norma: string;
  articulo: string;
  titulo?: string;
  urlFuente: string;
}

export interface OpcionesSolicitud {
  /** Normas verificadas que sustentan la solicitud. El generador no agrega ninguna por su cuenta. */
  normasCitadas: readonly NormaParaCitar[];
  /** Fecha en que se firma la solicitud. */
  fechaElaboracion: FechaCivil;
  /** Lo que el conductor quiere decir con sus palabras, si lo escribió. */
  razones?: string;
  /** Descripción sencilla del código, tomada del catálogo verificado. */
  descripcionInfraccion?: string;
  /**
   * Desfase horario en minutos respecto a UTC para mostrar la hora de las
   * evidencias. Colombia usa UTC-5 todo el año, por eso -300 por defecto.
   */
  desfaseMinutos?: number;
}

export interface SeccionSolicitud {
  titulo: string;
  parrafos: string[];
}

export interface ContenidoSolicitud {
  titulo: string;
  destinatario: string;
  secciones: SeccionSolicitud[];
  /** Una línea por evidencia: tipo, fecha y hora. */
  evidencias: string[];
  normasCitadas: { norma: string; articulo: string; url: string }[];
  aviso: string;
}

export class ErrorSolicitudIncompleta extends Error {
  constructor(readonly faltantes: readonly Faltante[]) {
    super(faltantes.map((f) => f.mensaje).join(' '));
    this.name = 'ErrorSolicitudIncompleta';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const AVISO_SOLICITUD = 'VozVial informa y organiza. No reemplaza a un abogado.';

export const MENSAJES_FALTANTE: Readonly<Record<CampoSolicitud, string>> = {
  nombre: 'Falta tu nombre completo.',
  cedula: 'Falta tu número de cédula.',
  celular: 'Falta tu número de celular.',
  correo: 'Revisa tu correo. Debe ser como nombre@correo.com.',
  numeroComparendo: 'Falta el número del comparendo.',
  fechaComparendo: 'Falta la fecha del comparendo.',
  codigoInfraccion: 'Falta el código de la infracción.',
  fechaNotificacion: 'Falta la fecha en que recibiste la notificación.',
};

const MENSAJE_CEDULA_FORMATO = 'Revisa tu número de cédula. Escribe solo números, sin puntos.';
const MENSAJE_CELULAR_FORMATO = 'Escribe tu celular de 10 dígitos, por ejemplo 3001234567';
const MENSAJE_CODIGO_FORMATO = 'Revisa el código. Es una letra y dos números, por ejemplo C02.';

const NOMBRE_TIPO_EVIDENCIA: Readonly<Record<TipoEvidencia, string>> = {
  audio: 'Audio',
  foto: 'Foto',
  nota: 'Nota',
};

const DESTINATARIO_GENERICO = 'Organismo de tránsito que impuso el comparendo';

function vacio(valor: string | null | undefined): boolean {
  return valor == null || valor.trim() === '';
}

/** Arma el contenido de la solicitud de audiencia pública de impugnación. El PDF lo dibuja otro servicio. */
export class GeneradorSolicitud {
  /** Lista lo que falta o está mal escrito, en el orden en que aparece en el formulario (CA-13.2). */
  faltantes(datos: Caso | DatosSolicitud): Faltante[] {
    const { conductor, comparendo } = datos instanceof Caso ? GeneradorSolicitud.desdeCaso(datos) : datos;
    const salida: Faltante[] = [];
    const agregar = (campo: CampoSolicitud, mensaje = MENSAJES_FALTANTE[campo]) => salida.push({ campo, mensaje });

    if (vacio(conductor.nombre)) agregar('nombre');

    if (vacio(conductor.cedula)) agregar('cedula');
    else if (!/^\d{3,10}$/.test((conductor.cedula ?? '').replace(/[\s.]/g, ''))) {
      agregar('cedula', MENSAJE_CEDULA_FORMATO);
    }

    if (vacio(conductor.celular)) agregar('celular');
    else if (!/^3\d{9}$/.test((conductor.celular ?? '').replace(/[\s-]/g, ''))) {
      agregar('celular', MENSAJE_CELULAR_FORMATO);
    }

    if (!vacio(conductor.correo) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((conductor.correo ?? '').trim())) {
      agregar('correo');
    }

    if (vacio(comparendo?.numero)) agregar('numeroComparendo');
    if (!(comparendo?.fecha instanceof FechaCivil)) agregar('fechaComparendo');

    if (vacio(comparendo?.codigoInfraccion)) agregar('codigoInfraccion');
    else if (CatalogoInfracciones.normalizarCodigo(comparendo?.codigoInfraccion ?? '') === null) {
      agregar('codigoInfraccion', MENSAJE_CODIGO_FORMATO);
    }

    if (comparendo?.tipo === 'fotodeteccion' && !(comparendo.fechaNotificacion instanceof FechaCivil)) {
      agregar('fechaNotificacion');
    }
    return salida;
  }

  /**
   * Arma el texto de la solicitud. Lanza ErrorSolicitudIncompleta si falta
   * algún dato obligatorio. Las normas citadas salen solo de opciones.
   */
  armarContenido(caso: Caso, opciones: OpcionesSolicitud): ContenidoSolicitud {
    const faltantes = this.faltantes(caso);
    const comparendo = caso.comparendo;
    if (faltantes.length > 0 || comparendo === null) {
      throw new ErrorSolicitudIncompleta(faltantes);
    }
    const c = caso.conductor;
    const desfase = opciones.desfaseMinutos ?? -300;

    const evidencias = caso.evidenciasOrdenadas().map((e) => GeneradorSolicitud.describirEvidencia(e, desfase));
    const normasCitadas = opciones.normasCitadas.map((n) => ({ norma: n.norma, articulo: n.articulo, url: n.urlFuente }));

    const identificacion = [`Mi nombre es ${c.nombre}.`, `Mi cédula de ciudadanía es la número ${c.cedula}.`];
    identificacion.push(`Mi celular es ${c.celular}.`);
    if (c.direccion) identificacion.push(`Mi dirección es ${c.direccion}${c.ciudad ? `, ${c.ciudad}` : ''}.`);
    else if (c.ciudad) identificacion.push(`Vivo en ${c.ciudad}.`);
    if (c.correo) identificacion.push(`Mi correo es ${c.correo}.`);

    const datosComparendo = [`Número del comparendo: ${comparendo.numero}.`];
    datosComparendo.push(`Fecha de la infracción: ${comparendo.fecha.formatoLargo()}.`);
    if (comparendo.placa) datosComparendo.push(`Placa del vehículo: ${comparendo.placa}.`);
    datosComparendo.push(
      opciones.descripcionInfraccion
        ? `Código de la infracción: ${comparendo.codigoInfraccion} (${opciones.descripcionInfraccion}).`
        : `Código de la infracción: ${comparendo.codigoInfraccion}.`,
    );
    if (comparendo.tipo === 'fotodeteccion' && comparendo.fechaNotificacion) {
      datosComparendo.push('Tipo: por fotodetección (cámara o medio electrónico).');
      datosComparendo.push(`Fecha en que recibí la notificación: ${comparendo.fechaNotificacion.formatoLargo()}.`);
    } else {
      datosComparendo.push('Tipo: impuesto en la vía por un agente de tránsito.');
    }

    const peticion = [
      'Pido que se fije fecha y hora para la audiencia pública de impugnación de este comparendo.',
      'Impugnar quiere decir que no estoy de acuerdo con el comparendo y pido que se revise.',
      'Quiero asistir a la audiencia para presentar mis explicaciones y mis pruebas.',
    ];
    if (!vacio(opciones.razones)) peticion.push(`Mis razones: ${(opciones.razones ?? '').trim()}`);

    const pruebas =
      evidencias.length > 0
        ? [`Aporto ${evidencias.length === 1 ? 'la prueba que aparece' : `las ${evidencias.length} pruebas que aparecen`} en la lista de evidencias de este documento.`]
        : ['Por ahora no aporto pruebas. Las presentaré en la audiencia si las tengo.'];

    const secciones: SeccionSolicitud[] = [
      { titulo: 'Fecha y lugar', parrafos: [GeneradorSolicitud.lugarYFecha(c.ciudad, opciones.fechaElaboracion)] },
      { titulo: 'Quién hace la solicitud', parrafos: identificacion },
      { titulo: 'Datos del comparendo', parrafos: datosComparendo },
      { titulo: 'Lo que pido', parrafos: peticion },
      { titulo: 'Pruebas', parrafos: pruebas },
    ];
    if (normasCitadas.length > 0) {
      secciones.push({
        titulo: 'Normas en que me baso',
        parrafos: ['Me baso en las normas de la lista de normas citadas, copiadas de su fuente oficial.'],
      });
    }
    const contacto = [`Celular: ${c.celular}.`];
    if (c.correo) contacto.push(`Correo: ${c.correo}.`);
    if (c.direccion) contacto.push(`Dirección: ${c.direccion}${c.ciudad ? `, ${c.ciudad}` : ''}.`);
    secciones.push({ titulo: 'Dónde recibo respuesta', parrafos: contacto });
    secciones.push({
      titulo: 'Firma',
      parrafos: ['Atentamente,', `${c.nombre}`, `C.C. ${c.cedula}`],
    });

    return {
      titulo: `Solicitud de audiencia pública de impugnación del comparendo No. ${comparendo.numero}`,
      destinatario: comparendo.organismo ? `Señores ${comparendo.organismo}` : `Señores ${DESTINATARIO_GENERICO}`,
      secciones,
      evidencias,
      normasCitadas,
      aviso: AVISO_SOLICITUD,
    };
  }

  /** "Audio del viernes 13 de noviembre de 2026 a las 3:45 p. m." */
  static describirEvidencia(evidencia: Evidencia, desfaseMinutos = -300): string {
    const local = new Date(evidencia.instante() + desfaseMinutos * 60_000);
    // Se leen los campos UTC del instante ya desplazado: así no influye el huso del dispositivo.
    const fecha = FechaCivil.de(local.getUTCFullYear(), local.getUTCMonth() + 1, local.getUTCDate());
    const h24 = local.getUTCHours();
    const minutos = local.getUTCMinutes().toString().padStart(2, '0');
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    const sufijo = h24 < 12 ? 'a. m.' : 'p. m.';
    return `${NOMBRE_TIPO_EVIDENCIA[evidencia.tipo]} del ${fecha.formatoLargo()} a las ${h12}:${minutos} ${sufijo}`;
  }

  private static lugarYFecha(ciudad: string | undefined, fecha: FechaCivil): string {
    const texto = fecha.formatoLargo();
    return ciudad ? `${ciudad}, ${texto}.` : `${texto.charAt(0).toUpperCase()}${texto.slice(1)}.`;
  }

  private static desdeCaso(caso: Caso): DatosSolicitud {
    const c = caso.comparendo;
    return {
      conductor: caso.conductor,
      comparendo: c
        ? {
            numero: c.numero,
            fecha: c.fecha,
            codigoInfraccion: c.codigoInfraccion,
            tipo: c.tipo,
            fechaNotificacion: c.fechaNotificacion,
          }
        : null,
    };
  }
}
