import type { ReactNode } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

import { useTema } from './estadoAjustes';
import { aria } from './foco';
import type { Colores } from './tema';

type Variante = 'base' | 'nota' | 'destacado';

interface PropsTexto {
  children: ReactNode;
  /** base: texto corrido. nota: secundario o metadatos (min. 18 px). destacado: cifras clave. */
  variante?: Variante;
  color?: keyof Colores;
  /** Peso 600. Para etiquetas y datos importantes; no para parrafos enteros. */
  negrita?: boolean;
  centrado?: boolean;
  /** Numero maximo de lineas antes de cortar con puntos suspensivos. */
  lineas?: number;
  style?: StyleProp<TextStyle>;
  nativeID?: string;
  testID?: string;
  accessibilityLiveRegion?: 'none' | 'polite' | 'assertive';
}

/** Texto que respeta el tamano de letra elegido en Ajustes. */
export function Texto({ children, variante = 'base', color = 'texto', negrita, centrado, lineas, style, ...resto }: PropsTexto) {
  const { tipo, colores, peso } = useTema();
  const tamano = variante === 'nota' ? tipo.nota : variante === 'destacado' ? tipo.destacado : tipo.base;
  return (
    <Text
      {...resto}
      numberOfLines={lineas}
      style={[
        {
          fontSize: tamano,
          lineHeight: tipo.alturaLinea(tamano),
          color: colores[color],
          fontWeight: variante === 'destacado' ? peso.fuerte : negrita ? peso.medio : peso.normal,
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
  /** Nivel semantico (h1, h2, h3). Una pantalla tiene un solo h1, que pone Pantalla. */
  nivel?: 1 | 2 | 3;
  /** Tamano visual si debe ser distinto del nivel (por ejemplo un h2 dentro de una tarjeta se ve como h3). */
  tamanoVisual?: 1 | 2 | 3;
  color?: keyof Colores;
  centrado?: boolean;
  style?: StyleProp<TextStyle>;
  nativeID?: string;
  testID?: string;
}

/** Titulo con rol de encabezado y nivel, para que los lectores de pantalla lo anuncien. */
export function Titulo({ children, nivel = 2, tamanoVisual, color = 'texto', centrado, style, nativeID, testID }: PropsTitulo) {
  const { tipo, colores, peso } = useTema();
  const visual = tamanoVisual ?? nivel;
  const tamano = visual === 1 ? tipo.tituloPantalla : visual === 2 ? tipo.titulo : tipo.subtitulo;
  return (
    <Text
      accessibilityRole="header"
      {...aria({ 'aria-level': nivel })}
      nativeID={nativeID}
      testID={testID}
      style={[
        {
          fontSize: tamano,
          lineHeight: tipo.alturaLinea(tamano),
          color: colores[color],
          fontWeight: visual === 3 ? peso.medio : peso.fuerte,
          textAlign: centrado ? 'center' : 'left',
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
