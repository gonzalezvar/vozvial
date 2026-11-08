import type { ReactNode } from 'react';
import { Text } from 'react-native';

import { useTema } from '../estadoAjustes';
import { Texto } from '../Texto';

/**
 * Dato "Etiqueta: valor" en un solo texto, con la etiqueta en gris y el valor en negro. Se usa
 * donde una prueba lee el dato completo por su testID (por ejemplo "Ubicación: Sin ubicación").
 */
export function DatoEnLinea({ etiqueta, children, testID }: { etiqueta: string; children: ReactNode; testID?: string }) {
  const { colores, peso } = useTema();
  return (
    <Texto testID={testID}>
      <Text style={{ color: colores.textoSuave, fontWeight: peso.medio }}>{`${etiqueta}: `}</Text>
      {children}
    </Texto>
  );
}
