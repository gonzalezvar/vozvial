import { CatalogoInfracciones } from './CatalogoInfracciones';
import { Comparendo, TIPOS_COMPARENDO } from './Comparendo';
import { FechaCivil } from './FechaCivil';

export type CampoOCR = 'numero' | 'fecha' | 'placa' | 'codigoInfraccion' | 'tipo';

export const CAMPOS_OCR: readonly CampoOCR[] = ['numero', 'fecha', 'placa', 'codigoInfraccion', 'tipo'];

/** Palabra reconocida por el OCR, con su confianza de 0 a 100 (como la entrega tesseract.js). */
export interface PalabraOCR {
  texto: string;
  confianza: number;
}

export interface CampoExtraido {
  /** Valor normalizado: número sin espacios, fecha AAAA-MM-DD, placa ABC123, código C02, tipo. */
  valor: string | null;
  /** 0 a 100. */
  confianza: number;
  /** true si el conductor debe revisarlo antes de guardar (CA-09.2). */
  dudoso: boolean;
}

export interface ResultadoParser {
  campos: Record<CampoOCR, CampoExtraido>;
}

export interface OpcionesParser {
  /** Por debajo de esta confianza el campo queda dudoso. 70 por defecto. */
  umbralDuda?: number;
}

/** Candidato encontrado en el texto, con su posición para cruzarlo con las palabras del OCR. */
interface Candidato {
  valor: string;
  ini: number;
  fin: number;
  /** Confianza propia del patrón: alta con etiqueta, baja sin ella o con letras corregidas. */
  base: number;
}

interface Tramo {
  ini: number;
  fin: number;
  confianza: number;
}

// Confianza del patrón según cómo se encontró el valor.
const BASE_ETIQUETADO = 100;
const BASE_ETIQUETA_DEBIL = 85;
const BASE_SIN_ETIQUETA = 60;
// Se resta cuando hubo que cambiar O por 0 (o al revés): el conductor debe revisarlo.
const CASTIGO_CORRECCION = 35;

const VENTANA_ETIQUETA = 30;

const MESES: readonly [RegExp, number][] = [
  [/^ene/, 1],
  [/^feb/, 2],
  [/^mar/, 3],
  [/^abr/, 4],
  [/^may/, 5],
  [/^jun/, 6],
  [/^jul/, 7],
  [/^ago/, 8],
  [/^(sep|set)/, 9],
  [/^oct/, 10],
  [/^nov/, 11],
  [/^dic/, 12],
];

// Los nombres completos van antes que sus abreviaturas para que la alternancia tome el más largo.
const NOMBRE_MES =
  'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|' +
  'ene|feb|mar|abr|may|jun|jul|ago|sept|sep|set|oct|nov|dic';

/**
 * Convierte el texto del OCR de un comparendo en campos con confianza.
 * No usa el catálogo: solo verifica la forma de los datos. La existencia del
 * código la decide CatalogoInfracciones al guardar (CA-09.3).
 */
export class ParserComparendo {
  readonly umbralDuda: number;

  constructor(opciones: OpcionesParser = {}) {
    const umbral = opciones.umbralDuda ?? 70;
    if (!Number.isFinite(umbral) || umbral < 0 || umbral > 100) {
      throw new RangeError('El umbral de duda debe estar entre 0 y 100.');
    }
    this.umbralDuda = umbral;
  }

  analizar(texto: string, palabras?: readonly PalabraOCR[]): ResultadoParser {
    const original = texto.normalize('NFC');
    // Mismo largo que el original: los índices sirven en ambos.
    const plano = plegar(original);
    const tramos = ubicarPalabras(original, plano, palabras ?? []);
    const promedio = promedioConfianza(palabras ?? []);

    const confianzaOCR = (c: Candidato): number => {
      if (!palabras || palabras.length === 0) return 100;
      const solapados = tramos.filter((t) => t.ini < c.fin && t.fin > c.ini);
      if (solapados.length === 0) return promedio;
      return Math.min(...solapados.map((t) => t.confianza));
    };

    const armar = (campo: CampoOCR, candidato: Candidato | null): CampoExtraido => {
      if (!candidato) return { valor: null, confianza: 0, dudoso: true };
      const confianza = Math.round(limitar(Math.min(candidato.base, confianzaOCR(candidato))));
      const dudoso = confianza < this.umbralDuda || !ParserComparendo.formatoValido(campo, candidato.valor);
      return { valor: candidato.valor, confianza, dudoso };
    };

    return {
      campos: {
        numero: armar('numero', buscarNumero(plano)),
        fecha: armar('fecha', buscarFecha(plano)),
        placa: armar('placa', buscarPlaca(original, plano)),
        codigoInfraccion: armar('codigoInfraccion', buscarCodigo(original, plano)),
        tipo: armar('tipo', buscarTipo(plano)),
      },
    };
  }

  /** Revisa que el valor tenga la forma esperada del campo. */
  static formatoValido(campo: CampoOCR, valor: string | null): boolean {
    if (valor === null) return false;
    switch (campo) {
      case 'numero':
        return /^\d{6,}$/.test(valor);
      case 'fecha':
        try {
          FechaCivil.desdeISO(valor);
          return true;
        } catch {
          return false;
        }
      case 'placa':
        return Comparendo.esPlacaValida(valor);
      case 'codigoInfraccion':
        return CatalogoInfracciones.normalizarCodigo(valor) === valor;
      case 'tipo':
        return (TIPOS_COMPARENDO as readonly string[]).includes(valor);
    }
  }
}

function limitar(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

/** Minúsculas y sin tildes, carácter por carácter, para conservar las posiciones. */
function plegar(texto: string): string {
  let salida = '';
  for (const c of texto.split('')) {
    const p = c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    salida += p.length === 1 ? p : c;
  }
  return salida;
}

function promedioConfianza(palabras: readonly PalabraOCR[]): number {
  const validas = palabras.filter((p) => Number.isFinite(p.confianza));
  if (validas.length === 0) return 100;
  return limitar(validas.reduce((s, p) => s + p.confianza, 0) / validas.length);
}

/** Ubica cada palabra del OCR en el texto, en orden, para saber qué confianza tiene cada tramo. */
function ubicarPalabras(original: string, plano: string, palabras: readonly PalabraOCR[]): Tramo[] {
  const tramos: Tramo[] = [];
  let cursor = 0;
  for (const palabra of palabras) {
    const t = palabra.texto.normalize('NFC').trim();
    if (t === '') continue;
    let ini = original.indexOf(t, cursor);
    if (ini < 0) ini = plano.indexOf(plegar(t), cursor);
    if (ini < 0) continue;
    tramos.push({ ini, fin: ini + t.length, confianza: limitar(palabra.confianza) });
    cursor = ini + t.length;
  }
  return tramos;
}

function todas(patron: RegExp, texto: string, desde = 0, hasta = texto.length): RegExpExecArray[] {
  const re = new RegExp(patron.source, patron.flags.includes('g') ? patron.flags : patron.flags + 'g');
  const tramo = texto.slice(0, hasta);
  re.lastIndex = desde;
  const salida: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(tramo)) !== null) {
    salida.push(m);
    if (m[0].length === 0) re.lastIndex++;
  }
  return salida;
}

/** Posición del grupo de captura que cierra la coincidencia (los patrones se escriben así). */
function finDeGrupo(m: RegExpExecArray, grupo: string): { ini: number; fin: number } {
  const fin = m.index + m[0].length;
  return { ini: fin - grupo.length, fin };
}

// --- Número del comparendo ---------------------------------------------------

function buscarNumero(plano: string): Candidato | null {
  // Solo dígitos, guiones y la letra o (el OCR la confunde con 0). Sin espacios,
  // para no pegar el número con la fecha que suele venir al lado.
  const cola = String.raw`[^0-9\n]{0,${VENTANA_ETIQUETA}}?(\d[\do-]{5,})`;
  const etiquetas: [RegExp, number][] = [
    [new RegExp(String.raw`\bcomparendo\b` + cola, 'g'), BASE_ETIQUETADO],
    [new RegExp(String.raw`(?:\bnumero\b|\bnro\b|\bno\b|n[°º])` + cola, 'g'), BASE_ETIQUETA_DEBIL],
  ];
  for (const [patron, base] of etiquetas) {
    for (const m of todas(patron, plano)) {
      const crudo = m[1];
      if (!crudo) continue;
      const limpio = crudo.replace(/[o-]+$/, '');
      // Una fecha AAAA-MM-DD pegada a la etiqueta no es el número.
      if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(limpio)) continue;
      const pos = finDeGrupo(m, crudo);
      const valor = limpio.replace(/o/g, '0').replace(/-/g, '');
      if (valor.length < 6) continue;
      const corregido = /o/.test(limpio);
      return {
        valor,
        ini: pos.ini,
        fin: pos.ini + limpio.length,
        base: corregido ? base - CASTIGO_CORRECCION : base,
      };
    }
  }
  // Sin etiqueta: la secuencia de dígitos más larga, si es claramente larga.
  let mejor: Candidato | null = null;
  for (const m of todas(/\d{10,}/g, plano)) {
    if (!mejor || m[0].length > mejor.valor.length) {
      mejor = { valor: m[0], ini: m.index, fin: m.index + m[0].length, base: BASE_SIN_ETIQUETA };
    }
  }
  return mejor;
}

// --- Fecha de la infracción ---------------------------------------------------

function crearFecha(anio: number, mes: number, dia: number): string | null {
  try {
    return FechaCivil.de(anio, mes, dia).aISO();
  } catch {
    return null;
  }
}

function numeroMes(nombre: string): number | null {
  for (const [patron, n] of MESES) if (patron.test(nombre)) return n;
  return null;
}

function buscarFecha(plano: string): Candidato | null {
  const encontradas: { valor: string; ini: number; fin: number }[] = [];
  const agregar = (m: RegExpExecArray, valor: string | null) => {
    if (valor) encontradas.push({ valor, ini: m.index, fin: m.index + m[0].length });
  };

  for (const m of todas(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/g, plano)) {
    agregar(m, crearFecha(Number(m[3]), Number(m[2]), Number(m[1])));
  }
  for (const m of todas(/\b(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})\b/g, plano)) {
    agregar(m, crearFecha(Number(m[1]), Number(m[2]), Number(m[3])));
  }
  const largo = new RegExp(String.raw`\b(\d{1,2})\s+(?:de\s+)?(${NOMBRE_MES})\.?\s+(?:de\s+|del\s+)?(\d{4})\b`, 'g');
  for (const m of todas(largo, plano)) {
    const mes = numeroMes(m[2] ?? '');
    if (mes !== null) agregar(m, crearFecha(Number(m[3]), mes, Number(m[1])));
  }

  encontradas.sort((a, b) => a.ini - b.ini);

  // Se descarta la fecha de notificación: la que se pide aquí es la de la infracción.
  const clasificadas = encontradas.map((f) => {
    const contexto = plano.slice(Math.max(0, f.ini - 40), f.ini);
    const ultimaFecha = contexto.lastIndexOf('fecha');
    const segmento =
      ultimaFecha >= 0 ? contexto.slice(ultimaFecha) : contexto.slice(contexto.lastIndexOf('\n') + 1);
    return { ...f, etiquetada: ultimaFecha >= 0, notificacion: /notific/.test(segmento) };
  });

  const etiquetada = clasificadas.find((f) => f.etiquetada && !f.notificacion);
  if (etiquetada) return { ...etiquetada, base: BASE_ETIQUETADO };
  const libre = clasificadas.find((f) => !f.notificacion);
  if (libre) return { ...libre, base: BASE_ETIQUETA_DEBIL };
  return null;
}

// --- Placa ---------------------------------------------------------------------

/** Corrige O/0 según la posición: letras en las tres primeras, dígitos en las siguientes. */
function corregirPlaca(letras: string, resto: string): { placa: string; corregida: boolean } | null {
  const l = letras.toUpperCase().replace(/0/g, 'O');
  const d = resto.toUpperCase();
  const dos = d.slice(0, 2).replace(/O/g, '0');
  let ultimo = d.slice(2);
  // Una O al final se lee como 0 (carro); una moto con O final queda dudosa igual.
  if (ultimo === 'O') ultimo = '0';
  const placa = `${l}${dos}${ultimo}`;
  if (!Comparendo.esPlacaValida(placa)) return null;
  const corregida = placa !== `${letras}${resto}`.toUpperCase();
  return { placa, corregida };
}

function buscarPlaca(original: string, plano: string): Candidato | null {
  for (const etiqueta of todas(/\bplaca\b/g, plano)) {
    const desde = etiqueta.index + etiqueta[0].length;
    const hasta = Math.min(plano.length, desde + VENTANA_ETIQUETA);
    for (const m of todas(/\b([a-z0-9]{3})[ -]?([a-z0-9]{3})\b/g, plano, desde, hasta)) {
      const letras = m[1] ?? '';
      const resto = m[2] ?? '';
      const r = corregirPlaca(letras, resto);
      if (!r) continue;
      const base = r.corregida ? BASE_ETIQUETADO - CASTIGO_CORRECCION : BASE_ETIQUETADO;
      return { valor: r.placa, ini: m.index, fin: m.index + m[0].length, base };
    }
  }
  // Sin etiqueta solo se aceptan mayúsculas exactas, y quedan dudosas.
  for (const m of todas(/\b([A-Z]{3})[ -]?(\d{3}|\d{2}[A-Z])\b/g, original)) {
    const placa = `${m[1] ?? ''}${m[2] ?? ''}`;
    if (Comparendo.esPlacaValida(placa)) {
      return { valor: placa, ini: m.index, fin: m.index + m[0].length, base: BASE_SIN_ETIQUETA };
    }
  }
  return null;
}

// --- Código de infracción --------------------------------------------------------

function buscarCodigo(original: string, plano: string): Candidato | null {
  for (const etiqueta of todas(/\b(?:codigo|cod)\b\.?|\binfraccion\b/g, plano)) {
    const desde = etiqueta.index + etiqueta[0].length;
    const hasta = Math.min(plano.length, desde + VENTANA_ETIQUETA);
    for (const m of todas(/\b([a-h])\s?[.-]?\s?([\do]{1,2})(?:\.?([a-z]))?\b/g, plano, desde, hasta)) {
      const digitos = m[2] ?? '';
      const valor = CatalogoInfracciones.normalizarCodigo(`${m[1] ?? ''}${digitos}${m[3] ?? ''}`);
      if (valor === null) continue;
      const base = /o/.test(digitos) ? BASE_ETIQUETADO - CASTIGO_CORRECCION : BASE_ETIQUETADO;
      return { valor, ini: m.index, fin: m.index + m[0].length, base };
    }
  }
  for (const m of todas(/\b([A-H])\s?[.-]?\s?(\d{2})\b/g, original)) {
    const valor = CatalogoInfracciones.normalizarCodigo(`${m[1] ?? ''}${m[2] ?? ''}`);
    if (valor !== null) return { valor, ini: m.index, fin: m.index + m[0].length, base: BASE_SIN_ETIQUETA };
  }
  return null;
}

// --- Tipo de comparendo ------------------------------------------------------------

function buscarTipo(plano: string): Candidato | null {
  for (const m of todas(/foto\s?-?\s?deteccion|electronic[ao]/g, plano)) {
    // "correo electrónico" es un dato de contacto, no el tipo de comparendo.
    if (/correo\s*$/.test(plano.slice(Math.max(0, m.index - 10), m.index))) continue;
    return { valor: 'fotodeteccion', ini: m.index, fin: m.index + m[0].length, base: BASE_ETIQUETADO };
  }
  return null;
}
