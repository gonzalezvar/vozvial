import { existsSync } from 'node:fs';
import path from 'node:path';

import { NOMBRES_ICONOS } from '../../../src/ui/iconos';
import {
  AYUDA_PANTALLAS,
  buscarGuia,
  GUIAS_SITUACION,
  PASOS_RECORRIDO,
  pasosParaEscuchar,
  textoParaEscuchar,
  type IdPantallaAyuda,
} from '../../../src/ui/guia/contenidoGuia';
import { RecorridoGuia } from '../../../src/ui/guia/RecorridoGuia';

const RAIZ = path.join(__dirname, '..', '..', '..');

/** Una ruta de Expo Router existe si hay un archivo en (app) o (publico), directo o como index. */
function existeRuta(ruta: string): boolean {
  const limpia = ruta.split('?')[0]!.replace(/^\//, '');
  return ['(app)', '(publico)'].some((grupo) =>
    [`${limpia}.tsx`, path.join(limpia, 'index.tsx')].some((archivo) => existsSync(path.join(RAIZ, 'app', grupo, archivo))),
  );
}

function frases(texto: string): string[] {
  return texto.split(/(?<=[.!?])\s+/).filter(Boolean);
}

const TODOS_LOS_TEXTOS = [
  ...PASOS_RECORRIDO.flatMap((p) => [p.titulo, ...p.frases]),
  ...GUIAS_SITUACION.flatMap((g) => [g.titulo, g.resumen, ...g.pasos, ...g.acciones.flatMap((a) => [a.etiqueta, a.descripcion ?? ''])]),
  ...Object.values(AYUDA_PANTALLAS).flatMap((a) => [a.titulo, ...a.frases]),
];

describe('contenido de la guia', () => {
  test('el recorrido tiene 4 o 5 pasos con icono valido y 2 o 3 frases cortas', () => {
    expect(PASOS_RECORRIDO.length).toBeGreaterThanOrEqual(4);
    expect(PASOS_RECORRIDO.length).toBeLessThanOrEqual(5);
    for (const paso of PASOS_RECORRIDO) {
      expect(NOMBRES_ICONOS).toContain(paso.icono);
      expect(paso.frases.length).toBeGreaterThanOrEqual(2);
      expect(paso.frases.length).toBeLessThanOrEqual(3);
      for (const f of paso.frases) expect(f.length).toBeLessThanOrEqual(110);
    }
  });

  test('el recorrido explica lo que pide la historia: que es, cifrado, Me pararon, preguntar y plazo', () => {
    const ids = PASOS_RECORRIDO.map((p) => p.id);
    expect(ids).toEqual(['que-es', 'cifrado', 'me-pararon', 'preguntar', 'comparendo']);
    const texto = PASOS_RECORRIDO.map((p) => [p.titulo, ...p.frases].join(' ')).join(' ');
    expect(texto).toMatch(/cifrad/);
    expect(texto).toMatch(/Me pararon/);
    expect(texto).toMatch(/Preguntar/);
    expect(texto).toMatch(/plazo/);
    expect(texto).toContain('No reemplaza a un abogado');
  });

  test('las guias por situacion son las cinco pedidas, con pasos y acciones a rutas que existen', () => {
    expect(GUIAS_SITUACION.map((g) => g.titulo)).toEqual([
      'Me paró un agente',
      'Me llegó una fotomulta',
      'Quiero pedir la audiencia',
      'Olvidé mi PIN',
      'Agrandar la letra',
    ]);
    const ids = new Set<string>();
    for (const g of GUIAS_SITUACION) {
      expect(ids.has(g.id)).toBe(false);
      ids.add(g.id);
      expect(NOMBRES_ICONOS).toContain(g.icono);
      expect(g.pasos.length).toBeGreaterThanOrEqual(3);
      expect(g.pasos.length).toBeLessThanOrEqual(6);
      expect(g.acciones.length).toBeGreaterThanOrEqual(1);
      for (const a of g.acciones) {
        expect(existeRuta(a.href)).toBe(true);
        expect(NOMBRES_ICONOS).toContain(a.icono);
        // WCAG 2.5.3: el nombre accesible contiene el texto visible.
        expect(a.accessibilityLabel).toContain(a.etiqueta);
      }
    }
  });

  test('las pantallas de la guia existen', () => {
    expect(existeRuta('/guia')).toBe(true);
    expect(existeRuta('/ayuda')).toBe(true);
  });

  test('cada pantalla tiene una ayuda de 2 a 4 frases', () => {
    const pantallas: IdPantallaAyuda[] = [
      'bienvenida',
      'registro',
      'entrar',
      'recuperar',
      'inicio',
      'asistente',
      'me-pararon',
      'casos',
      'caso',
      'comparendo',
      'solicitud',
      'ajustes',
    ];
    for (const id of pantallas) {
      const ayuda = AYUDA_PANTALLAS[id];
      expect(ayuda.titulo.length).toBeGreaterThan(0);
      const total = ayuda.frases.flatMap(frases).length;
      expect(total).toBeGreaterThanOrEqual(2);
      expect(total).toBeLessThanOrEqual(4);
    }
  });

  test('no hay afirmaciones legales sueltas: ni articulos, ni dias, ni pesos, ni promesas', () => {
    for (const texto of TODOS_LOS_TEXTOS) {
      expect(texto).not.toMatch(/art[ií]culo\s*\d|ley\s+\d|decreto|\b\d+\s+d[ií]as\b|\$\s*\d|salarios?\s+m[ií]nimos?/i);
      expect(texto).not.toMatch(/garantizad|seguro que ganas|vas a ganar/i);
    }
  });

  test('textos para escuchar', () => {
    expect(textoParaEscuchar('Título', ['Uno.', ' Dos. '])).toBe('Título Uno. Dos.');
    const guia = buscarGuia('olvide-pin')!;
    const lectura = pasosParaEscuchar(guia);
    expect(lectura.startsWith('Olvidé mi PIN.')).toBe(true);
    expect(lectura).toContain('Paso 1. ');
    expect(lectura).toContain(`Paso ${guia.pasos.length}. `);
  });

  test('buscarGuia devuelve null si no existe', () => {
    expect(buscarGuia(undefined)).toBeNull();
    expect(buscarGuia('')).toBeNull();
    expect(buscarGuia('no-existe')).toBeNull();
    expect(buscarGuia('agrandar-letra')?.titulo).toBe('Agrandar la letra');
  });
});

describe('RecorridoGuia', () => {
  test('avanza y retrocede sin salirse de los limites', () => {
    let r = RecorridoGuia.crear(5);
    expect(r.esPrimero).toBe(true);
    expect(r.textoProgreso).toBe('Paso 1 de 5');
    expect(r.atras()).toBe(r);
    for (let i = 0; i < 10; i++) r = r.siguiente();
    expect(r.esUltimo).toBe(true);
    expect(r.numero).toBe(5);
    expect(r.siguiente()).toBe(r);
    r = r.atras();
    expect(r.textoProgreso).toBe('Paso 4 de 5');
  });

  test('es inmutable', () => {
    const r = RecorridoGuia.crear(3);
    const s = r.siguiente();
    expect(r.indice).toBe(0);
    expect(s.indice).toBe(1);
  });

  test('lee el paso de la URL y descarta valores raros', () => {
    expect(RecorridoGuia.desdeParametro(5, '3').numero).toBe(3);
    expect(RecorridoGuia.desdeParametro(5, ['2', '4']).numero).toBe(2);
    expect(RecorridoGuia.desdeParametro(5, '99').numero).toBe(5);
    expect(RecorridoGuia.desdeParametro(5, '0').numero).toBe(1);
    expect(RecorridoGuia.desdeParametro(5, '-2').numero).toBe(1);
    expect(RecorridoGuia.desdeParametro(5, 'abc').numero).toBe(1);
    expect(RecorridoGuia.desdeParametro(5, undefined).numero).toBe(1);
  });

  test('un recorrido sin pasos no tiene sentido', () => {
    expect(() => RecorridoGuia.crear(0)).toThrow();
  });
});
