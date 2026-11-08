import {
  NormalizadorEspanol,
  raizLigera,
  terminosAfines,
  terminosCoinciden,
} from '../../../src/core/NormalizadorEspanol';

describe('NormalizadorEspanol', () => {
  const n = new NormalizadorEspanol();

  it('pasa a minúsculas y quita tildes y signos', () => {
    expect(NormalizadorEspanol.sinTildes('¿Qué TRÁNSITO?')).toBe('¿que transito?');
    expect(n.tokens('¿Inmovilización? ¡Sí!')).toEqual(['inmovilizar']);
  });

  it('quita las palabras vacías', () => {
    expect(n.tokens('¿Qué hago si me para un agente de tránsito?')).toEqual(['agente']);
    expect(n.tokens('¿Qué hago en el tránsito?')).toEqual(['transito']);
    expect(n.tokens('el la de que y en')).toEqual([]);
  });

  it('lleva los sinónimos coloquiales a un término canónico', () => {
    expect(n.tokens('multa')).toEqual(['comparendo']);
    expect(n.tokens('me hicieron un parte')).toEqual(['comparendo']);
    expect(n.tokens('foto multa')).toEqual(['fotomulta']);
    expect(n.tokens('fotodetección')).toEqual(['fotomulta']);
    expect(n.tokens('la cámara')).toEqual(['fotomulta']);
    expect(n.tokens('quiero reclamar')).toEqual(['impugnar']);
    expect(n.tokens('pelear')).toEqual(['impugnar']);
    expect(n.tokens('audiencia')).toEqual(['impugnar']);
    expect(n.tokens('grúa patios inmovilizado')).toEqual(['inmovilizar', 'inmovilizar', 'inmovilizar']);
    expect(n.tokens('el pase de conducción')).toEqual(['licencia']);
  });

  it('distingue "me pasé el semáforo" del pase de conducción', () => {
    expect(n.tokens('me pasé el semáforo')).toEqual(['pasarse', 'semaforo']);
    expect(n.tokens('no llevo el pase')).toContain('licencia');
  });

  it('quita el plural simple', () => {
    expect(NormalizadorEspanol.raiz('normas')).toBe('norma');
    expect(NormalizadorEspanol.raiz('señales'.normalize('NFD').replace(/[̀-ͯ]/g, ''))).toBe('senal');
    expect(NormalizadorEspanol.raiz('mes')).toBe('mes');
  });

  it('compara términos por prefijo largo', () => {
    expect(terminosCoinciden('inmovilizan', 'inmovilizacion')).toBe(true);
    expect(terminosCoinciden('presento', 'presentarme')).toBe(true);
    expect(terminosCoinciden('carro', 'carretera')).toBe(false);
    expect(terminosCoinciden('pago', 'pagar')).toBe(false);
  });

  it('es determinista', () => {
    const texto = '¿Cuántos días hábiles tengo para impugnar la fotomulta?';
    expect(n.tokens(texto)).toEqual(n.tokens(texto));
    expect(n.normalizar(texto)).toBe('cuanto diahabil impugnar fotomulta');
  });

  it('la raíz ligera junta formas de la misma palabra sin acortar de más', () => {
    expect(raizLigera('notificaron')).toBe(raizLigera('notificar'));
    expect(raizLigera('decidieron')).toBe(raizLigera('decidir'));
    expect(raizLigera('pago')).toBe('pago');
    expect(raizLigera('mes')).toBe('mes');
  });

  it('terminosAfines acepta prefijo, raíz y una letra de error, pero no palabras distintas', () => {
    expect(terminosAfines('inmovilizan', 'inmovilizacion')).toBe(true);
    expect(terminosAfines('decidieron', 'decidir')).toBe(true);
    expect(terminosAfines('notificasion', 'notificacion')).toBe(true);
    expect(terminosAfines('carro', 'carretera')).toBe(false);
    expect(terminosAfines('caso', 'casa')).toBe(false);
    expect(terminosAfines('pago', 'pagar')).toBe(false);
  });

  it('el inspector es funcionario, no agente, y el dueño es el propietario', () => {
    expect(n.tokens('el inspector de tránsito')).toEqual(['funcionario', 'transito']);
    expect(n.tokens('el dueño del carro')).toEqual(['propietario', 'vehiculo']);
  });
});
