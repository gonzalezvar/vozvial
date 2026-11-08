import { AsistenteNormativo } from '../../../src/core/AsistenteNormativo';
import { BaseNormativa, type EntradaNormativaJSON } from '../../../src/core/BaseNormativa';
import { obtenerBaseNormativa, PREGUNTAS_VERIFICADAS } from '../../../src/core/cargarDatos';
import { DetectorTema } from '../../../src/core/DetectorTema';
import { AVISO_LEGAL, TEXTO_ABSTENCION } from '../../../src/core/ProveedorRespuesta';
import { ProveedorVerificado } from '../../../src/core/ProveedorVerificado';

describe('ProveedorVerificado con los datos reales', () => {
  const base = obtenerBaseNormativa();
  const proveedor = new ProveedorVerificado(PREGUNTAS_VERIFICADAS, base);
  const asistente = new AsistenteNormativo(proveedor, new DetectorTema());
  const pv = (id: string) => PREGUNTAS_VERIFICADAS.preguntas.find((p) => p.id === id)!;

  it('indexa todas las preguntas verificadas (todas citan entradas verificadas)', () => {
    expect(proveedor.preguntasDescartadas()).toEqual([]);
    expect(proveedor.totalPreguntas()).toBe(PREGUNTAS_VERIFICADAS.preguntas.length);
  });

  it('responde una pregunta conocida con su respuesta sencilla y la cita completa', async () => {
    const r = await asistente.responder(pv('PV-002').pregunta);
    expect(r.tipo).toBe('respuesta');
    expect(r.texto).toBe(pv('PV-002').respuesta_sencilla);
    expect(r.citas.map((c) => c.id)).toEqual(['L1801-2016-art21']);
    const cita = r.citas[0]!;
    expect(cita.textoLiteral.length).toBeGreaterThan(0);
    expect(cita.urlFuente).toMatch(/^https?:\/\//);
    expect(cita.fechaConsulta).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.modo).toBe('verificado');
    expect(r.aviso).toBe(AVISO_LEGAL);
  });

  it('responde una variante con la misma respuesta y cita', async () => {
    const variante = pv('PV-010').variantes[0]!;
    const r = await asistente.responder(variante);
    expect(r.tipo).toBe('respuesta');
    expect(r.citas.map((c) => c.id)).toContain('L1843-2017-art8');
  });

  it('se abstiene en un tema de tránsito que la base no cubre', async () => {
    const r = await asistente.responder('¿Cuánto cuesta renovar la matrícula de una moto en Cali?');
    expect(r.tipo).toBe('abstencion');
    expect(r.texto).toBe(TEXTO_ABSTENCION);
    expect(r.citas).toEqual([]);
    expect(r.sugerencia).toMatch(/SIMIT/);
    expect(r.sugerencia).toMatch(/consultorio jurídico/);
  });

  it('"receta de arepas" queda fuera de tema', async () => {
    const r = await asistente.responder('receta de arepas');
    expect(r.tipo).toBe('fuera_de_tema');
    expect(r.citas).toEqual([]);
    expect(r.texto).toMatch(/comparendos/);
  });

  it('el 100 % de las respuestas tipo "respuesta" lleva al menos una cita', async () => {
    let respuestas = 0;
    for (const p of PREGUNTAS_VERIFICADAS.preguntas) {
      for (const texto of [p.pregunta, ...p.variantes, `${p.pregunta} por favor`]) {
        const r = await asistente.responder(texto);
        if (r.tipo === 'respuesta') {
          respuestas++;
          expect(r.citas.length).toBeGreaterThan(0);
          for (const c of r.citas) expect(base.porId(c.id)).not.toBeNull();
        }
      }
    }
    expect(respuestas).toBeGreaterThan(PREGUNTAS_VERIFICADAS.preguntas.length);
  });

  it('cada pregunta verificada dicha tal cual responde con sus propias citas', async () => {
    for (const p of PREGUNTAS_VERIFICADAS.preguntas) {
      const r = await asistente.responder(p.pregunta);
      expect({ id: p.id, tipo: r.tipo }).toEqual({ id: p.id, tipo: 'respuesta' });
      expect(r.citas.some((c) => p.citas.includes(c.id))).toBe(true);
    }
  });

  it('es determinista', async () => {
    const pregunta = '¿me pueden quitar el carro?';
    const a = await proveedor.responder(pregunta);
    const b = await proveedor.responder(pregunta);
    expect(a).toEqual(b);
  });
});

describe('ProveedorVerificado con datos de prueba', () => {
  const entradas: EntradaNormativaJSON[] = [
    {
      id: 'X-art1',
      norma: 'Ley de prueba',
      articulo: '1',
      titulo: 'Grabación',
      texto_literal: 'Toda persona puede grabar.',
      modificado_por: [],
      resumen_sencillo: '',
      url_fuente: 'https://example.org/ley',
      fecha_consulta: '2026-11-08',
      temas: [],
      verificado: true,
      verificado_por: 'Equipo',
      notas: '',
    },
    {
      id: 'X-art2',
      norma: 'Ley de prueba',
      articulo: '2',
      titulo: 'Sin verificar',
      texto_literal: 'Texto dudoso.',
      modificado_por: [],
      resumen_sencillo: '',
      url_fuente: 'https://example.org/ley',
      fecha_consulta: '2026-11-08',
      temas: [],
      verificado: false,
      verificado_por: '',
      notas: '',
    },
  ];
  const base = new BaseNormativa(entradas);

  it('descarta preguntas que solo citan entradas no verificadas y nunca las responde', async () => {
    const proveedor = new ProveedorVerificado(
      {
        preguntas: [
          { id: 'P1', pregunta: '¿Puedo grabar al agente?', variantes: [], respuesta_sencilla: 'Sí.', citas: ['X-art1'], temas: [] },
          { id: 'P2', pregunta: '¿Texto dudoso del agente?', variantes: [], respuesta_sencilla: 'Dudoso.', citas: ['X-art2'], temas: [] },
        ],
      },
      base,
    );
    expect(proveedor.preguntasDescartadas()).toEqual(['P2']);
    expect((await proveedor.responder('¿Puedo grabar al agente?')).tipo).toBe('respuesta');
    expect((await proveedor.responder('¿Texto dudoso del agente?')).tipo).toBe('abstencion');
  });

  it('respeta el umbral', async () => {
    const json = {
      preguntas: [
        { id: 'P1', pregunta: 'grabar agente calle noche', variantes: [], respuesta_sencilla: 'Sí.', citas: ['X-art1'], temas: [] },
      ],
    };
    const estricto = new ProveedorVerificado(json, base, { umbral: 0.99 });
    const laxo = new ProveedorVerificado(json, base, { umbral: 0.1 });
    expect((await estricto.responder('grabar agente')).tipo).toBe('abstencion');
    expect((await laxo.responder('grabar agente')).tipo).toBe('respuesta');
  });
});
