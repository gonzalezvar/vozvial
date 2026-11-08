// Textos de la guia dentro de la app: recorrido de bienvenida, guias por situacion y ayuda de cada
// pantalla. Sin dependencias de React para poder probarlos en Node.
//
// Regla de contenido: aqui no hay articulos, plazos ni valores de multa. Lo legal se nombra solo por
// referencia a lo que la app ya muestra con su fuente (el plazo calculado, las citas de la norma).
import type { NombreIcono } from '../iconos';

/** Pantallas que tienen ayuda contextual. Cada una pone <AyudaPantalla pantalla="..." />. */
export type IdPantallaAyuda =
  | 'bienvenida'
  | 'registro'
  | 'entrar'
  | 'recuperar'
  | 'inicio'
  | 'asistente'
  | 'me-pararon'
  | 'casos'
  | 'caso'
  | 'comparendo'
  | 'solicitud'
  | 'ajustes';

/** Rutas a las que puede llevar un boton de la guia. Las comprueba la prueba unitaria. */
export type RutaGuia =
  | '/inicio'
  | '/me-pararon'
  | '/asistente'
  | '/casos'
  | '/comparendo/nuevo'
  | '/ajustes'
  | '/recuperar'
  | '/entrar'
  | '/registro'
  | '/guia'
  | '/ayuda';

export interface PasoRecorrido {
  id: string;
  icono: NombreIcono;
  /** El paso de "Me pararon" usa el color de urgencia, igual que el boton del inicio. */
  urgente?: boolean;
  titulo: string;
  /** Dos o tres frases cortas. */
  frases: readonly string[];
}

export interface AccionGuia {
  etiqueta: string;
  /** Debe contener la etiqueta visible. */
  accessibilityLabel: string;
  descripcion?: string;
  href: RutaGuia;
  icono: NombreIcono;
}

export interface GuiaSituacion {
  id: string;
  titulo: string;
  /** Frase bajo el titulo en la lista y en la pantalla de la guia. */
  resumen: string;
  icono: NombreIcono;
  /** Pasos numerados, en el orden en que se hacen. */
  pasos: readonly string[];
  /** La primera es la accion principal. */
  acciones: readonly AccionGuia[];
}

export interface AyudaDePantalla {
  titulo: string;
  /** Entre dos y cuatro frases. */
  frases: readonly string[];
}

export const PASOS_RECORRIDO: readonly PasoRecorrido[] = [
  {
    id: 'que-es',
    icono: 'conversacion',
    titulo: 'VozVial te acompaña con tu comparendo',
    frases: [
      'Te explica tus derechos con palabras sencillas.',
      'Te ayuda a guardar lo que pasa y a no perder tus fechas.',
      'VozVial informa y organiza. No reemplaza a un abogado.',
    ],
  },
  {
    id: 'cifrado',
    icono: 'candado',
    titulo: 'Tus datos van cifrados',
    frases: [
      'Entras con un PIN de 6 números.',
      'Tus casos y evidencias se guardan cifrados. Solo se abren con tu PIN.',
      'Al asistente solo le llega el texto de tu pregunta, sin tu nombre ni tu ubicación.',
    ],
  },
  {
    id: 'me-pararon',
    icono: 'grabar',
    urgente: true,
    titulo: 'Si te para un agente, toca “Me pararon”',
    frases: [
      'Es el botón grande del inicio. Con un toque empieza a guardar lo que pasa.',
      'Guarda la fecha y la hora, y el audio y el lugar si das permiso.',
      'En la misma pantalla ves tus derechos, con la norma de donde salen.',
    ],
  },
  {
    id: 'preguntar',
    icono: 'microfono',
    titulo: 'Pregunta hablando o escribiendo',
    frases: [
      'Toca “Preguntar” y di tu duda con tus palabras.',
      'Cada respuesta muestra la norma de donde sale.',
      'Si VozVial no tiene información verificada, te lo dice.',
    ],
  },
  {
    id: 'comparendo',
    icono: 'calendario',
    titulo: 'Registra tu comparendo y mira tu plazo',
    frases: [
      'Toma una foto del comparendo o escribe sus datos.',
      'VozVial calcula hasta qué día puedes pedir la audiencia y te muestra de dónde sale ese plazo.',
      'Cuando se acerca la fecha, te avisa en el inicio.',
    ],
  },
];

export const GUIAS_SITUACION: readonly GuiaSituacion[] = [
  {
    id: 'me-paro-un-agente',
    titulo: 'Me paró un agente',
    resumen: 'Qué hacer con VozVial mientras te atienden.',
    icono: 'grabar',
    pasos: [
      'Abre VozVial y entra con tu PIN.',
      'En el inicio, toca el botón grande “Me pararon”. Empieza a guardar enseguida.',
      'Si el celular te pide permiso para el micrófono o la ubicación, tú decides. Sin permiso igual se guarda la fecha y la hora.',
      'Mientras hablas con el agente, puedes leer o escuchar tus derechos en la misma pantalla.',
      'Al terminar, toca “Terminar”. Lo que pasó queda guardado en “Mis casos”.',
    ],
    acciones: [
      {
        etiqueta: 'Abrir “Me pararon”',
        accessibilityLabel: 'Abrir “Me pararon”. Empieza a guardar en cuanto se abre',
        descripcion: 'Empieza a guardar en cuanto se abre',
        href: '/me-pararon',
        icono: 'grabar',
      },
      {
        etiqueta: 'Preguntar mis derechos',
        accessibilityLabel: 'Preguntar mis derechos al asistente',
        href: '/asistente',
        icono: 'conversacion',
      },
    ],
  },
  {
    id: 'fotomulta',
    titulo: 'Me llegó una fotomulta',
    resumen: 'Cómo registrarla y ver hasta cuándo puedes actuar.',
    icono: 'comparendo',
    pasos: [
      'Ten a mano la notificación o el comparendo que te llegó.',
      'En el inicio, toca “Registrar un comparendo”.',
      'Toma una foto del documento o escribe los datos: número, fecha, placa y código de la infracción.',
      'Revisa lo que VozVial leyó y corrige lo que esté mal.',
      'Escribe el día en que recibiste la notificación. Con eso VozVial calcula tu plazo y te muestra de dónde sale.',
    ],
    acciones: [
      {
        etiqueta: 'Registrar mi comparendo',
        accessibilityLabel: 'Registrar mi comparendo',
        href: '/comparendo/nuevo',
        icono: 'comparendo',
      },
      {
        etiqueta: 'Preguntar sobre fotomultas',
        accessibilityLabel: 'Preguntar sobre fotomultas al asistente',
        href: '/asistente',
        icono: 'conversacion',
      },
    ],
  },
  {
    id: 'pedir-audiencia',
    titulo: 'Quiero pedir la audiencia',
    resumen: 'Cómo preparar la solicitud para impugnar el comparendo.',
    icono: 'solicitud',
    pasos: [
      'Si todavía no lo hiciste, registra tu comparendo.',
      'Abre “Mis casos” y toca el caso de ese comparendo.',
      'Abre el comparendo del caso y mira la fecha límite que calculó VozVial. Con “¿De dónde sale este plazo?” ves la norma.',
      'Toca “Generar solicitud”. VozVial arma el documento con los datos de tu caso.',
      'Revisa el documento y descárgalo antes de la fecha límite.',
    ],
    acciones: [
      {
        etiqueta: 'Ir a Mis casos',
        accessibilityLabel: 'Ir a Mis casos',
        href: '/casos',
        icono: 'casos',
      },
      {
        etiqueta: 'Registrar un comparendo',
        accessibilityLabel: 'Registrar un comparendo',
        href: '/comparendo/nuevo',
        icono: 'comparendo',
      },
    ],
  },
  {
    id: 'olvide-pin',
    titulo: 'Olvidé mi PIN',
    resumen: 'Cómo volver a entrar sin perder tus casos.',
    icono: 'llave',
    pasos: [
      'Busca el código de recuperación de 12 letras y números que guardaste al crear tu cuenta.',
      'En la pantalla “Entrar”, toca “Olvidé mi PIN”.',
      'Escribe el código y elige un PIN nuevo de 6 números.',
      'Listo: tus casos siguen ahí. Sin ese código no se pueden abrir tus datos, por eso es importante guardarlo.',
    ],
    acciones: [
      {
        etiqueta: 'Recuperar mi PIN',
        accessibilityLabel: 'Recuperar mi PIN con el código',
        href: '/recuperar',
        icono: 'llave',
      },
    ],
  },
  {
    id: 'agrandar-letra',
    titulo: 'Agrandar la letra',
    resumen: 'Para leer más cómodo en todas las pantallas.',
    icono: 'letra',
    pasos: [
      'En el inicio, toca “Ajustes”.',
      'En “Tamaño de letra”, elige “Grande” o “Muy grande”.',
      'El cambio se ve enseguida en todas las pantallas y se guarda para la próxima vez.',
      'Si prefieres oír, toca “Escuchar” arriba en cualquier pantalla.',
    ],
    acciones: [
      {
        etiqueta: 'Abrir Ajustes',
        accessibilityLabel: 'Abrir Ajustes para cambiar el tamaño de letra',
        href: '/ajustes',
        icono: 'ajustes',
      },
    ],
  },
];

export const AYUDA_PANTALLAS: Readonly<Record<IdPantallaAyuda, AyudaDePantalla>> = {
  bienvenida: {
    titulo: 'Cómo empezar',
    frases: [
      'Si es tu primera vez, toca “Crear mi cuenta”.',
      'Si ya tienes cuenta en este celular, toca “Ya tengo cuenta” y escribe tu PIN.',
      'No necesitas correo ni contraseña larga.',
    ],
  },
  registro: {
    titulo: 'Cómo crear tu cuenta',
    frases: [
      'Escribe tu nombre, tu celular y un PIN de 6 números que puedas recordar.',
      'Marca la casilla si autorizas el tratamiento de tus datos.',
      'Al final te damos un código de recuperación. Escríbelo en un papel y guárdalo.',
    ],
  },
  entrar: {
    titulo: 'Cómo entrar',
    frases: [
      'Escribe tu PIN de 6 números y toca “Entrar”.',
      'Si lo escribes mal varias veces, la cuenta espera un rato antes de dejarte intentar otra vez.',
      'Si lo olvidaste, toca “Olvidé mi PIN” y usa tu código de recuperación.',
    ],
  },
  recuperar: {
    titulo: 'Cómo recuperar tu PIN',
    frases: [
      'Escribe el código de 12 letras y números que guardaste al crear la cuenta.',
      'Luego elige un PIN nuevo y escríbelo dos veces.',
      'Tus casos no se pierden.',
    ],
  },
  inicio: {
    titulo: 'Qué hay en el inicio',
    frases: [
      'Si te para un agente, toca el botón grande “Me pararon”.',
      'Con “Preguntar” resuelves dudas hablando o escribiendo.',
      'En “Mis casos” están tus comparendos, tus evidencias y tus plazos.',
      'Si un plazo está por vencer, el aviso aparece arriba.',
    ],
  },
  asistente: {
    titulo: 'Cómo preguntar',
    frases: [
      'Toca “Hablar” y di tu pregunta, o escríbela y toca “Enviar”.',
      'Cada respuesta trae la norma de donde sale. Tócala para ver el texto.',
      'Si VozVial no tiene información verificada, te lo dice en vez de inventar.',
    ],
  },
  'me-pararon': {
    titulo: 'Qué pasa en esta pantalla',
    frases: [
      'VozVial está guardando la fecha, la hora y, si diste permiso, el audio y el lugar.',
      'Abajo puedes leer o escuchar tus derechos con la norma de donde salen.',
      'Cuando termine el procedimiento, toca “Terminar”. Todo queda en “Mis casos”.',
    ],
  },
  casos: {
    titulo: 'Tus casos',
    frases: [
      'Aquí está cada vez que te pararon o registraste un comparendo.',
      'Toca un caso para ver sus evidencias, su plazo y sus documentos.',
      'Si no tienes casos, toca “Registrar un comparendo”.',
    ],
  },
  caso: {
    titulo: 'El detalle de tu caso',
    frases: [
      'Aquí ves los datos del caso y sus evidencias: audios, fotos y notas.',
      'Si registraste el comparendo, también ves tu plazo.',
      'Desde aquí puedes generar la solicitud de audiencia.',
    ],
  },
  comparendo: {
    titulo: 'Tu comparendo',
    frases: [
      'Arriba ves hasta qué día puedes pedir la audiencia, según el cálculo de VozVial.',
      'Toca “¿De dónde sale este plazo?” para ver la norma.',
      'Si un dato quedó mal, toca “Corregir los datos”.',
    ],
  },
  solicitud: {
    titulo: 'Tu solicitud',
    frases: [
      'VozVial arma la solicitud de audiencia con los datos de tu caso.',
      'Revísala con calma antes de descargarla.',
      'VozVial informa y organiza. No reemplaza a un abogado.',
    ],
  },
  ajustes: {
    titulo: 'Qué puedes cambiar',
    frases: [
      'Elige el tamaño de letra que leas mejor. El cambio se ve enseguida.',
      'Aquí también lees la política de datos y cierras tu sesión.',
      'Si borras todos tus datos, no se pueden recuperar.',
    ],
  },
};

/** Frases unidas para leer en voz alta. */
export function textoParaEscuchar(titulo: string, frases: readonly string[]): string {
  return [titulo, ...frases].join(' ').replace(/\s+/g, ' ').trim();
}

/** Pasos numerados para leer en voz alta: "Paso 1. ..." */
export function pasosParaEscuchar(guia: GuiaSituacion): string {
  return [guia.titulo + '.', guia.resumen, ...guia.pasos.map((p, i) => `Paso ${i + 1}. ${p}`)].join(' ');
}

export function buscarGuia(id: string | undefined | null): GuiaSituacion | null {
  if (!id) return null;
  return GUIAS_SITUACION.find((g) => g.id === id) ?? null;
}
