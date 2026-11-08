import { obtenerBaseNormativa } from '../../../src/core/cargarDatos';
import { parsearSalida, ProveedorLLM, type FuncionFetch } from '../../../src/core/ProveedorLLM';

const PREGUNTA = '¿Puedo grabar al policía con el celular?';

function fetchFalso(contenido: string | (() => Promise<never>), registro?: { url?: string; cuerpo?: string; cabeceras?: Record<string, string> }): FuncionFetch {
  return async (url, init) => {
    if (registro) {
      registro.url = url;
      registro.cuerpo = init.body;
      registro.cabeceras = init.headers;
    }
    if (typeof contenido === 'function') return contenido();
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: contenido } }] }) };
  };
}

describe('ProveedorLLM', () => {
  const base = obtenerBaseNormativa();
  const config = { baseUrl: 'https://llm.example.test', modelo: 'modelo-prueba', apiKey: 'clave-falsa', timeoutMs: 50 };

  it('no se activa sin LLM_BASE_URL o sin LLM_MODELO', () => {
    expect(ProveedorLLM.configDesdeEntorno({})).toBeNull();
    expect(ProveedorLLM.configDesdeEntorno({ LLM_BASE_URL: 'https://x.test' })).toBeNull();
    expect(ProveedorLLM.configDesdeEntorno({ LLM_BASE_URL: 'https://x.test', LLM_MODELO: 'm' })).toEqual({
      baseUrl: 'https://x.test',
      modelo: 'm',
      apiKey: undefined,
      timeoutMs: undefined,
    });
  });

  it('arma la URL de /v1/chat/completions', () => {
    expect(ProveedorLLM.urlCompletions('https://x.test/')).toBe('https://x.test/v1/chat/completions');
    expect(ProveedorLLM.urlCompletions('https://x.test/v1')).toBe('https://x.test/v1/chat/completions');
  });

  it('recupera el art. 21 de la Ley 1801 para una pregunta sobre grabar', () => {
    const proveedor = new ProveedorLLM(base, config, fetchFalso('{}'));
    expect(proveedor.recuperar(PREGUNTA).map((f) => f.entradaId)).toContain('L1801-2016-art21');
  });

  it('acepta una cita que está entre los fragmentos recuperados', async () => {
    const registro: { url?: string; cuerpo?: string; cabeceras?: Record<string, string> } = {};
    const proveedor = new ProveedorLLM(
      base,
      config,
      fetchFalso(JSON.stringify({ respuesta: 'Sí, puedes grabar.', citas: ['L1801-2016-art21#1'] }), registro),
    );
    const r = await proveedor.responder(PREGUNTA);
    expect(r.tipo).toBe('respuesta');
    expect(r.modo).toBe('llm');
    expect(r.texto).toBe('Sí, puedes grabar.');
    expect(r.citas.map((c) => c.id)).toEqual(['L1801-2016-art21']);
    expect(registro.url).toBe('https://llm.example.test/v1/chat/completions');
    expect(registro.cabeceras?.Authorization).toBe('Bearer clave-falsa');
    expect(registro.cuerpo).toContain('L1801-2016-art21#1');
  });

  it('acepta también el id de la entrada y el JSON dentro de un bloque de código', async () => {
    const contenido = '```json\n{"respuesta": "Sí.", "citas": ["L1801-2016-art21"]}\n```';
    const r = await new ProveedorLLM(base, config, fetchFalso(contenido)).responder(PREGUNTA);
    expect(r.tipo).toBe('respuesta');
  });

  it('se abstiene si una cita es inventada', async () => {
    const contenido = JSON.stringify({ respuesta: 'Sí.', citas: ['L1801-2016-art21#1', 'L9999-2030-art1'] });
    const r = await new ProveedorLLM(base, config, fetchFalso(contenido)).responder(PREGUNTA);
    expect(r.tipo).toBe('abstencion');
    expect(r.citas).toEqual([]);
  });

  it('se abstiene si cita una entrada real que no estaba entre los fragmentos recuperados', async () => {
    const contenido = JSON.stringify({ respuesta: 'Sí.', citas: ['L1581-2012-art3'] });
    const r = await new ProveedorLLM(base, config, fetchFalso(contenido)).responder(PREGUNTA);
    expect(r.tipo).toBe('abstencion');
  });

  it('se abstiene si el JSON está roto o viene sin citas', async () => {
    for (const contenido of ['{respuesta: "Sí"', JSON.stringify({ respuesta: 'Sí.', citas: [] }), JSON.stringify({ respuesta: '', citas: [] })]) {
      const r = await new ProveedorLLM(base, config, fetchFalso(contenido)).responder(PREGUNTA);
      expect(r.tipo).toBe('abstencion');
    }
  });

  it('se abstiene si se agota el tiempo', async () => {
    const nunca = () => new Promise<never>(() => undefined);
    const inicio = Date.now();
    const r = await new ProveedorLLM(base, config, fetchFalso(nunca)).responder(PREGUNTA);
    expect(r.tipo).toBe('abstencion');
    expect(Date.now() - inicio).toBeLessThan(2000);
  });

  it('se abstiene si el servidor responde con error o fetch falla', async () => {
    const conError: FuncionFetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
    expect((await new ProveedorLLM(base, config, conError).responder(PREGUNTA)).tipo).toBe('abstencion');
    const falla: FuncionFetch = async () => {
      throw new Error('sin red');
    };
    expect((await new ProveedorLLM(base, config, falla).responder(PREGUNTA)).tipo).toBe('abstencion');
  });

  it('parsearSalida exige respuesta y citas de texto', () => {
    expect(parsearSalida('{"respuesta":"a","citas":["x"]}')).toEqual({ respuesta: 'a', citas: ['x'] });
    expect(parsearSalida('{"respuesta":"a","citas":[1]}')).toBeNull();
    expect(parsearSalida('null')).toBeNull();
  });
});
