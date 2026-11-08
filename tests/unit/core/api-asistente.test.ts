import handler, { crearHandler, validarCuerpo } from '../../../api/asistente';
import type { AsistenteNormativo } from '../../../src/core/AsistenteNormativo';
import { AVISO_LEGAL, type RespuestaAsistente } from '../../../src/core/ProveedorRespuesta';

interface ResFalsa {
  estado: number;
  cabeceras: Record<string, string>;
  cuerpo: unknown;
  setHeader(nombre: string, valor: string): ResFalsa;
  status(codigo: number): ResFalsa;
  json(cuerpo: unknown): ResFalsa;
}

function resFalsa(): ResFalsa {
  const res: ResFalsa = {
    estado: 200,
    cabeceras: {},
    cuerpo: undefined,
    setHeader(nombre, valor) {
      res.cabeceras[nombre.toLowerCase()] = valor;
      return res;
    },
    status(codigo) {
      res.estado = codigo;
      return res;
    },
    json(cuerpo) {
      res.cuerpo = cuerpo;
      return res;
    },
  };
  return res;
}

// El handler real usa la firma de Vercel; para la prueba basta con estos campos.
const llamar = async (req: { method: string; body?: unknown }) => {
  const res = resFalsa();
  await handler(req as never, res as never);
  return res;
};

describe('api/asistente', () => {
  it('responde 405 a métodos distintos de POST', async () => {
    const res = await llamar({ method: 'GET' });
    expect(res.estado).toBe(405);
    expect(res.cabeceras.allow).toBe('POST');
    expect(res.cabeceras['cache-control']).toBe('no-store');
  });

  it('responde 400 si falta la pregunta, viene vacía o es muy larga', async () => {
    for (const body of [undefined, {}, { pregunta: '' }, { pregunta: '   ' }, { pregunta: 5 }, { pregunta: 'a'.repeat(501) }, [1]]) {
      const res = await llamar({ method: 'POST', body });
      expect(res.estado).toBe(400);
      expect(res.cabeceras['cache-control']).toBe('no-store');
    }
  });

  it('responde 400 si llega cualquier campo además de la pregunta', async () => {
    const res = await llamar({ method: 'POST', body: { pregunta: '¿Qué es un comparendo?', nombre: 'Ana', ubicacion: '4.6,-74' } });
    expect(res.estado).toBe(400);
    expect(res.cuerpo).toMatchObject({ error: 'campos_no_permitidos' });
  });

  it('responde 200 con una RespuestaAsistente y no-store', async () => {
    const res = await llamar({ method: 'POST', body: { pregunta: '¿Qué es un comparendo?' } });
    expect(res.estado).toBe(200);
    expect(res.cabeceras['cache-control']).toBe('no-store');
    const r = res.cuerpo as RespuestaAsistente;
    expect(r.tipo).toBe('respuesta');
    expect(r.citas.length).toBeGreaterThan(0);
    expect(r.aviso).toBe(AVISO_LEGAL);
    expect(r.modo).toBe('verificado');
  });

  it('acepta el cuerpo como texto JSON y una pregunta de 500 caracteres', async () => {
    expect(validarCuerpo('{"pregunta":"hola"}')).toEqual({ pregunta: 'hola' });
    expect(validarCuerpo('{roto')).toMatchObject({ error: 'json_invalido' });
    expect(validarCuerpo({ pregunta: 'a'.repeat(500) })).toEqual({ pregunta: 'a'.repeat(500) });
  });

  it('no escribe la pregunta en los logs y responde 500 sin detalles si el asistente falla', async () => {
    const espias = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => jest.spyOn(console, m).mockImplementation(() => undefined));
    const secreto = 'Mi placa es ABC123 y vivo en la calle 10';
    const ok = await llamar({ method: 'POST', body: { pregunta: secreto } });
    expect(ok.estado).toBe(200);

    const roto = crearHandler(() => ({ responder: async () => { throw new Error(secreto); } }) as unknown as AsistenteNormativo);
    const res = resFalsa();
    await roto({ method: 'POST', body: { pregunta: secreto } } as never, res as never);
    expect(res.estado).toBe(500);
    expect(JSON.stringify(res.cuerpo)).not.toContain('ABC123');
    for (const espia of espias) {
      expect(espia).not.toHaveBeenCalled();
      espia.mockRestore();
    }
  });
});
