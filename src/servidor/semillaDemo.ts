import { Caso } from '../core/Caso';
import { CodificacionBase64 } from '../core/CodificacionBase64';
import { CodigoRecuperacion } from '../core/CodigoRecuperacion';
import { Comparendo } from '../core/Comparendo';
import { DerivadorVerificador } from '../core/DerivadorVerificador';
import { Evidencia } from '../core/Evidencia';
import { FechaCivil } from '../core/FechaCivil';
import { GestorClaves } from '../core/GestorClaves';
import { ITERACIONES_PBKDF2_POR_DEFECTO } from '../core/DerivadorPBKDF2';
import { ValidadorRegistro } from '../core/ValidadorRegistro';
import { ServicioPlazos } from '../services/ServicioPlazos';
import type { BaseDatos } from './bd/conexion';
import { RepositorioCuentas } from './bd/RepositorioCuentas';
import { RepositorioCasosRemotos, RepositorioEvidenciasRemotas } from './bd/RepositorioDatosCifrados';
import type { ConfiguracionDatos } from './configuracion';
import { CriptoServidor } from './cuentas/CriptoServidor';
import { ServicioCuentasServidor } from './cuentas/ServicioCuentasServidor';

/** Escenarios de plazo que se siembran (docs/usuarios-demo.md). */
export type EscenarioDemo = 'via_urgente' | 'via_vencido' | 'fotodeteccion';

export interface CuentaDemo {
  nombre: string;
  celular: string;
  /** PIN de prueba publico: pasa ValidadorRegistro (6 digitos, sin secuencias ni repetidos). */
  pin: string;
  /** Codigo de recuperacion de prueba publico, en el alfabeto de CodigoRecuperacion. */
  codigo: string;
  casos: readonly { escenario: EscenarioDemo; codigoInfraccion: string; nota?: string; foto?: boolean }[];
}

/** Datos ficticios y publicos de demostracion. No corresponden a personas reales. */
export const CUENTAS_DEMO: readonly CuentaDemo[] = [
  {
    nombre: 'Rosa Elena Demo',
    celular: '3001112233',
    pin: '482915',
    codigo: 'RSEN-DEMA-4827',
    casos: [
      { escenario: 'via_urgente', codigoInfraccion: 'C02', nota: 'El agente no me dejó leer el comparendo antes de firmar. (Nota de demostración)', foto: true },
      { escenario: 'via_vencido', codigoInfraccion: 'B01' },
      { escenario: 'fotodeteccion', codigoInfraccion: 'C29' },
    ],
  },
  {
    nombre: 'Jorge Ivan Demo',
    celular: '3002223344',
    pin: '730264',
    codigo: 'JGVN-DEMB-5938',
    casos: [
      { escenario: 'via_urgente', codigoInfraccion: 'D04', nota: 'Había otro carro delante que tapaba el semáforo. (Nota de demostración)' },
      { escenario: 'fotodeteccion', codigoInfraccion: 'C29' },
    ],
  },
  {
    nombre: 'Carmen Lucia Demo',
    celular: '3003334455',
    pin: '615038',
    codigo: 'CRMN-DEMC-6249',
    casos: [
      { escenario: 'via_vencido', codigoInfraccion: 'C35', nota: 'Tenía la revisión técnico-mecánica al día; guardé el certificado. (Nota de demostración)' },
      { escenario: 'via_urgente', codigoInfraccion: 'C14' },
    ],
  },
];

// PNG de 1x1 pixel: evidencia de foto minima para probar la descarga de contenido cifrado.
const PNG_DEMO = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

// Coordenadas genericas del centro de Bogota, solo para la demostracion.
const UBICACION_DEMO = { lat: 4.5981, lon: -74.0758, precision: 30 };

export interface OpcionesSemilla {
  crypto?: Crypto;
  /** Iteraciones PBKDF2 de envolturas y verificadores. Por defecto las de produccion. */
  iteraciones?: number;
  reloj?: () => Date;
}

export interface ResultadoSemilla {
  cuentas: { celular: string; casos: number; evidencias: number }[];
}

function instanteBogota(fecha: FechaCivil, hora: string): string {
  return `${fecha.aISO()}T${hora}:00-05:00`;
}

/**
 * Fecha de comparendo en la via para cada escenario, calculada con los parametros verificados
 * y los festivos reales (ServicioPlazos): asi el escenario se cumple el dia que se siembra.
 */
export function fechasEscenario(plazos: ServicioPlazos, escenario: EscenarioDemo): { fecha: FechaCivil; notificacion?: FechaCivil } {
  const hoy = plazos.hoy();
  const prueba = (fecha: FechaCivil, tipo: 'via' | 'fotodeteccion', notificacion?: FechaCivil) =>
    plazos.estado(
      Comparendo.crear({ numero: '000000', fecha, codigoInfraccion: 'C02', tipo, fechaNotificacion: notificacion ?? null }),
    );
  if (escenario === 'via_urgente') {
    for (let d = 0; d <= 30; d++) {
      const fecha = hoy.sumarDias(-d);
      const estado = prueba(fecha, 'via');
      if (estado.nivel === 'urgente' && estado.restantes.dias >= 1 && estado.restantes.dias <= 2) return { fecha };
    }
    throw new Error('No se encontro una fecha con el plazo por vencer en 1 o 2 dias habiles');
  }
  if (escenario === 'via_vencido') {
    const fecha = hoy.sumarDias(-45);
    if (prueba(fecha, 'via').nivel !== 'vencido') throw new Error('La fecha del caso vencido no quedo vencida');
    return { fecha };
  }
  // Fotodeteccion: infraccion hace 20 dias, notificacion recibida hace 2.
  return { fecha: hoy.sumarDias(-20), notificacion: hoy.sumarDias(-2) };
}

/**
 * Crea las cuentas de demostracion con casos cifrados en el mismo formato que la app
 * (AlmacenCifrado): JSON de Caso cifrado con AES-GCM y la clave de datos de la cuenta.
 * Idempotente: si la cuenta existe, se borra (con sus casos) y se vuelve a crear.
 */
export async function sembrarDemo(
  bd: BaseDatos,
  config: Pick<ConfiguracionDatos, 'secreto' | 'scrypt' | 'iteracionesAuth' | 'maxIntentos' | 'bloqueoMs' | 'sesionMs'>,
  opciones: OpcionesSemilla = {},
): Promise<ResultadoSemilla> {
  const crypto = opciones.crypto ?? globalThis.crypto;
  const iteraciones = opciones.iteraciones ?? ITERACIONES_PBKDF2_POR_DEFECTO;
  const reloj = opciones.reloj ?? (() => new Date());
  const gestor = new GestorClaves(crypto, { iteraciones });
  const derivador = new DerivadorVerificador(crypto);
  const plazos = ServicioPlazos.crear({ reloj });
  const servicio = new ServicioCuentasServidor(bd, {
    cripto: new CriptoServidor(config.secreto, config.scrypt),
    iteracionesAuth: config.iteracionesAuth,
    maxIntentos: config.maxIntentos,
    bloqueoMs: config.bloqueoMs,
    sesionMs: config.sesionMs,
    reloj,
  });
  const cuentas = new RepositorioCuentas(bd);
  const casosRepo = new RepositorioCasosRemotos(bd);
  const evidenciasRepo = new RepositorioEvidenciasRemotas(bd);
  const resultado: ResultadoSemilla = { cuentas: [] };

  for (const demo of CUENTAS_DEMO) {
    if (!CodigoRecuperacion.esValido(demo.codigo)) throw new Error(`Codigo de demostracion invalido para ${demo.celular}`);
    const validacion = ValidadorRegistro.validar({
      nombre: demo.nombre,
      celular: demo.celular,
      pin: demo.pin,
      confirmacionPin: demo.pin,
      autorizaDatos: true,
    });
    if (!validacion.valido) throw new Error(`Datos de demostracion invalidos para ${demo.celular}`);

    await cuentas.borrarPorCelular(demo.celular);
    const codigo = CodigoRecuperacion.normalizar(demo.codigo);
    const claveDatos = await gestor.generarClaveDatos();
    const parametros = derivador.nuevosParametros(iteraciones);
    const [claveEnvueltaPin, claveEnvueltaCodigo, perfilCifrado, verificadorPin, verificadorCodigo] = await Promise.all([
      gestor.envolver(claveDatos, demo.pin),
      gestor.envolver(claveDatos, codigo),
      gestor.cifrar(claveDatos, JSON.stringify({ nombre: demo.nombre, celular: demo.celular })),
      derivador.verificadorPin(demo.pin, parametros),
      derivador.verificadorCodigo(codigo, parametros),
    ]);
    const registro = await servicio.registrar({
      celular: demo.celular,
      salAuth: parametros.salAuth,
      iteraciones: parametros.iteraciones,
      verificadorPin,
      verificadorCodigo,
      claveEnvueltaPin,
      claveEnvueltaCodigo,
      perfilCifrado,
    });
    if (!registro.ok) throw new Error(`No se pudo crear la cuenta de demostracion ${demo.celular}`);
    const cuenta = await cuentas.buscarPorCelular(demo.celular);
    if (!cuenta) throw new Error('La cuenta de demostracion no quedo guardada');

    let numeroEvidencias = 0;
    for (const [indice, definicion] of demo.casos.entries()) {
      const { fecha, notificacion } = fechasEscenario(plazos, definicion.escenario);
      const casoId = crypto.randomUUID();
      const creadoEn = instanteBogota(fecha, '07:40');
      const evidencias: Evidencia[] = [];
      if (definicion.nota) {
        evidencias.push(
          Evidencia.crear({ id: crypto.randomUUID(), tipo: 'nota', creadaEn: instanteBogota(fecha, '07:45'), texto: definicion.nota }),
        );
      }
      let foto: { evidencia: Evidencia; bytes: Uint8Array<ArrayBuffer> } | null = null;
      if (definicion.foto) {
        const bytes = CodificacionBase64.decodificar(PNG_DEMO);
        const evidencia = Evidencia.crear({
          id: crypto.randomUUID(),
          tipo: 'foto',
          creadaEn: instanteBogota(fecha, '07:47'),
          mime: 'image/png',
          nombre: 'foto-demostracion.png',
          tamano: bytes.length,
        });
        evidencias.push(evidencia);
        foto = { evidencia, bytes };
      }
      const esFoto = definicion.escenario === 'fotodeteccion';
      const caso = Caso.crear({
        id: casoId,
        creadoEn,
        // Un caso sin ubicacion para mostrar ese estado (CA-07.2).
        ubicacion: esFoto ? null : UBICACION_DEMO,
        motivoSinUbicacion: esFoto ? 'no_disponible' : null,
        evidencias,
        comparendo: Comparendo.crear({
          numero: `99000000${demo.celular.slice(-4)}${indice + 1}`,
          fecha,
          placa: `DEM${demo.celular.slice(-3)}`,
          codigoInfraccion: definicion.codigoInfraccion,
          tipo: esFoto ? 'fotodeteccion' : 'via',
          fechaNotificacion: notificacion ?? null,
          organismo: 'Organismo de tránsito de demostración',
        }),
        conductor: { nombre: demo.nombre, celular: demo.celular, ciudad: 'Bogotá' },
        estado: 'abierto',
      });
      const cifrado = await gestor.cifrar(claveDatos, JSON.stringify(caso.toJSON()));
      const actualizadoEn = reloj().toISOString();
      await casosRepo.guardar(cuenta.id, { id: casoId, iv: cifrado.iv, datos: cifrado.datos, actualizadoEn });

      if (foto) {
        // Mismo formato que AlmacenCifrado.guardarContenidoEvidencia: AES-GCM sobre los bytes, iv de 12 bytes.
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const datos = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, claveDatos, foto.bytes));
        await evidenciasRepo.guardar(cuenta.id, {
          id: foto.evidencia.id,
          casoId,
          iv: CodificacionBase64.codificar(iv),
          mime: 'image/png',
          actualizadoEn,
          datos,
        });
        numeroEvidencias += 1;
      }
    }
    resultado.cuentas.push({ celular: demo.celular, casos: demo.casos.length, evidencias: numeroEvidencias });
  }
  return resultado;
}

const ESCENARIOS_TEXTO: Record<EscenarioDemo, string> = {
  via_urgente: 'comparendo en la vía con el plazo por vencer en 1 o 2 días hábiles',
  via_vencido: 'comparendo en la vía con el plazo vencido',
  fotodeteccion: 'comparendo por fotodetección (notificación recibida hace 2 días)',
};

/** Contenido de docs/usuarios-demo.md, generado desde CUENTAS_DEMO para que no se desalineen. */
export function documentoUsuariosDemo(): string {
  const filas = CUENTAS_DEMO.map((c) => `| ${c.nombre} | ${c.celular} | ${c.pin} | ${c.codigo} |`).join('\n');
  const detalle = CUENTAS_DEMO.map((c) => {
    const casos = c.casos
      .map((k) => {
        const extras = [k.nota ? 'con una nota' : '', k.foto ? 'con una foto' : ''].filter(Boolean).join(' y ');
        return `  - Código ${k.codigoInfraccion}: ${ESCENARIOS_TEXTO[k.escenario]}${extras ? `, ${extras}` : ''}.`;
      })
      .join('\n');
    return `- **${c.nombre}** (${c.celular}):\n${casos}`;
  }).join('\n');
  return `# Usuarios de demostración

> **Advertencia.** Estas cuentas son **ficticias y públicas**: sirven solo para probar y mostrar el prototipo.
> Los nombres, celulares, PIN, códigos de recuperación, placas y números de comparendo son inventados.
> No guardes datos reales en ellas: cualquiera que lea este documento puede entrar.

| Nombre | Celular | PIN | Código de recuperación |
|---|---|---|---|
${filas}

## Qué trae cada cuenta

Las fechas se calculan el día en que se siembra, con los parámetros verificados de \`data/normativa/parametros.json\`
y los festivos de Colombia. Por eso el caso "por vencer" solo está por vencer los días siguientes a la siembra:
para refrescarlo hay que volver a correr la semilla.

${detalle}

Los códigos de infracción existen y están verificados en \`data/infracciones.json\`.

## Cómo se siembran

\`\`\`bash
# Contra una base local (PGlite en una carpeta) o un Postgres propio:
npx tsx scripts/sembrar-demo.ts --url-bd postgres://usuario:clave@localhost:5432/vozvial
# Sin --url-bd usa DATABASE_URL. Con --pglite <carpeta> usa PGlite en disco.
\`\`\`

La semilla es idempotente: si una cuenta ya existe, la borra con sus casos y la vuelve a crear.
Los casos quedan cifrados con la clave de datos de cada cuenta, en el mismo formato que usa la app,
así que el servidor no puede leerlos: solo se abren entrando con el celular y el PIN de esta tabla.
`;
}
