import type { ReactNode } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

import { useTema } from './estadoAjustes';
import { aria } from './foco';
import type { Colores } from './tema';

type Variante = 'base' | 'nota' | 'destacado';

interface PropsTexto {
  children: ReactNode;
  variante?: Variante;
  color?: keyof Colores;
  negrita?: boolean;
  centrado?: boolean;
  style?: StyleProp<TextStyle>;
  nativeID?: string;
  testID?: string;
  accessibilityLiveRegion?: 'none' | 'polite' | 'assertive';
}

/** Texto que respeta el tamano de letra elegido en Ajustes. */
export function Texto({ children, variante = 'base', color = 'texto', negrita, centrado, style, ...resto }: PropsTexto) {
  const { tipo, colores } = useTema();
  const tamano = variante === 'nota' ? tipo.nota : variante === 'destacado' ? tipo.destacado : tipo.base;
  return (
    <Text
      {...resto}
      style={[
        {
          fontSize: tamano,
          lineHeight: tipo.alturaLinea(tamano),
          color: colores[color],
          fontWeight: negrita || variante === 'destacado' ? '700' : '400',
          textAlign: centrado ? 'center' : 'left',
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

interface PropsTitulo {
  children: ReactNode;
  nivel?: 1 | 2 | 3;
  color?: keyof Colores;
  centrado?: boolean;
  style?: StyleProp<TextStyle>;
  nativeID?: string;
}

/** Titulo con rol de encabezado y nivel, para que los lectores de pantalla lo anuncien. */
export function Titulo({ children, nivel = 2, color = 'texto', centrado, style, nativeID }: PropsTitulo) {
  const { tipo, colores } = useTema();
  const tamano = nivel === 1 ? tipo.tituloPantalla : nivel === 2 ? tipo.titulo : tipo.subtitulo;
  return (
    <Text
      accessibilityRole="header"
      {...aria({ 'aria-level': nivel })}
      nativeID={nativeID}
      style={[
        {
          fontSize: tamano,
          lineHeight: tipo.alturaLinea(tamano),
          color: colores[color],
          fontWeight: '700',
          textAlign: centrado ? 'center' : 'left',
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
