import { DetectorTema } from '../../../src/core/DetectorTema';
import { PREGUNTAS_VERIFICADAS } from '../../../src/core/cargarDatos';

describe('DetectorTema', () => {
  const detector = new DetectorTema();

  it('reconoce preguntas de tránsito', () => {
    for (const p of [
      'Me pusieron un comparendo',
      '¿Cuánto vale el SOAT?',
      'Me llevaron la moto a los patios',
      '¿Puedo grabar al policía?',
      '¿Qué derechos tengo sobre mis datos personales?',
    ]) {
      expect(detector.esDelTema(p)).toBe(true);
    }
  });

  it('marca fuera de tema lo que no es de tránsito', () => {
    for (const p of ['Receta de arepas', '¿Quién ganó el partido de ayer?', 'Cuénteme un cuento']) {
      expect(detector.esDelTema(p)).toBe(false);
    }
  });

  it('todas las preguntas verificadas que nombran un tema de tránsito quedan dentro del tema', () => {
    for (const p of PREGUNTAS_VERIFICADAS.preguntas) expect(detector.esDelTema(p.pregunta)).toBe(true);
  });
});
