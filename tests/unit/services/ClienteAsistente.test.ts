import { ClienteAsistente, ErrorAsistente } from '../../../src/services/ClienteAsistente';

const RESPUESTA = {
  tipo: 'respuesta',
  texto: 'Texto verificado.',
  citas: [{ id: 'X', norma: 'Ley', articulo: '1', titulo: 't', textoLiteral: 'l', urlFuente: 'u', fechaConsulta: '2026-11-08' }],
  puntaje: 1,
  modo: 'verificado',
  aviso: 'VozVial informa y organiza. No reemplaza a un abogado.',
};

function respuestaHttp(estado: number, cuerpo: unknown): Response {
  return { ok: estado >= 200 && estado < 300, status: estado, json: async () => cuerpo } as unknown as Response;
}

describe('ClienteAsistente', () => {
  it('envía solo el campo pregunta, sin credenciales, al endpoint del mismo origen', async () => {
    const fetch = jest.fn(async () => respuestaHttp(200, RESPUESTA));
    const cliente = new ClienteAsistente({ baseUrl: '', fetch, enLinea: () => true });
    const r = await cliente.preguntar('  ¿Puedo grabar?  ');
    expect(r.texto).toBe('Texto verificado.');
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/asistente');
    expect(JSON.parse(String(init.body))).toEqual({ pregunta: '¿Puedo grabar?' });
    expect(init.credentials).toBe('omit');
  });

  it('distingue la falta de conexión de un error del servidor', async () => {
    const sinRed = new ClienteAsistente({ fetch: async () => Promise.reject(new TypeError('Failed to fetch')), enLinea: () => true });
    await expect(sinRed.preguntar('hola')).rejects.toMatchObject({ causa: 'sin_conexion' });

    const desconectado = new ClienteAsistente({ fetch: jest.fn(), enLinea: () => false });
    await expect(desconectado.preguntar('hola')).rejects.toMatchObject({ causa: 'sin_conexion' });

    const caido = new ClienteAsistente({ fetch: async () => respuestaHttp(500, {}), enLinea: () => true });
    await expect(caido.preguntar('hola')).rejects.toMatchObject({ causa: 'servidor' });
  });

  it('nunca acepta una respuesta de tipo respuesta sin citas', async () => {
    const cliente = new ClienteAsistente({ fetch: async () => respuestaHttp(200, { ...RESPUESTA, citas: [] }), enLinea: () => true });
    await expect(cliente.preguntar('hola')).rejects.toBeInstanceOf(ErrorAsistente);
  });
});
