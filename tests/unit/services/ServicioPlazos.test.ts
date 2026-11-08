import parametrosReales from '../../../data/normativa/parametros.json';
import { Caso } from '../../../src/core/Caso';
import { Comparendo } from '../../../src/core/Comparendo';
import { FechaCivil } from '../../../src/core/FechaCivil';
import { ErrorParametroNoVerificado, type ParametrosJSON } from '../../../src/core/ParametrosPlazos';
import { ServicioPlazos } from '../../../src/services/ServicioPlazos';

const f = (iso: string) => FechaCivil.desdeISO(iso);
// Mediodía en Bogotá para que el día no cambie por el huso horario.
const reloj = (iso: string) => () => new Date(`${iso}T12:00:00-05:00`);

const enVia = Comparendo.crear({ numero: '99000012345678', fecha: f('2026-11-13'), codigoInfraccion: 'C02', tipo: 'via' });
const foto = Comparendo.crear({
  numero: '99000012345679',
  fecha: f('2026-11-05'),
  codigoInfraccion: 'C29',
  tipo: 'fotodeteccion',
  fechaNotificacion: f('2026-11-13'),
});

function caso(id: string, comparendo: Comparendo | null, estado: 'abierto' | 'cerrado' = 'abierto'): Caso {
  return Caso.crear({
    id,
    creadoEn: '2026-11-13T15:00:00.000Z',
    ubicacion: null,
    motivoSinUbicacion: 'no_disponible',
    comparendo,
    estado,
  });
}

describe('ServicioPlazos con data/normativa/parametros.json', () => {
  test('CA-11.1 vía del viernes 13 nov 2026: vence el lunes 23 nov (16 nov festivo)', () => {
    const r = ServicioPlazos.crear({ reloj: reloj('2026-11-13') }).calcular(enVia);
    expect(r.fechaLimite.aISO()).toBe('2026-11-23');
    expect(r.diasHabiles).toBe(5);
    expect(r.festivosOmitidos.map((x) => x.fecha.aISO())).toContain('2026-11-16');
    expect(r.sustento).toContain('L769-2002-art135');
  });

  test('CA-11.2 y CA-11.3 fotodetección notificada el 13 nov 2026: vence el martes 1 dic y usa la notificación', () => {
    const r = ServicioPlazos.crear({ reloj: reloj('2026-11-13') }).calcular(foto);
    expect(r.fechaLimite.aISO()).toBe('2026-12-01');
    expect(r.fechaBase.aISO()).toBe('2026-11-13');
    expect(r.explicacion).toContain('usamos la fecha en que recibiste la notificación');
    expect(r.sustento).toContain('L1843-2017-art8');
  });

  test('CA-11.4 días restantes y vencido', () => {
    expect(ServicioPlazos.crear({ reloj: reloj('2026-11-13') }).estado(enVia).mensaje).toBe('Te quedan 5 días hábiles.');
    expect(ServicioPlazos.crear({ reloj: reloj('2026-11-20') }).estado(enVia).mensaje).toBe('Te queda 1 día hábil.');
    const vencido = ServicioPlazos.crear({ reloj: reloj('2026-11-24') }).estado(enVia);
    expect(vencido.nivel).toBe('vencido');
    expect(vencido.mensaje).toBe('El plazo venció el lunes 23 de noviembre de 2026.');
  });

  test('niveles: urgente con 2 días hábiles o menos, hoy el día límite', () => {
    expect(ServicioPlazos.crear({ reloj: reloj('2026-11-18') }).estado(enVia).nivel).toBe('en_tiempo');
    const urgente = ServicioPlazos.crear({ reloj: reloj('2026-11-19') }).estado(enVia);
    expect(urgente.nivel).toBe('urgente');
    expect(urgente.restantes.dias).toBe(2);
    // Sábado 21: solo queda el lunes 23.
    expect(ServicioPlazos.crear({ reloj: reloj('2026-11-21') }).estado(enVia).restantes.dias).toBe(1);
    const hoy = ServicioPlazos.crear({ reloj: reloj('2026-11-23') }).estado(enVia);
    expect(hoy.nivel).toBe('hoy');
    expect(hoy.mensaje).toBe('Hoy vence tu plazo para presentarte ante la autoridad de tránsito.');
  });

  test('CA-12.1 y CA-12.2 alertas: solo casos abiertos con plazo cercano, el de hoy primero', () => {
    const servicio = ServicioPlazos.crear({ reloj: reloj('2026-11-23') });
    const otroVia = Comparendo.crear({ numero: '123456789', fecha: f('2026-11-20'), codigoInfraccion: 'C02', tipo: 'via' });
    const alertas = servicio.alertas([
      caso('lejano', foto),
      caso('sin-comparendo', null),
      caso('cerrado', enVia, 'cerrado'),
      caso('hoy', enVia),
      caso('pronto', otroVia),
    ]);
    // otroVia (20 nov) vence el viernes 27 nov: el 23 quedan 4 días, no avisa. foto vence el 1 dic.
    expect(alertas.map((a) => a.casoId)).toEqual(['hoy']);
    expect(alertas[0]?.estado.nivel).toBe('hoy');

    const antes = ServicioPlazos.crear({ reloj: reloj('2026-11-19') }).alertas([caso('a', enVia), caso('b', foto)]);
    expect(antes.map((a) => a.casoId)).toEqual(['a']);
  });

  test('estadoDeCaso devuelve null sin comparendo', () => {
    expect(ServicioPlazos.crear().estadoDeCaso(caso('x', null))).toBeNull();
  });

  test('no calcula con un parámetro de plazo sin verificar', () => {
    const json = JSON.parse(JSON.stringify(parametrosReales)) as ParametrosJSON;
    const via = json.parametros.find((p) => p.id === 'dias_habiles_via');
    if (via) via.verificado = false;
    expect(() => ServicioPlazos.crear({ parametros: json })).toThrow(ErrorParametroNoVerificado);
  });
});
