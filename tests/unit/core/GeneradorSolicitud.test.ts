import { Caso } from '../../../src/core/Caso';
import { Comparendo } from '../../../src/core/Comparendo';
import { Evidencia } from '../../../src/core/Evidencia';
import { FechaCivil } from '../../../src/core/FechaCivil';
import {
  AVISO_SOLICITUD,
  ErrorSolicitudIncompleta,
  GeneradorSolicitud,
  type NormaParaCitar,
} from '../../../src/core/GeneradorSolicitud';

const f = (iso: string) => FechaCivil.desdeISO(iso);

// Norma ficticia: el generador solo copia lo que recibe.
const normaPrueba: NormaParaCitar = {
  id: 'PRUEBA-art1',
  norma: 'Norma de prueba',
  articulo: '1',
  titulo: 'Artículo de prueba',
  urlFuente: 'https://ejemplo.test/norma',
};

function casoCompleto(): Caso {
  return Caso.crear({
    id: 'caso-1',
    creadoEn: '2026-11-13T20:40:00.000Z',
    ubicacion: null,
    motivoSinUbicacion: 'denegada',
    estado: 'abierto',
    conductor: {
      nombre: 'Persona de Prueba',
      cedula: '1000000001',
      celular: '3001234567',
      correo: 'persona@ejemplo.test',
      direccion: 'Calle de prueba 1',
      ciudad: 'Ciudad de Prueba',
    },
    comparendo: Comparendo.crear({
      numero: '99999000000012345678',
      fecha: f('2026-11-13'),
      placa: 'XYZ123',
      codigoInfraccion: 'C02',
      tipo: 'via',
      organismo: 'Organismo de Tránsito de Prueba',
    }),
    evidencias: [
      Evidencia.crear({ id: 'n1', tipo: 'nota', creadaEn: '2026-11-14T02:10:00Z', texto: 'Nota' }),
      Evidencia.crear({
        id: 'a1',
        tipo: 'audio',
        creadaEn: '2026-11-13T20:45:00Z',
        mime: 'audio/webm',
        tamano: 100,
      }),
      Evidencia.crear({ id: 'f1', tipo: 'foto', creadaEn: '2026-11-13T17:05:00Z', mime: 'image/jpeg', tamano: 100 }),
    ],
  });
}

describe('GeneradorSolicitud.faltantes', () => {
  const generador = new GeneradorSolicitud();

  it('un caso completo no tiene faltantes', () => {
    expect(generador.faltantes(casoCompleto())).toEqual([]);
  });

  it('dice qué falta con mensajes sencillos (CA-13.2)', () => {
    const caso = Caso.crear({ id: 'c', creadoEn: '2026-11-13T20:40:00Z', ubicacion: null, motivoSinUbicacion: 'denegada' });
    expect(generador.faltantes(caso)).toEqual([
      { campo: 'nombre', mensaje: 'Falta tu nombre completo.' },
      { campo: 'cedula', mensaje: 'Falta tu número de cédula.' },
      { campo: 'celular', mensaje: 'Falta tu número de celular.' },
      { campo: 'numeroComparendo', mensaje: 'Falta el número del comparendo.' },
      { campo: 'fechaComparendo', mensaje: 'Falta la fecha del comparendo.' },
      { campo: 'codigoInfraccion', mensaje: 'Falta el código de la infracción.' },
    ]);
  });

  it('solo pide la cédula cuando es lo único que falta', () => {
    const caso = casoCompleto();
    const sinCedula = Caso.crear({ ...caso.toJSON(), evidencias: [...caso.evidencias], comparendo: caso.comparendo, conductor: { ...caso.conductor, cedula: '' } });
    expect(generador.faltantes(sinCedula)).toEqual([{ campo: 'cedula', mensaje: 'Falta tu número de cédula.' }]);
  });

  it('pide la fecha de notificación si el formulario dice fotodetección', () => {
    const faltan = generador.faltantes({
      conductor: { nombre: 'Persona', cedula: '1.000.000.001', celular: '300 123 4567' },
      comparendo: { numero: '123456', fecha: f('2026-11-13'), codigoInfraccion: 'c.2', tipo: 'fotodeteccion' },
    });
    expect(faltan).toEqual([{ campo: 'fechaNotificacion', mensaje: 'Falta la fecha en que recibiste la notificación.' }]);
  });

  it('revisa el formato de cédula, celular, correo y código', () => {
    const faltan = generador.faltantes({
      conductor: { nombre: 'Persona', cedula: '12AB', celular: '2001234567', correo: 'sin-arroba' },
      comparendo: { numero: '123456', fecha: f('2026-11-13'), codigoInfraccion: 'Z99', tipo: 'via' },
    });
    expect(faltan.map((x) => x.campo)).toEqual(['cedula', 'celular', 'correo', 'codigoInfraccion']);
    expect(faltan[1]?.mensaje).toBe('Escribe tu celular de 10 dígitos, por ejemplo 3001234567');
  });
});

describe('GeneradorSolicitud.armarContenido', () => {
  const generador = new GeneradorSolicitud();
  const opciones = { normasCitadas: [normaPrueba], fechaElaboracion: f('2026-11-16') };

  it('arma la solicitud con datos del conductor, del comparendo, evidencias y normas recibidas', () => {
    const contenido = generador.armarContenido(casoCompleto(), {
      ...opciones,
      razones: 'No estaba estacionado.',
      descripcionInfraccion: 'Descripción de prueba',
    });
    expect(contenido.titulo).toBe(
      'Solicitud de audiencia pública de impugnación del comparendo No. 99999000000012345678',
    );
    expect(contenido.destinatario).toBe('Señores Organismo de Tránsito de Prueba');
    const texto = contenido.secciones.flatMap((s) => [s.titulo, ...s.parrafos]).join('\n');
    expect(texto).toContain('Ciudad de Prueba, lunes 16 de noviembre de 2026.');
    expect(texto).toContain('Mi nombre es Persona de Prueba.');
    expect(texto).toContain('Mi cédula de ciudadanía es la número 1000000001.');
    expect(texto).toContain('Fecha de la infracción: viernes 13 de noviembre de 2026.');
    expect(texto).toContain('Placa del vehículo: XYZ123.');
    expect(texto).toContain('Código de la infracción: C02 (Descripción de prueba).');
    expect(texto).toContain('Mis razones: No estaba estacionado.');
    expect(texto).toContain('las 3 pruebas');
    expect(texto).toContain('Correo: persona@ejemplo.test.');
    expect(contenido.secciones.at(-1)?.parrafos).toEqual(['Atentamente,', 'Persona de Prueba', 'C.C. 1000000001']);
    // Orden cronológico y hora de Colombia (UTC-5).
    expect(contenido.evidencias).toEqual([
      'Foto del viernes 13 de noviembre de 2026 a las 12:05 p. m.',
      'Audio del viernes 13 de noviembre de 2026 a las 3:45 p. m.',
      'Nota del viernes 13 de noviembre de 2026 a las 9:10 p. m.',
    ]);
    expect(contenido.normasCitadas).toEqual([
      { norma: 'Norma de prueba', articulo: '1', url: 'https://ejemplo.test/norma' },
    ]);
    expect(contenido.aviso).toBe(AVISO_SOLICITUD);
  });

  it('no cita normas que no recibe', () => {
    const contenido = generador.armarContenido(casoCompleto(), { ...opciones, normasCitadas: [] });
    expect(contenido.normasCitadas).toEqual([]);
    expect(contenido.secciones.map((s) => s.titulo)).not.toContain('Normas en que me baso');
  });

  it('usa un destinatario genérico y explica la fotodetección', () => {
    const base = casoCompleto();
    const caso = base.conComparendo(
      Comparendo.crear({
        numero: '123456',
        fecha: f('2026-11-13'),
        codigoInfraccion: 'C02',
        tipo: 'fotodeteccion',
        fechaNotificacion: f('2026-11-20'),
      }),
    );
    const contenido = generador.armarContenido(caso, opciones);
    expect(contenido.destinatario).toBe('Señores Organismo de tránsito que impuso el comparendo');
    const datos = contenido.secciones.find((s) => s.titulo === 'Datos del comparendo')?.parrafos ?? [];
    expect(datos).toContain('Fecha en que recibí la notificación: viernes 20 de noviembre de 2026.');
    expect(datos.some((p) => p.startsWith('Placa'))).toBe(false);
  });

  it('sin evidencias lo dice y la fecha empieza en mayúscula si no hay ciudad', () => {
    const caso = Caso.crear({
      id: 'c2',
      creadoEn: '2026-11-13T20:40:00Z',
      ubicacion: null,
      motivoSinUbicacion: 'no_disponible',
      conductor: { nombre: 'Persona', cedula: '123456', celular: '3001234567' },
      comparendo: casoCompleto().comparendo,
    });
    const contenido = generador.armarContenido(caso, opciones);
    expect(contenido.evidencias).toEqual([]);
    expect(contenido.secciones[0]?.parrafos).toEqual(['Lunes 16 de noviembre de 2026.']);
    expect(contenido.secciones.find((s) => s.titulo === 'Pruebas')?.parrafos[0]).toContain('no aporto pruebas');
  });

  it('no arma la solicitud si falta un dato obligatorio', () => {
    const caso = casoCompleto().conConductor({ cedula: '' });
    expect(() => generador.armarContenido(caso, opciones)).toThrow(ErrorSolicitudIncompleta);
    try {
      generador.armarContenido(caso, opciones);
    } catch (e) {
      expect((e as ErrorSolicitudIncompleta).faltantes).toEqual([
        { campo: 'cedula', mensaje: 'Falta tu número de cédula.' },
      ]);
    }
  });
});
