import { ErrorEvidencia, Evidencia } from '../../../src/core/Evidencia';

const instante = '2026-11-13T20:45:00.000Z';

describe('Evidencia', () => {
  it('crea una nota con su fecha y hora', () => {
    const nota = Evidencia.crear({ id: 'ev-1', tipo: 'nota', creadaEn: instante, texto: '  El agente no se identificó. ' });
    expect(nota.texto).toBe('El agente no se identificó.');
    expect(nota.mime).toBeNull();
    expect(nota.tamano).toBe(0);
    expect(nota.tieneArchivo()).toBe(false);
    expect(nota.instante()).toBe(Date.parse(instante));
  });

  it('crea audio y foto con metadatos, sin contenido binario', () => {
    const audio = Evidencia.crear({
      id: 'ev-2',
      tipo: 'audio',
      creadaEn: instante,
      mime: 'audio/webm;codecs=opus',
      nombre: 'grabacion.webm',
      tamano: 2048,
      duracionMs: 65000,
    });
    expect(audio.tieneArchivo()).toBe(true);
    expect(audio.duracionMs).toBe(65000);
    expect(Object.keys(audio.toJSON()).sort()).toEqual(
      ['creadaEn', 'duracionMs', 'id', 'mime', 'nombre', 'tamano', 'texto', 'tipo'].sort(),
    );
    const foto = Evidencia.crear({ id: 'ev-3', tipo: 'foto', creadaEn: instante, mime: 'IMAGE/JPEG', tamano: 10 });
    expect(foto.mime).toBe('image/jpeg');
  });

  it('rechaza datos inválidos con el campo que falló', () => {
    const casos: [() => unknown, string][] = [
      [() => Evidencia.crear({ id: ' ', tipo: 'nota', creadaEn: instante, texto: 'x' }), 'id'],
      [() => Evidencia.crear({ id: 'a', tipo: 'video' as never, creadaEn: instante }), 'tipo'],
      [() => Evidencia.crear({ id: 'a', tipo: 'nota', creadaEn: '2026-11-13', texto: 'x' }), 'creadaEn'],
      [() => Evidencia.crear({ id: 'a', tipo: 'nota', creadaEn: '2026-13-45T25:00:00Z', texto: 'x' }), 'creadaEn'],
      [() => Evidencia.crear({ id: 'a', tipo: 'nota', creadaEn: instante, texto: '   ' }), 'texto'],
      [() => Evidencia.crear({ id: 'a', tipo: 'foto', creadaEn: instante, mime: 'audio/webm', tamano: 1 }), 'mime'],
      [() => Evidencia.crear({ id: 'a', tipo: 'audio', creadaEn: instante, mime: 'audio/webm', tamano: 0 }), 'tamano'],
      [() => Evidencia.crear({ id: 'a', tipo: 'audio', creadaEn: instante, mime: 'audio/webm', tamano: 1.5 }), 'tamano'],
      [() => Evidencia.crear({ id: 'a', tipo: 'foto', creadaEn: instante, mime: 'image/png', tamano: 1, duracionMs: 3 }), 'duracionMs'],
    ];
    for (const [fn, campo] of casos) {
      try {
        fn();
        throw new Error(`No lanzó error para ${campo}`);
      } catch (e) {
        expect(e).toBeInstanceOf(ErrorEvidencia);
        expect((e as ErrorEvidencia).campo).toBe(campo);
      }
    }
  });

  it('acepta instantes con desfase explícito', () => {
    expect(Evidencia.esInstanteValido('2026-11-13T15:45:00-05:00')).toBe(true);
    expect(Evidencia.esInstanteValido('2026-11-13T15:45')).toBe(false);
  });

  it('ida y vuelta por JSON', () => {
    const e = Evidencia.crear({ id: 'ev-4', tipo: 'nota', creadaEn: instante, texto: 'Nota' });
    const otra = Evidencia.desdeJSON(JSON.parse(JSON.stringify(e)));
    expect(otra).toEqual(e);
  });
});
