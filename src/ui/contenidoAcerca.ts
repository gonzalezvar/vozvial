// Lista de lo real y lo simulado que muestra la pantalla "Acerca del prototipo".
// Se actualiza al final de cada fase: 'listo' solo cuando la funcion existe y tiene prueba.

export type EstadoFuncion = 'listo' | 'en_construccion';

export interface ElementoAcerca {
  titulo: string;
  detalle: string;
  estado: EstadoFuncion;
}

/** Lo que el prototipo hace de verdad. */
export const LO_REAL: readonly ElementoAcerca[] = [
  {
    titulo: 'Tu PIN no se guarda',
    detalle:
      'Solo se guarda una huella del PIN (hash PBKDF2 con sal y 600 000 repeticiones). Con ella no se puede saber tu PIN.',
    estado: 'listo',
  },
  {
    titulo: 'Tus casos van cifrados',
    detalle: 'Casos, fotos, audios y notas se cifran con AES-GCM en tu celular, con una clave que sale de tu PIN.',
    estado: 'listo',
  },
  {
    titulo: 'Bloqueo y cierre de sesión',
    detalle:
      'Después de 5 PIN incorrectos la app se bloquea 5 minutos. Si no la usas en 10 minutos, se cierra y te pide el PIN.',
    estado: 'listo',
  },
  {
    titulo: 'Código de recuperación',
    detalle: 'Con tu código de 12 caracteres puedes poner un PIN nuevo sin perder tus casos.',
    estado: 'listo',
  },
  {
    titulo: 'Modo "Me pararon"',
    detalle:
      'Con un toque empieza a grabar audio con el micrófono del celular y guarda la fecha, la hora y la ubicación del caso.',
    estado: 'listo',
  },
  {
    titulo: 'Fotos y notas en tu caso',
    detalle: 'Puedes agregar fotos y notas dictadas o escritas. Cada una queda con su fecha y hora.',
    estado: 'listo',
  },
  {
    titulo: 'Lectura del comparendo con foto',
    detalle:
      'El reconocimiento de texto (OCR) corre en tu navegador. La foto no sale de tu celular. Los datos dudosos se marcan para que los revises.',
    estado: 'listo',
  },
  {
    titulo: 'Tu infracción explicada',
    detalle: 'Ves qué significa el código, el artículo de la ley con su texto y la sanción en salarios mínimos diarios.',
    estado: 'listo',
  },
  {
    titulo: 'Cálculo de plazos',
    detalle: 'Cuenta los días hábiles con los festivos de Colombia, según los artículos verificados en la base.',
    estado: 'listo',
  },
  {
    titulo: 'Base de normas verificada',
    detalle: 'Cada artículo tiene el texto copiado de la fuente oficial, su enlace y la fecha de consulta.',
    estado: 'listo',
  },
  {
    titulo: 'Asistente con citas',
    detalle:
      'Cada respuesta muestra la norma y el artículo de donde sale. Si no hay sustento, te dice que no tiene información verificada.',
    estado: 'listo',
  },
  {
    titulo: 'Solo viaja tu pregunta',
    detalle: 'Al servidor del asistente llega solo el texto de la pregunta: sin nombre, sin ubicación, sin audio.',
    estado: 'listo',
  },
  {
    titulo: 'Letra grande y lectura en voz alta',
    detalle: 'Puedes elegir el tamaño de letra en Ajustes. Cada pantalla tiene el botón "Escuchar".',
    estado: 'listo',
  },
  {
    titulo: 'Solicitud de audiencia en PDF',
    detalle: 'El documento se armará en tu celular con tus datos, los del comparendo y la norma citada.',
    estado: 'en_construccion',
  },
];

/** Lo que esta simulado o tiene limites. */
export const LO_SIMULADO: readonly ElementoAcerca[] = [
  {
    titulo: 'El asistente no usa inteligencia artificial generativa',
    detalle:
      'Responde en "modo verificado": busca entre 49 preguntas ya revisadas por el equipo. Si preguntas con otras palabras, muchas veces te dirá que no tiene información verificada.',
    estado: 'listo',
  },
  {
    titulo: 'El asistente necesita internet',
    detalle:
      'Sin conexión puedes usar "Me pararon", tus evidencias, el comparendo y los plazos. Esto solo vale si la app ya estaba abierta: si la recargas sin internet, no abre.',
    estado: 'listo',
  },
  {
    titulo: 'Hablar depende del navegador',
    detalle:
      'El dictado por voz funciona en Chrome. En Chrome el audio del dictado lo procesa Google, no VozVial. Siempre puedes escribir.',
    estado: 'listo',
  },
  {
    titulo: 'No hay servidor de cuentas',
    detalle: 'Tu cuenta vive solo en este navegador. Si borras los datos del navegador, se pierde.',
    estado: 'listo',
  },
  {
    titulo: 'El código de recuperación no tiene límite de intentos',
    detalle: 'A diferencia del PIN, la app no se bloquea si escribes mal el código varias veces.',
    estado: 'listo',
  },
  {
    titulo: 'Política de datos incompleta',
    detalle: 'Todavía falta publicar la dirección y el teléfono del responsable de tus datos. Se publicarán en la entrega final.',
    estado: 'listo',
  },
  {
    titulo: 'El audio se guarda al terminar',
    detalle:
      'El audio de "Me pararon" se guarda al tocar "Terminar" o al salir de la pantalla. Si se cierra el navegador mientras grabas, ese audio se pierde.',
    estado: 'listo',
  },
  {
    titulo: 'Grabar audio solo en la versión web',
    detalle: 'En la app del celular (Expo Go) no se graba audio: el caso se guarda sin él.',
    estado: 'listo',
  },
  {
    titulo: 'La sesión sigue abierta en "Me pararon"',
    detalle: 'Mientras usas "Me pararon", la app no se cierra por inactividad, para no cortar la grabación.',
    estado: 'listo',
  },
  {
    titulo: 'Hora de las fotos',
    detalle: 'La fecha y hora de una foto es la de cuando la agregas al caso, no la de cuando la tomaste.',
    estado: 'listo',
  },
  {
    titulo: 'Lectura de la foto del comparendo',
    detalle:
      'Solo se probó con imágenes de prueba con datos inventados. Con una foto real, varios datos pueden salir marcados para revisar.',
    estado: 'listo',
  },
  {
    titulo: 'No mostramos el valor en pesos',
    detalle:
      'El valor de 2026 en pesos no está verificado. Ves la sanción en salarios mínimos diarios con su fuente. Confirma el valor en SIMIT.',
    estado: 'listo',
  },
  {
    titulo: 'Forma de contar los plazos',
    detalle:
      'La forma de contar los días hábiles está pendiente de revisión por un abogado. Si la fotomulta te llegó solo por correo electrónico o por aviso, el cálculo puede no aplicar.',
    estado: 'listo',
  },
  {
    titulo: 'Recordatorios al abrir la app',
    detalle: 'Las alertas de plazo se ven al abrir la app. No llegan notificaciones al celular.',
    estado: 'listo',
  },
  {
    titulo: 'VozVial no radica nada',
    detalle: 'La app generará la solicitud, pero tú la presentas ante el organismo de tránsito.',
    estado: 'listo',
  },
  {
    titulo: 'Pruebas automáticas con datos simulados',
    detalle:
      'En las pruebas automáticas la voz, el micrófono, la ubicación, las fotos y el reloj son simulados, y los tiempos de bloqueo e inactividad son de pocos segundos. La app real usa los de verdad.',
    estado: 'listo',
  },
  {
    titulo: 'Pantallas de ejemplo',
    detalle: 'La solicitud de audiencia todavía muestra datos inventados para ver el diseño. Está marcada "Ejemplo".',
    estado: 'listo',
  },
];
