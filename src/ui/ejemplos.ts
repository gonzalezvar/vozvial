// DATOS SIMULADOS del diseno rapido (fase 1). No son normas ni casos reales.
// La fase de construccion reemplaza cada uso por datos de src/core y de la base normativa verificada.

import type { DatosCita } from './TarjetaCita';
import type { TonoEstado } from './EtiquetaEstado';

export const NOMBRE_EJEMPLO = 'Ana';

/** Cita de muestra para ver el diseno de la tarjeta. No contiene texto de ninguna norma. */
export const CITA_EJEMPLO: DatosCita = {
  id: 'EJEMPLO-1',
  norma: 'Norma de ejemplo',
  articulo: '0',
  titulo: 'Título del artículo (ejemplo)',
  textoLiteral:
    'Aquí va el texto literal del artículo, copiado de la fuente oficial. En este ejemplo no hay texto de ninguna norma.',
  urlFuente: '',
  fechaConsulta: '2026-11-08',
};

export interface CasoEjemplo {
  id: string;
  titulo: string;
  fecha: string;
  estado: string;
  tono: TonoEstado;
  plazo: string;
}

/** Ordenados de mas urgente a menos urgente, como pide CA-14.1. */
export const CASOS_EJEMPLO: readonly CasoEjemplo[] = [
  {
    id: 'ejemplo-1',
    titulo: 'Caso de ejemplo 1',
    fecha: 'viernes 13 de noviembre de 2026, 8:15 a. m.',
    estado: 'Plazo por vencer',
    tono: 'urgente',
    plazo: 'Te quedan 2 días hábiles (ejemplo)',
  },
  {
    id: 'ejemplo-2',
    titulo: 'Caso de ejemplo 2',
    fecha: 'lunes 2 de noviembre de 2026, 5:40 p. m.',
    estado: 'Con comparendo',
    tono: 'aviso',
    plazo: 'Te quedan 6 días hábiles (ejemplo)',
  },
  {
    id: 'ejemplo-3',
    titulo: 'Caso de ejemplo 3',
    fecha: 'martes 6 de octubre de 2026, 10:05 a. m.',
    estado: 'Plazo vencido',
    tono: 'vencido',
    plazo: 'El plazo venció el 14 de octubre de 2026 (ejemplo)',
  },
];

export const CODIGO_RECUPERACION_EJEMPLO = 'ABCD EFGH JKMN';
