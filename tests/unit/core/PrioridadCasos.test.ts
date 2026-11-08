import parametrosReales from '../../../data/normativa/parametros.json';
import { Caso } from '../../../src/core/Caso';
import { Comparendo } from '../../../src/core/Comparendo';
import { FechaCivil } from '../../../src/core/FechaCivil';
import type { ParametrosJSON } from '../../../src/core/ParametrosPlazos';
import { PrioridadCasos } from '../../../src/core/PrioridadCasos';
import { ServicioPlazos } from '../../../src/services/ServicioPlazos';

const f = (iso: string) => FechaCivil.desdeISO(iso);
const reloj = (iso: string) => () => new Date(`${iso}T12:00:00-05:00`);

function comparendo(numero: string, fecha: string): Comparendo {
  return Comparendo.crear({ numero, fecha: f(fecha), codigoInfraccion: 'C02', tipo: 'via' });
}

function caso(id: string, c: Comparendo | null, creadoEn: string, estado: 'abierto' | 'cerrado' = 'abierto'): Caso {
  return Caso.crear({ id, creadoEn, ubicacion: null, motivoSinUbicacion: 'no_disponible', comparendo: c, estado });
}

describe('PrioridadCasos (CA-14.1)', () => {
  // Hoy: lunes 23 de noviembre de 2026. Un comparendo en vía vence 5 días hábiles después.
  const servicio = ServicioPlazos.crear({ reloj: reloj('2026-11-23'), parametros: parametrosReales as unknown as ParametrosJSON });
  const prioridad = new PrioridadCasos((c) => {
    const estado = servicio.estadoDeCaso(c);
    return estado ? { fechaLimite: estado.resultado.fechaLimite, vencido: estado.restantes.vencido } : null;
  });

  const lejano = caso('lejano', comparendo('990000100001', '2026-11-20'), '2026-11-20T15:00:00.000Z');
  const proximo = caso('proximo', comparendo('990000100002', '2026-11-18'), '2026-11-18T15:00:00.000Z');
  const sinComparendo = caso('sin', null, '2026-11-22T15:00:00.000Z');
  const vencidoViejo = caso('vencido-viejo', comparendo('990000100003', '2026-10-01'), '2026-10-01T15:00:00.000Z');
  const vencidoReciente = caso('vencido-reciente', comparendo('990000100004', '2026-11-05'), '2026-11-05T15:00:00.000Z');
  const cerrado = caso('cerrado', comparendo('990000100005', '2026-11-19'), '2026-11-23T15:00:00.000Z', 'cerrado');

  test('el plazo mas proximo va primero, luego sin comparendo, vencidos y cerrados', () => {
    const orden = prioridad.ordenar([cerrado, vencidoViejo, lejano, sinComparendo, vencidoReciente, proximo]).map((c) => c.id);
    expect(orden).toEqual(['proximo', 'lejano', 'sin', 'vencido-reciente', 'vencido-viejo', 'cerrado']);
  });

  test('no cambia la lista original', () => {
    const lista = [lejano, proximo];
    prioridad.ordenar(lista);
    expect(lista.map((c) => c.id)).toEqual(['lejano', 'proximo']);
  });

  test('con el mismo plazo, el caso mas reciente va primero', () => {
    const a = caso('a', comparendo('990000200001', '2026-11-20'), '2026-11-20T10:00:00.000Z');
    const b = caso('b', comparendo('990000200002', '2026-11-20'), '2026-11-20T18:00:00.000Z');
    expect(prioridad.ordenar([a, b]).map((c) => c.id)).toEqual(['b', 'a']);
  });

  test('si el plazo no se puede calcular, el caso cuenta como sin plazo', () => {
    const conError = new PrioridadCasos((c) => {
      if (c.id === 'lejano') throw new Error('parametro no verificado');
      return null;
    });
    expect(conError.grupo(lejano, null)).toBe(1);
    expect(conError.ordenar([cerrado, lejano]).map((c) => c.id)).toEqual(['lejano', 'cerrado']);
  });
});
