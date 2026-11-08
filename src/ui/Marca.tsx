import { createElement } from 'react';
import { Platform, Text, View } from 'react-native';

import { useTema } from './estadoAjustes';
import { aria } from './foco';

interface PropsMarca {
  /** Lado del simbolo en px. */
  tamano?: number;
  /** Muestra la palabra "VozVial" junto al simbolo. */
  conNombre?: boolean;
}

/**
 * Marca de VozVial: una "V" dentro de un globo de dialogo (voz + via), sobre el azul petroleo.
 * Se anuncia como una imagen llamada "VozVial"; el texto interno queda oculto para no repetirse.
 */
export function Marca({ tamano = 40, conNombre = true }: PropsMarca) {
  const { colores, tipo, peso, espacio } = useTema();

  const simbolo =
    Platform.OS === 'web' ? (
      createElement(
        'svg',
        { width: tamano, height: tamano, viewBox: '0 0 40 40', 'aria-hidden': true, focusable: 'false', style: { display: 'block' } },
        createElement('rect', { key: 'f', x: 0, y: 0, width: 40, height: 40, rx: 11, fill: colores.primario }),
        createElement('path', {
          key: 'g',
          d: 'M10 11h20a3 3 0 013 3v10a3 3 0 01-3 3h-9l-6 5v-5h-5a3 3 0 01-3-3V14a3 3 0 013-3z',
          fill: colores.superficie,
        }),
        createElement('path', {
          key: 'v',
          d: 'M15 15.5l5 7 5-7',
          fill: 'none',
          stroke: colores.primario,
          strokeWidth: 3,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
        createElement('circle', { key: 'p', cx: 31, cy: 9, r: 4, fill: colores.urgencia }),
      )
    ) : (
      <View
        style={{
          width: tamano,
          height: tamano,
          borderRadius: tamano * 0.28,
          backgroundColor: colores.primario,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: colores.sobrePrimario, fontWeight: peso.fuerte, fontSize: tamano * 0.55 }}>V</Text>
      </View>
    );

  return (
    <View accessibilityRole="image" accessibilityLabel="VozVial" style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" {...aria({ 'aria-hidden': true })}>
        {simbolo}
      </View>
      {conNombre ? (
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no"
          {...aria({ 'aria-hidden': true })}
          style={{ color: colores.primario, fontSize: tipo.subtitulo, lineHeight: tipo.alturaLinea(tipo.subtitulo), fontWeight: peso.fuerte }}
        >
          VozVial
        </Text>
      ) : null}
    </View>
  );
}
