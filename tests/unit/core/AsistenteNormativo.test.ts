import { AsistenteNormativo } from '../../../src/core/AsistenteNormativo';
import { crearAsistente, obtenerBaseNormativa } from '../../../src/core/cargarDatos';
import { DetectorTema } from '../../../src/core/DetectorTema';
import { AVISO_LEGAL, type ProveedorRespuesta, type RespuestaAsistente } from '../../../src/core/ProveedorRespuesta';

function proveedorFijo(respuesta: Partial<RespuestaAsistente> | Error): ProveedorRespuesta & { llamadas: number } {
  return {
    modo: 'verificado',
    llamadas: 0,
    async responder() {
      this.llamadas++;
      if (respuesta instanceof Error) throw respuesta;
      return { tipo: 'respuesta', texto: 'x', citas: [], puntaje: 1, modo: 'verificado', aviso: AVISO_LEGAL, ...respuesta };
    },
  };
}

describe('AsistenteNormativo', () => {
  it('no llama al proveedor si la pregunta está fuera de tema', async () => {
    const proveedor = proveedorFijo({});
    const r = await new AsistenteNormativo(proveedor).responder('¿Cómo hago una torta de chocolate?');
    expect(r.tipo).toBe('fuera_de_tema');
    expect(proveedor.llamadas).toBe(0);
    expect(r.aviso).toBe(AVISO_LEGAL);
  });

  it('convierte en abstención una respuesta sin citas', async () => {
    const r = await new AsistenteNormativo(proveedorFijo({ citas: [] })).responder('me pusieron un comparendo');
    expect(r.tipo).toBe('abstencion');
  });

  it('convierte en abstención un fallo del proveedor', async () => {
    const r = await new AsistenteNormativo(proveedorFijo(new Error('x'))).responder('me pusieron un comparendo');
    expect(r.tipo).toBe('abstencion');
    expect(r.aviso).toBe(AVISO_LEGAL);
  });

  it('con base, convierte en abstención una cita que no está en la base o que trae otro texto', async () => {
    const base = obtenerBaseNormativa();
    const real = base.cita('L769-2002-art136');
    expect(real).not.toBeNull();
    const pregunta = 'me pusieron un comparendo';
    const inventada = { ...real!, id: 'L769-2002-art9999' };
    const alterada = { ...real!, textoLiteral: 'Texto que no dice la ley.' };
    for (const cita of [inventada, alterada]) {
      const r = await new AsistenteNormativo(proveedorFijo({ citas: [cita] }), new DetectorTema(), base).responder(pregunta);
      expect(r.tipo).toBe('abstencion');
      expect(r.citas).toEqual([]);
    }
    const ok = await new AsistenteNormativo(proveedorFijo({ citas: [real!] }), new DetectorTema(), base).responder(pregunta);
    expect(ok.tipo).toBe('respuesta');
  });

  it('sin base, rechaza una cita sin texto literal o sin fuente', async () => {
    const real = obtenerBaseNormativa().cita('L769-2002-art136')!;
    const r = await new AsistenteNormativo(proveedorFijo({ citas: [{ ...real, textoLiteral: ' ' }] })).responder('me pusieron un comparendo');
    expect(r.tipo).toBe('abstencion');
  });

  it('una pregunta vacía es abstención', async () => {
    expect((await new AsistenteNormativo(proveedorFijo({})).responder('   ')).tipo).toBe('abstencion');
  });

  it('por defecto usa el modo verificado aunque haya fetch, si no hay LLM_BASE_URL', () => {
    const fetchFalso = jest.fn();
    expect(crearAsistente({ env: {}, fetch: fetchFalso }).modo).toBe('verificado');
    expect(crearAsistente({ env: { LLM_BASE_URL: 'https://x.test' }, fetch: fetchFalso }).modo).toBe('verificado');
    expect(crearAsistente({ env: { LLM_BASE_URL: 'https://x.test', LLM_MODELO: 'm' }, fetch: fetchFalso }).modo).toBe('llm');
    expect(fetchFalso).not.toHaveBeenCalled();
  });
});
