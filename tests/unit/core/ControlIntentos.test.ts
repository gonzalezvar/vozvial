import { ControlIntentos } from '../../../src/core/ControlIntentos';

function relojFalso(inicio = Date.UTC(2026, 10, 8, 15, 0, 0)) {
  let ahora = inicio;
  return {
    reloj: () => new Date(ahora),
    avanzar: (ms: number) => {
      ahora += ms;
    },
  };
}

const BLOQUEO = 5 * 60 * 1000;

describe('ControlIntentos', () => {
  it('CA-02.2 descuenta intentos con cada fallo', () => {
    const { reloj } = relojFalso();
    const control = new ControlIntentos({ maxIntentos: 5, bloqueoMs: BLOQUEO, reloj });
    expect(control.estado()).toEqual({ bloqueado: false, intentosRestantes: 5, msRestantes: 0 });
    expect(control.registrarFallo().intentosRestantes).toBe(4);
    expect(control.registrarFallo().intentosRestantes).toBe(3);
  });

  it('CA-02.3 bloquea al quinto fallo durante bloqueoMs y luego se desbloquea', () => {
    const { reloj, avanzar } = relojFalso();
    const control = new ControlIntentos({ maxIntentos: 5, bloqueoMs: BLOQUEO, reloj });
    for (let i = 0; i < 4; i++) expect(control.registrarFallo().bloqueado).toBe(false);
    expect(control.registrarFallo()).toEqual({
      bloqueado: true,
      intentosRestantes: 0,
      msRestantes: BLOQUEO,
    });

    avanzar(60_000);
    expect(control.estado()).toEqual({
      bloqueado: true,
      intentosRestantes: 0,
      msRestantes: BLOQUEO - 60_000,
    });
    // Fallar durante el bloqueo no lo alarga.
    expect(control.registrarFallo().msRestantes).toBe(BLOQUEO - 60_000);

    avanzar(BLOQUEO - 60_000 - 1);
    expect(control.estado().bloqueado).toBe(true);
    avanzar(1);
    expect(control.estado()).toEqual({ bloqueado: false, intentosRestantes: 5, msRestantes: 0 });
  });

  it('un exito reinicia el contador', () => {
    const { reloj } = relojFalso();
    const control = new ControlIntentos({ bloqueoMs: BLOQUEO, reloj });
    control.registrarFallo();
    control.registrarFallo();
    expect(control.registrarExito().intentosRestantes).toBe(5);
  });

  it('por defecto son 5 intentos y 5 minutos', () => {
    const control = new ControlIntentos();
    expect(control.maxIntentos).toBe(5);
    expect(control.bloqueoMs).toBe(BLOQUEO);
  });

  it('serializa y restaura el bloqueo (sobrevive a recargar la app)', () => {
    const { reloj, avanzar } = relojFalso();
    const opciones = { bloqueoMs: BLOQUEO, reloj };
    const control = new ControlIntentos(opciones);
    for (let i = 0; i < 5; i++) control.registrarFallo();
    const guardado = JSON.stringify(control.serializar());

    avanzar(1000);
    const restaurado = ControlIntentos.desdeJSON(guardado, opciones);
    expect(restaurado.estado()).toEqual({
      bloqueado: true,
      intentosRestantes: 0,
      msRestantes: BLOQUEO - 1000,
    });

    const parcial = new ControlIntentos(opciones);
    parcial.registrarFallo();
    parcial.registrarFallo();
    expect(ControlIntentos.desdeJSON(parcial.serializar(), opciones).estado().intentosRestantes).toBe(3);
  });

  it('desdeJSON ignora datos invalidos y limita bloqueos editados a mano', () => {
    const { reloj } = relojFalso();
    const opciones = { bloqueoMs: BLOQUEO, reloj };
    expect(ControlIntentos.desdeJSON('{roto', opciones).estado().intentosRestantes).toBe(5);
    expect(ControlIntentos.desdeJSON(null, opciones).estado().bloqueado).toBe(false);
    const editado = ControlIntentos.desdeJSON(
      { fallos: 0, bloqueadoHasta: reloj().getTime() + 10 * BLOQUEO },
      opciones,
    );
    expect(editado.estado().msRestantes).toBe(BLOQUEO);
  });

  it('rechaza configuraciones invalidas', () => {
    expect(() => new ControlIntentos({ maxIntentos: 0 })).toThrow(RangeError);
    expect(() => new ControlIntentos({ bloqueoMs: -1 })).toThrow(RangeError);
  });
});
