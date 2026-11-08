import { Caso, type CasoJSON } from '../../../../src/core/Caso';
import { CatalogoInfracciones } from '../../../../src/core/CatalogoInfracciones';
import { GestorClaves } from '../../../../src/core/GestorClaves';
import { RepositorioCuentas } from '../../../../src/servidor/bd/RepositorioCuentas';
import { CUENTAS_DEMO, documentoUsuariosDemo, sembrarDemo } from '../../../../src/servidor/semillaDemo';
import { ClienteCuentas } from '../../../../src/services/ClienteCuentas';
import { ClienteSincronizacion } from '../../../../src/services/ClienteSincronizacion';
import { ServicioPlazos } from '../../../../src/services/ServicioPlazos';
import infracciones from '../../../../data/infracciones.json';
import { crearEntorno, type EntornoApi } from './entorno';

const ITERACIONES = 1000;
let entorno: EntornoApi;

beforeAll(async () => {
  entorno = await crearEntorno();
});

afterAll(async () => {
  await entorno.cerrar();
});

describe('semilla de demostracion', () => {
  it('es idempotente: dos corridas dejan 3 cuentas y los casos de la ultima', async () => {
    const opciones = { iteraciones: ITERACIONES, reloj: entorno.reloj.ahora };
    await sembrarDemo(entorno.bd, entorno.config, opciones);
    const resultado = await sembrarDemo(entorno.bd, entorno.config, opciones);
    expect(resultado.cuentas.map((c) => c.celular)).toEqual(['3001112233', '3002223344', '3003334455']);
    await expect(new RepositorioCuentas(entorno.bd).contar()).resolves.toBe(3);
    const casos = await entorno.bd.consultar<{ n: number }>('SELECT count(*) AS n FROM casos');
    expect(Number(casos[0]?.n)).toBe(CUENTAS_DEMO.reduce((s, c) => s + c.casos.length, 0));
  });

  it('el servidor no guarda en claro nombres, notas ni comparendos', async () => {
    const filas = await entorno.bd.consultar<Record<string, unknown>>(
      'SELECT c.perfil_cifrado, k.datos FROM cuentas c JOIN casos k ON k.cuenta_id = c.id',
    );
    const volcado = JSON.stringify(filas);
    for (const demo of CUENTAS_DEMO) expect(volcado).not.toContain(demo.nombre);
    expect(volcado).not.toContain('demostración');
    expect(volcado).not.toContain('codigoInfraccion');
  });

  it('cada cuenta entra con su PIN y sus casos se abren con el formato de la app', async () => {
    const plazos = ServicioPlazos.crear({ reloj: entorno.reloj.ahora });
    const gestor = new GestorClaves(globalThis.crypto, { iteraciones: ITERACIONES });
    // El catalogo solo carga las infracciones verificadas.
    const catalogo = new CatalogoInfracciones(infracciones as never);
    const niveles: string[] = [];
    let notas = 0;
    let fotodeteccion = 0;

    for (const demo of CUENTAS_DEMO) {
      const cuentas = new ClienteCuentas({ baseUrl: entorno.url, crypto: globalThis.crypto, enLinea: () => true });
      const remota = await cuentas.entrarConPin(demo.celular, demo.pin);
      const claveDatos = await gestor.desenvolver(remota.claveEnvueltaPin, demo.pin);
      expect(JSON.parse(await gestor.descifrarTexto(claveDatos, remota.perfilCifrado))).toEqual({
        nombre: demo.nombre,
        celular: demo.celular,
      });
      // El codigo de recuperacion publicado tambien abre la misma clave.
      await expect(gestor.desenvolver(remota.claveEnvueltaCodigo, demo.codigo.replace(/-/g, ''))).resolves.toBeDefined();

      const sync = new ClienteSincronizacion({ baseUrl: entorno.url, obtenerToken: () => remota.token, enLinea: () => true });
      const { casos } = await sync.listarCasos();
      expect(casos).toHaveLength(demo.casos.length);
      for (const registro of casos) {
        const caso = Caso.desdeJSON(JSON.parse(await gestor.descifrarTexto(claveDatos, registro)) as CasoJSON);
        expect(caso.comparendo).not.toBeNull();
        expect(catalogo.existe(caso.comparendo!.codigoInfraccion)).toBe(true);
        niveles.push(plazos.estado(caso.comparendo!).nivel);
        if (caso.comparendo!.tipo === 'fotodeteccion') fotodeteccion += 1;
        notas += caso.evidencias.filter((e) => e.tipo === 'nota').length;

        for (const evidencia of caso.evidencias.filter((e) => e.tieneArchivo())) {
          const bajada = await sync.bajarEvidencia(evidencia.id);
          expect(bajada).not.toBeNull();
          const iv = Uint8Array.from(Buffer.from(bajada!.iv, 'base64'));
          const claro = new Uint8Array(await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, claveDatos, bajada!.datos));
          expect(claro.length).toBe(evidencia.tamano);
          expect(Array.from(claro.slice(1, 4))).toEqual([0x50, 0x4e, 0x47]); // "PNG"
        }
      }
    }

    // Plazo por vencer en 1 o 2 dias habiles, uno vencido, uno de fotodeteccion y al menos una nota.
    expect(niveles).toContain('urgente');
    expect(niveles).toContain('vencido');
    expect(fotodeteccion).toBeGreaterThan(0);
    expect(notas).toBeGreaterThan(0);
    expect(niveles.filter((n) => n === 'urgente')).toHaveLength(3);
  });

  it('el documento lista celular, PIN y codigo de cada cuenta con la advertencia', () => {
    const doc = documentoUsuariosDemo();
    expect(doc).toContain('ficticias y públicas');
    for (const demo of CUENTAS_DEMO) {
      expect(doc).toContain(demo.celular);
      expect(doc).toContain(demo.pin);
      expect(doc).toContain(demo.codigo);
    }
  });
});
