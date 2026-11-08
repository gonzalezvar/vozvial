import { NormalizadorEspanol, terminosCoinciden } from './NormalizadorEspanol';

/**
 * Vocabulario de los temas que cubre VozVial, ya normalizado (sin tildes, en
 * singular y con los sinónimos llevados a su término canónico; ver
 * NormalizadorEspanol). Incluye tránsito y los dos temas vecinos que la app
 * usa: el derecho a grabar procedimientos (Ley 1801) y los datos personales
 * (Ley 1581), además de festivos y días hábiles para los plazos.
 */
export const VOCABULARIO_TEMA: readonly string[] = [
  // términos canónicos del normalizador
  'comparendo', 'fotomulta', 'impugnar', 'recurso', 'inmovilizar', 'vehiculo', 'licencia', 'conducir', 'agente',
  'descuento', 'grabar', 'plazo', 'seguro', 'alcohol', 'festivo', 'notificar', 'picoyplaca', 'tecnicomecanica',
  'diahabil', 'cinturon', 'cobrocoactivo', 'uvb', 'salariominimo', 'datospersonales', 'pasarse', 'manoslibres',
  // tránsito y vía
  'transito', 'via', 'carretera', 'autopista', 'semaforo', 'senal', 'senalizacion', 'velocidad', 'placa', 'runt',
  'simit', 'infraccion', 'infractor', 'contraventor', 'contravencion', 'sancion', 'casco', 'pasajero', 'peaton',
  'ciclista', 'bicicleta', 'estacionar', 'estacionado', 'parquear', 'accidente', 'choque', 'chocar', 'conductor',
  'propietario', 'traspaso', 'matricula', 'caducidad', 'caducar', 'caduca', 'prescripcion', 'prescribe',
  'prescribir', 'curso', 'tecnomecanica', 'retenido', 'pare', 'cruce', 'carril', 'contramano', 'adelantar',
  // procedimiento (vacíos encontrados al pasar las preguntas verificadas por el detector)
  'pagar', 'abogado', 'comparecer', 'comparecencia', 'prueba', 'firma', 'firmar', 'presentarse', 'presentarme',
  // el inspector o funcionario de tránsito (antes "inspector" se llevaba a "agente")
  'funcionario',
  // datos personales
  'dato', 'privacidad',
];

export const MENSAJE_FUERA_DE_TEMA =
  'Esa pregunta no parece ser de tránsito. Puedo ayudarte con comparendos, fotomultas, plazos para presentarte, ' +
  'la audiencia para impugnar, la inmovilización del vehículo, tu derecho a grabar el procedimiento y tus datos personales.';

export interface ResultadoTema {
  enTema: boolean;
  /** Términos de la pregunta que pertenecen al vocabulario del tema. */
  terminosDelTema: string[];
}

/**
 * Decide si una pregunta es de los temas que cubre la app. Corre antes de la
 * búsqueda, para que una pregunta fuera de tema reciba un mensaje que explica
 * qué sí se cubre en lugar de una abstención.
 */
export class DetectorTema {
  private readonly vocabulario: readonly string[];

  constructor(
    private readonly normalizador: NormalizadorEspanol = new NormalizadorEspanol(),
    vocabulario: readonly string[] = VOCABULARIO_TEMA,
  ) {
    this.vocabulario = vocabulario;
  }

  evaluar(pregunta: string): ResultadoTema {
    const terminos = this.normalizador.terminosUnicos(pregunta);
    const delTema = terminos.filter((t) => this.vocabulario.some((v) => terminosCoinciden(v, t)));
    return { enTema: delTema.length > 0, terminosDelTema: delTema };
  }

  esDelTema(pregunta: string): boolean {
    return this.evaluar(pregunta).enTema;
  }
}
