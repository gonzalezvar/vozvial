import { createElement } from 'react';
import { Platform, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTema } from './estadoAjustes';
import { aria } from './foco';
import { ICONOS, type FormaIcono, type NombreIcono } from './iconos';
import type { NombreColor } from './tema';

interface PropsIcono {
  nombre: NombreIcono;
  /** Color del trazo, de la paleta. Por defecto el del texto. */
  color?: NombreColor;
  /** Lado en px. Por defecto 24. */
  tamano?: number;
  /** Caracter que se muestra fuera de la web (Expo Go), donde no hay SVG sin paquetes extra. */
  respaldo?: string;
  style?: StyleProp<ViewStyle>;
}

function forma(f: FormaIcono, i: number, color: string) {
  const comun = { key: i, fill: f.relleno ? color : 'none' };
  if (f.t === 'path') return createElement('path', { ...comun, d: f.d });
  if (f.t === 'circle') return createElement('circle', { ...comun, cx: f.cx, cy: f.cy, r: f.r });
  return createElement('rect', { ...comun, x: f.x, y: f.y, width: f.w, height: f.h, rx: f.rx });
}

/**
 * Icono decorativo: siempre va oculto para el lector de pantalla, porque el control que lo
 * contiene ya tiene su nombre en texto. Nunca uses un icono solo, sin texto al lado.
 */
export function Icono({ nombre, color = 'texto', tamano, respaldo, style }: PropsIcono) {
  const { colores, medidas } = useTema();
  const lado = tamano ?? medidas.icono;
  const tinta = colores[color];
  const oculto = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const, ...aria({ 'aria-hidden': true }) };

  if (Platform.OS !== 'web') {
    return (
      <View {...oculto} style={[{ width: lado, height: lado, alignItems: 'center', justifyContent: 'center' }, style]}>
        {respaldo ? <Text style={{ color: tinta, fontSize: lado * 0.8, lineHeight: lado, fontWeight: '700' }}>{respaldo}</Text> : null}
      </View>
    );
  }

  // En web react-native-web monta sobre el DOM, asi que se dibuja un <svg> nativo del navegador.
  return (
    <View {...oculto} style={[{ width: lado, height: lado, flexShrink: 0 }, style]}>
      {createElement(
        'svg',
        {
          width: lado,
          height: lado,
          viewBox: '0 0 24 24',
          stroke: tinta,
          strokeWidth: 2,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          focusable: 'false',
          'aria-hidden': true,
          style: { display: 'block' },
        },
        ICONOS[nombre].map((f, i) => forma(f, i, tinta)),
      )}
    </View>
  );
}
