/**
 * Normaliza texto en español para buscar en la base normativa y en las
 * preguntas verificadas. Es determinista y no depende de la plataforma.
 *
 * Pasos, en este orden:
 * 1. Minúsculas y sin tildes ni diéresis ("Tránsito" -> "transito"). La ñ se
 *    conserva como n para que "año" y "ano" coincidan cuando el usuario no
 *    escribe la tilde de la ñ.
 * 2. Frases coloquiales de varias palabras se cambian por un término
 *    canónico (FRASES_SINONIMAS), por ejemplo "foto multa" -> "fotomulta".
 * 3. Se quitan signos y se parte en palabras.
 * 4. Se descartan las palabras vacías (PALABRAS_VACIAS) y las de una letra.
 * 5. Cada palabra se lleva a su término canónico si está en SINONIMOS.
 * 6. Se quita el plural simple ("multas" -> "multa"); ver raiz().
 */

/**
 * Palabras vacías: artículos, preposiciones, pronombres, conjunciones,
 * interrogativos y verbos de apoyo muy frecuentes ("puedo", "tengo", "pasa").
 * Se quitan porque aparecen en casi todas las preguntas y no ayudan a
 * distinguir un tema de otro. Lista propia del equipo, sin tildes.
 */
export const PALABRAS_VACIAS: readonly string[] = [
  // artículos y contracciones
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'lo', 'al', 'del',
  // preposiciones
  'a', 'ante', 'bajo', 'con', 'contra', 'de', 'desde', 'en', 'entre', 'hacia', 'hasta', 'para', 'por',
  'segun', 'sin', 'sobre', 'tras', 'durante', 'mediante',
  // pronombres y posesivos
  'yo', 'me', 'mi', 'mis', 'conmigo', 'tu', 'tus', 'te', 'ti', 'usted', 'ustedes', 'le', 'les', 'se', 'si',
  'nos', 'nosotros', 'ella', 'ellas', 'ellos', 'su', 'sus', 'suyo', 'suya', 'nuestro', 'nuestra',
  'este', 'esta', 'esto', 'estos', 'estas', 'ese', 'esa', 'eso', 'esos', 'esas', 'aquel', 'aquella',
  'alguien', 'algo', 'alguno', 'alguna', 'algun', 'cualquier', 'cualquiera',
  'mismo', 'misma', 'todo', 'toda', 'todos', 'todas',
  // conjunciones y adverbios de relleno
  'y', 'e', 'o', 'u', 'ni', 'pero', 'sino', 'que', 'porque', 'pues', 'entonces', 'tambien', 'tampoco',
  'ya', 'aun', 'todavia', 'muy', 'mas', 'menos', 'tan', 'tanto', 'asi', 'bien', 'solo', 'ahi', 'aqui',
  'alla', 'aca', 'ahora', 'luego', 'despues', 'antes', 'siempre', 'nunca', 'casi', 'no', 'sí',
  // interrogativos débiles ("cuánto", "quién", "cuándo" y "dónde" sí se conservan: marcan la intención)
  'como', 'cual', 'cuales',
  // verbos de apoyo
  'es', 'son', 'era', 'ser', 'sea', 'fue', 'esta', 'estan', 'estar', 'estoy', 'estaba', 'he', 'ha', 'han',
  'has', 'hay', 'haber', 'habia', 'hubo', 'puedo', 'puede', 'pueden', 'poder', 'podria', 'tengo', 'tiene',
  'tienen', 'tener', 'tenia', 'hago', 'hace', 'hacen', 'hacer', 'hice', 'hizo', 'pasa', 'pasar', 'paso',
  'debo', 'debe', 'deben', 'deber', 'toca', 'voy', 'va', 'van', 'ir', 'quiero', 'quiere', 'dice', 'dijo',
  'sale', 'dar', 'doy', 'da', 'dan', 'poner', 'ponen', 'puso', 'pusieron', 'hicieron', 'decir',
  // tratamientos y muletillas
  'senor', 'senora', 'don', 'dona', 'mijo', 'mija', 'favor', 'gracias', 'hola', 'oiga', 'pregunta', 'saber',
];

/**
 * Frases de varias palabras que se reemplazan por un solo término antes de
 * partir el texto. El texto de entrada ya está en minúsculas y sin tildes.
 */
export const FRASES_SINONIMAS: readonly (readonly [RegExp, string])[] = [
  // "me pasé el semáforo" no es el pase (licencia).
  [/\bme\s+pase\b/g, 'pasarse'],
  [/\bfoto\s*-?\s*multas?\b/g, 'fotomulta'],
  // "El 12 de octubre se corre para el lunes": así se habla del festivo trasladado.
  [/\b(se\s+)?(corre|corren|pasa|pasan|traslada|trasladan|mueve|mueven)\s+(para\s+|al\s+|a\s+)?(el\s+)?lunes\b/g, 'festivo'],
  [/\bfoto\s*comparendos?\b/g, 'fotomulta'],
  [/\bpase\s+de\s+conduccion\b/g, 'licencia'],
  [/\blicencia\s+de\s+conduccion\b/g, 'licencia'],
  [/\bquiere\s+decir\b/g, 'significa'],
  [/\bpico\s+y\s+placa\b/g, 'picoyplaca'],
  [/\bmanos\s+libres\b/g, 'manoslibres'],
  [/\bhabeas\s+data\b/g, 'datospersonales'],
  [/\bdatos\s+personales\b/g, 'datospersonales'],
  [/\bsalarios?\s+minimos?\b/g, 'salariominimo'],
  [/\bunidad\s+de\s+valor\s+basico\b/g, 'uvb'],
  [/\bcobro\s+coactivo\b/g, 'cobrocoactivo'],
  [/\btecnico\s*-?\s*mecanica\b/g, 'tecnicomecanica'],
  [/\bdias?\s+habil(es)?\b/g, 'diahabil'],
  [/\bcinturon\s+de\s+seguridad\b/g, 'cinturon'],
  [/\bagente\s+de\s+transito\b/g, 'agente'],
  [/\bel\s+de\s+transito\b/g, 'agente'],
];

/**
 * Sinónimos coloquiales colombianos. Cada grupo se lleva a un término
 * canónico (la clave). Se buscan después de quitar tildes.
 */
export const GRUPOS_SINONIMOS: Readonly<Record<string, readonly string[]>> = {
  // "Me pusieron un parte" y "me pusieron una multa" se dicen del comparendo.
  comparendo: [
    'comparendo', 'comparendos', 'multa', 'multas', 'parte', 'partes', 'boleta', 'multar', 'multan', 'multaron',
    'multarme', 'multado', 'multada', 'multen',
  ],
  // "Me paró el tránsito", "me pararon": el agente detuvo el vehículo.
  parar: ['parar', 'paro', 'pararon', 'paran', 'detuvo', 'detuvieron', 'detener'],
  fotomulta: [
    'fotomulta', 'fotomultas', 'fotodeteccion', 'fotodetector', 'fotodetecciones', 'camara', 'camaras',
    'fotocomparendo', 'radar', 'radares',
  ],
  // Pedir audiencia es la forma de impugnar; la gente dice reclamar o pelear.
  impugnar: [
    'audiencia', 'audiencias', 'impugnar', 'impugno', 'impugnacion', 'reclamar', 'reclamo', 'reclamacion',
    'pelear', 'peleo', 'descargos', 'objetar',
  ],
  // Los recursos contra la decisión.
  recurso: ['recurso', 'recursos', 'apelar', 'apelo', 'apelacion', 'reposicion'],
  // Grúa y patios son la inmovilización del vehículo.
  inmovilizar: [
    'inmovilizar', 'inmovilizan', 'inmovilizo', 'inmovilizado', 'inmovilizada', 'inmovilizacion', 'grua',
    'gruas', 'patio', 'patios', 'parqueadero', 'parqueaderos',
  ],
  vehiculo: [
    'vehiculo', 'vehiculos', 'carro', 'carros', 'moto', 'motos', 'motocicleta', 'automovil', 'camioneta',
    'taxi', 'bus', 'buseta', 'campero',
  ],
  licencia: ['licencia', 'licencias', 'pase'],
  conducir: ['conducir', 'conduciendo', 'conduzco', 'manejar', 'manejando', 'manejo', 'maneja', 'volante'],
  agente: ['agente', 'agentes', 'policia', 'policias', 'guarda', 'patrullero', 'inspector'],
  pagar: ['pagar', 'pago', 'pague', 'pagando', 'cancelar', 'cancelo'],
  descuento: ['descuento', 'descuentos', 'rebaja', 'rebajas', 'reduccion', 'mitad'],
  celular: ['celular', 'telefono', 'whatsapp'],
  grabar: ['grabar', 'grabe', 'grabo', 'grabacion', 'filmar', 'filmo', 'filmacion', 'video', 'videos'],
  abogado: ['abogado', 'abogados', 'apoderado'],
  plazo: ['plazo', 'plazos', 'termino', 'terminos'],
  // "dias" no se acorta en raiz() por tener 4 letras.
  dia: ['dia', 'dias'],
  seguro: ['seguro', 'seguros', 'soat'],
  alcohol: ['alcohol', 'trago', 'tragos', 'borracho', 'embriaguez', 'alcoholemia', 'tomado', 'licor'],
  festivo: ['festivo', 'festivos', 'feriado', 'feriados', 'puente'],
  notificar: ['notificar', 'notifican', 'notificaron', 'notificacion', 'notificado'],
  // Interrogativos que distinguen la intención: monto o tiempo, persona, momento, lugar.
  cuanto: ['cuanto', 'cuanta', 'cuantos', 'cuantas'],
  quien: ['quien', 'quienes'],
  otro: ['otro', 'otra', 'otros', 'otras'],
};

const MAPA_SINONIMOS: ReadonlyMap<string, string> = (() => {
  const mapa = new Map<string, string>();
  for (const [canonico, variantes] of Object.entries(GRUPOS_SINONIMOS)) {
    for (const v of variantes) mapa.set(v, canonico);
  }
  return mapa;
})();

const VACIAS: ReadonlySet<string> = new Set(PALABRAS_VACIAS.map((p) => p.normalize('NFD').replace(/[̀-ͯ]/g, '')));

/**
 * Dos términos normalizados coinciden si son iguales o si comparten un prefijo
 * largo ("inmovilizan" e "inmovilizacion", "presento" y "presentarme"). El
 * prefijo debe medir al menos 5 letras y cubrir casi toda la palabra más corta.
 */
export function terminosCoinciden(a: string, b: string): boolean {
  if (a === b) return true;
  const corta = Math.min(a.length, b.length);
  if (corta < 5) return false;
  let comun = 0;
  while (comun < corta && a[comun] === b[comun]) comun++;
  return comun >= 5 && comun >= corta - 2;
}

export class NormalizadorEspanol {
  /** Minúsculas, sin tildes ni diéresis, espacios simples. */
  static sinTildes(texto: string): string {
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Quita el plural simple para que "multas" y "multa" coincidan.
   * Solo en palabras de más de 4 letras, para no tocar "mes" o "pais".
   */
  static raiz(palabra: string): string {
    if (palabra.length > 5 && /[^aeiou]es$/.test(palabra) && !/(ces|ses)$/.test(palabra)) {
      return palabra.slice(0, -2);
    }
    if (palabra.length > 4 && /[aeiou]s$/.test(palabra)) return palabra.slice(0, -1);
    return palabra;
  }

  /** Lista de términos normalizados, en el orden del texto. */
  tokens(texto: string): string[] {
    let limpio = NormalizadorEspanol.sinTildes(texto);
    for (const [patron, reemplazo] of FRASES_SINONIMAS) limpio = limpio.replace(patron, reemplazo);
    const palabras = limpio.replace(/[^a-z0-9]+/g, ' ').trim().split(' ');
    const salida: string[] = [];
    for (const palabra of palabras) {
      if (palabra.length < 2 || VACIAS.has(palabra)) continue;
      const canonica = MAPA_SINONIMOS.get(palabra) ?? MAPA_SINONIMOS.get(NormalizadorEspanol.raiz(palabra));
      salida.push(canonica ?? NormalizadorEspanol.raiz(palabra));
    }
    return salida;
  }

  /** Términos únicos, en el orden en que aparecen por primera vez. */
  terminosUnicos(texto: string): string[] {
    return [...new Set(this.tokens(texto))];
  }

  /** Texto normalizado unido por espacios. */
  normalizar(texto: string): string {
    return this.tokens(texto).join(' ');
  }
}
