// Lista de lo real y lo simulado que muestra la pantalla "Acerca del prototipo".
// Se actualiza al final de cada fase: 'listo' solo cuando la funcion existe y tiene prueba.

export type EstadoFuncion = 'listo' | 'en_construccion';

export interface ElementoAcerca {
  titulo: string;
  detalle: string;
  estado: EstadoFuncion;
}

/** Lo que el prototipo hace de verdad (o hara al terminar la construccion). */
export const LO_REAL: readonly ElementoAcerca[] = [
  {
    titulo: 'Tu PIN no se guarda',
    detalle: 'Solo se guarda una huella del PIN (hash PBKDF2 con sal). Con ella no se puede saber tu PIN.',
    estado: 'en_construccion',
  },
  {
    titulo: 'Tus casos van cifrados',
    detalle: 'Casos, fotos, audios y notas se cifran con AES-GCM en tu celular, con una clave que sale de tu PIN.',
    estado: 'en_construccion',
  },
  {
    titulo: 'Cálculo de plazos',
    detalle: 'Cuenta los días hábiles con los festivos de Colombia, según los artículos verificados en la base.',
    estado: 'en_construccion',
  },
  {
    titulo: 'Lectura del comparendo con foto',
    detalle: 'El reconocimiento de texto (OCR) corre en tu navegador. La foto no sale de tu celular.',
    estado: 'en_construccion',
  },
  {
    titulo: 'Solicitud de audiencia en PDF',
    detalle: 'El documento se arma en tu celular con tus datos, los del comparendo y la norma citada.',
    estado: 'en_construccion',
  },
  {
    titulo: 'Base de normas verificada',
    detalle: 'Cada artículo tiene el texto copiado de la fuente oficial, su enlace y la fecha de consulta.',
    estado: 'en_construccion',
  },
  {
    titulo: 'Solo viaja tu pregunta',
    detalle: 'Al servidor del asistente llega solo el texto de la pregunta: sin nombre, sin ubicación, sin audio.',
    estado: 'en_construccion',
  },
  {
    titulo: 'Letra grande y lectura en voz alta',
    detalle: 'Puedes elegir el tamaño de letra en Ajustes. Cada pantalla tiene el botón "Escuchar".',
    estado: 'listo',
  },
];

/** Lo que esta simulado o tiene limites. */
export const LO_SIMULADO: readonly ElementoAcerca[] = [
  {
    titulo: 'El asistente no usa inteligencia artificial generativa',
    detalle:
      'Responde en "modo verificado": busca entre preguntas ya revisadas por el equipo. Si no encuentra sustento, te lo dice.',
    estado: 'en_construccion',
  },
  {
    titulo: 'El asistente necesita internet',
    detalle: 'Sin conexión puedes usar "Me pararon", tus evidencias, el comparendo, los plazos y los documentos.',
    estado: 'en_construccion',
  },
  {
    titulo: 'Hablar depende del navegador',
    detalle:
      'El dictado por voz funciona en Chrome. En Chrome el audio del dictado lo procesa Google, no VozVial. Siempre puedes escribir.',
    estado: 'en_construccion',
  },
  {
    titulo: 'No hay servidor de cuentas',
    detalle: 'Tu cuenta vive solo en este navegador. Si borras los datos del navegador, se pierde.',
    estado: 'en_construccion',
  },
  {
    titulo: 'VozVial no radica nada',
    detalle: 'La app genera la solicitud, pero tú la presentas ante el organismo de tránsito.',
    estado: 'en_construccion',
  },
  {
    titulo: 'Valores de referencia',
    detalle: 'El valor de una multa es solo de referencia. Confirma siempre en SIMIT.',
    estado: 'en_construccion',
  },
  {
    titulo: 'Recordatorios al abrir la app',
    detalle: 'Las alertas de plazo se ven al abrir la app. No llegan notificaciones al celular.',
    estado: 'en_construccion',
  },
  {
    titulo: 'Pantallas de ejemplo',
    detalle: 'Las pantallas marcadas "Ejemplo" muestran datos inventados para ver el diseño.',
    estado: 'listo',
  },
];
