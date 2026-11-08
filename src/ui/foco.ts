import type { ViewStyle } from 'react-native';

import type { Tema } from './tema';

/** Anillo de foco visible para teclado (WCAG 2.4.7). Se aplica cuando el control esta enfocado. */
export function estiloFoco(tema: Tema): ViewStyle {
  return {
    outlineColor: tema.colores.foco,
    outlineStyle: 'solid',
    outlineWidth: tema.medidas.grosorFoco,
    outlineOffset: 2,
  };
}

/** Atributos ARIA que react-native-web pasa al DOM pero que no estan en los tipos de RN. */
export function aria(atributos: Record<string, string | number | boolean | undefined>): object {
  const limpio: Record<string, string | number | boolean> = {};
  for (const [clave, valor] of Object.entries(atributos)) {
    if (valor !== undefined) limpio[clave] = valor;
  }
  return limpio;
}
