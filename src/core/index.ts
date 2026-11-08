/**
 * Barril del dominio de VozVial. Todo lo que exporta es TypeScript puro, sin React ni APIs de plataforma.
 *
 * cargarDatos.ts no se reexporta aqui a proposito: importa los JSON de data/ y arma instancias
 * compartidas. Quien lo necesite (api/asistente.ts, scripts, pantallas) lo importa directo, asi
 * importar el barril no arrastra la base normativa completa.
 */

// Tiempo y plazos
export * from './FechaCivil';
export * from './FestivosColombia';
export * from './ParametrosPlazos';
export * from './CalculadoraPlazos';

// Seguridad
export * from './CodificacionBase64';
export * from './DerivadorPBKDF2';
export * from './ErrorClave';
export * from './ServicioCredenciales';
export * from './ControlIntentos';
export * from './GestorClaves';
export * from './CodigoRecuperacion';
export * from './ValidadorRegistro';
export * from './ValidadorRedaccion';
export * from './DerivadorVerificador';

// Sincronizacion con el servidor (gana el mas reciente)
export * from './ResolvedorSincronizacion';

// Casos, comparendo y solicitud
export * from './Evidencia';
export * from './Comparendo';
export * from './Caso';
export * from './PrioridadCasos';
export * from './ParserComparendo';
export * from './CatalogoInfracciones';
export * from './GeneradorSolicitud';

// Asistente normativo
export * from './NormalizadorEspanol';
export * from './BaseNormativa';
// Explícito porque ProveedorRespuesta también reexporta Cita, que ya sale de BaseNormativa.
export {
  AVISO_LEGAL,
  TEXTO_ABSTENCION,
  SUGERENCIA_ABSTENCION,
  crearAbstencion,
  redondear,
  type TipoRespuesta,
  type ModoAsistente,
  type RespuestaAsistente,
  type ProveedorRespuesta,
} from './ProveedorRespuesta';
export * from './DetectorTema';
export * from './ProveedorVerificado';
export * from './ProveedorLLM';
export * from './AsistenteNormativo';
export * from './DerechosClave';

// Voz (solo la interfaz; las implementaciones viven en src/services)
export * from './ProveedorVoz';
