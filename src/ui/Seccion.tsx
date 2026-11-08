import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTema } from './estadoAjustes';
import { Texto, Titulo } from './Texto';

interface PropsSeccion {
  /** Titulo h2 de la seccion. Sin titulo, solo agrupa y separa. */
  titulo?: string;
  descripcion?: string;
  /** Nivel semantico del titulo. */
  nivelTitulo?: 2 | 3;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Bloque de la pantalla sin caja: titulo, una frase y su contenido (tarjetas, listas o botones).
 * Separa grupos con 32 px; dentro del grupo el espacio es de 12 px.
 */
export function Seccion({ titulo, descripcion, nivelTitulo = 2, children, style, testID }: PropsSeccion) {
  const { espacio } = useTema();
  return (
    <View testID={testID} style={[{ gap: espacio.ms, marginBottom: espacio.xl }, style]}>
      {titulo || descripcion ? (
        <View style={{ gap: espacio.xs }}>
          {titulo ? (
            <Titulo nivel={nivelTitulo} tamanoVisual={nivelTitulo === 2 ? 2 : 3}>
              {titulo}
            </Titulo>
          ) : null}
          {descripcion ? <Texto color="textoSuave">{descripcion}</Texto> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}
