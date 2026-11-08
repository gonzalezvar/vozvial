import 'fake-indexeddb/auto';

import { webcrypto } from 'node:crypto';

import { Evidencia } from '../../../src/core/Evidencia';
import { GestorClaves } from '../../../src/core/GestorClaves';
import { AlmacenCifrado } from '../../../src/services/AlmacenCifrado';
import {
  ErrorGrabacion,
  MOTIVO_GRABACION_SIN_PERMISO,
  elegirMime,
  type AudioGrabado,
} from '../../../src/services/GrabadorAudio';
import { RegistroMePararon, type Grabador } from '../../../src/services/RegistroMePararon';
import { RepositorioCasos } from '../../../src/services/RepositorioCasos';
import type { ResultadoUbicacion } from '../../../src/services/ServicioUbicacion';

const crypto = webcrypto as unknown as Crypto;
let contador = 0;

async function preparar() {
  const gestor = new GestorClaves(crypto, { iteraciones: 1000 });
  const almacen = new AlmacenCifrado(gestor, crypto, `vozvial-mepararon-${++contador}`);
  const clave = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  return new RepositorioCasos(almacen, () => clave, crypto);
}

class GrabadorFalso implements Grabador {
  iniciado = false;
  constructor(
    private readonly audio: AudioGrabado | null,
    private readonly error: Error | null = null,
  ) {}
  async iniciar() {
    if (this.error) throw this.error;
    this.iniciado = true;
  }
  async detener() {
    return this.iniciado ? this.audio : null;
  }
  cancelar() {}
}

const AUDIO: AudioGrabado = {
  bytes: new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4]),
  mime: 'audio/webm;codecs=opus',
  iniciadoEn: Date.parse('2026-11-13T13:15:00.000Z'),
  duracionMs: 4200,
};
const CON_UBICACION: ResultadoUbicacion = { ubicacion: { lat: 4.6097, lon: -74.0817, precision: 12 }, motivo: null };
const NEGADA: ResultadoUbicacion = { ubicacion: null, motivo: 'denegada' };
const reloj = () => new Date('2026-11-13T13:15:00.000Z');

describe('RegistroMePararon', () => {
  it('crea el caso con la fecha del toque y la ubicacion, y guarda el audio cifrado al terminar', async () => {
    const repo = await preparar();
    const registro = new RegistroMePararon(repo, new GrabadorFalso(AUDIO), { obtener: async () => CON_UBICACION }, reloj);
    expect(await registro.iniciarGrabacion()).toMatchObject({ grabando: true });

    const caso = await registro.crearCaso();
    expect(caso.creadoEn).toBe('2026-11-13T13:15:00.000Z');
    expect(caso.ubicacion).toEqual({ lat: 4.6097, lon: -74.0817, precision: 12 });
    expect(caso.estado).toBe('registrando');
    // crearCaso no duplica el caso si se llama otra vez.
    expect((await registro.crearCaso()).id).toBe(caso.id);

    const final = await registro.terminar(caso);
    expect(final.estado).toBe('abierto');
    const audios = final.evidencias.filter((e) => e.tipo === 'audio');
    expect(audios).toHaveLength(1);
    expect(audios[0]!.mime).toBe('audio/webm;codecs=opus');
    expect(audios[0]!.tamano).toBe(8);
    expect(audios[0]!.duracionMs).toBe(4200);

    const guardado = await repo.obtener(final.id);
    expect(guardado?.estado).toBe('abierto');
    expect(Array.from(await repo.leerContenido(audios[0]!.id))).toEqual(Array.from(AUDIO.bytes));
  });

  it('sin permiso de ubicacion crea el caso igual, "Sin ubicación"', async () => {
    const repo = await preparar();
    const registro = new RegistroMePararon(repo, new GrabadorFalso(AUDIO), { obtener: async () => NEGADA }, reloj);
    const caso = await registro.crearCaso();
    expect(caso.ubicacion).toBeNull();
    expect(caso.motivoSinUbicacion).toBe('denegada');
    expect(caso.descripcionUbicacion()).toBe('Sin ubicación');
  });

  it('si la ubicacion falla, el caso se crea con motivo no_disponible', async () => {
    const repo = await preparar();
    const registro = new RegistroMePararon(
      repo,
      new GrabadorFalso(null),
      { obtener: () => Promise.reject(new Error('gps')) },
      reloj,
    );
    expect((await registro.crearCaso()).motivoSinUbicacion).toBe('no_disponible');
  });

  it('sin microfono informa el motivo y al terminar guarda el caso sin audio', async () => {
    const repo = await preparar();
    const grabador = new GrabadorFalso(AUDIO, new ErrorGrabacion('permiso_negado', MOTIVO_GRABACION_SIN_PERMISO));
    const registro = new RegistroMePararon(repo, grabador, { obtener: async () => NEGADA }, reloj);
    expect(await registro.iniciarGrabacion()).toEqual({ grabando: false, motivo: MOTIVO_GRABACION_SIN_PERMISO });
    const final = await registro.terminar();
    expect(final.evidencias).toHaveLength(0);
    expect(final.estado).toBe('abierto');
    expect((await repo.listar()).map((c) => c.id)).toEqual([final.id]);
  });

  it('conserva las notas agregadas mientras se grababa', async () => {
    const repo = await preparar();
    const registro = new RegistroMePararon(repo, new GrabadorFalso(AUDIO), { obtener: async () => NEGADA }, reloj);
    await registro.iniciarGrabacion();
    const caso = await registro.crearCaso();
    const nota = Evidencia.crear({ id: 'n1', tipo: 'nota', creadaEn: '2026-11-13T13:16:00.000Z', texto: 'Placa del agente 123' });
    const conNota = await repo.agregarEvidencia(caso, nota);
    const final = await registro.terminar(conNota);
    expect(final.evidencias.map((e) => e.tipo).sort()).toEqual(['audio', 'nota']);
  });
});

describe('elegirMime', () => {
  it('prefiere webm/opus, luego mp4, y null si ninguno sirve', () => {
    expect(elegirMime(() => true)).toBe('audio/webm;codecs=opus');
    expect(elegirMime((m) => m === 'audio/mp4')).toBe('audio/mp4');
    expect(elegirMime(() => false)).toBeNull();
    expect(
      elegirMime((m) => {
        if (m.startsWith('audio/webm')) throw new Error('viejo');
        return true;
      }),
    ).toBe('audio/mp4');
  });
});
