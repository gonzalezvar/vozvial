import { router, type Href } from 'expo-router';
import { Linking, Text } from 'react-native';

import { useTema } from './estadoAjustes';

interface PropsEnlace {
  children: string;
  /** Ruta interna de la app. */
  href?: Href;
  /** Direccion externa (texto oficial); se abre en otra pestana. */
  url?: string;
  accessibilityLabel?: string;
  testID?: string;
}

/** Enlace de texto subrayado: ruta interna o pagina externa. */
export function Enlace({ children, href, url, accessibilityLabel, testID }: PropsEnlace) {
  const { colores, tipo } = useTema();
  const abrir = () => {
    if (url) void Linking.openURL(url);
    else if (href) router.push(href);
  };
  return (
    <Text
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel}
      onPress={abrir}
      testID={testID}
      style={{
        color: colores.primario,
        fontSize: tipo.base,
        lineHeight: tipo.alturaLinea(tipo.base),
        fontWeight: '700',
        textDecorationLine: 'underline',
      }}
    >
      {children}
    </Text>
  );
}
