import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, type StyleProp, type ViewStyle } from 'react-native';

import { useTema } from './estadoAjustes';
import { estiloFoco } from './foco';
import { Texto } from './Texto';

export type VarianteBoton = 'primaria' | 'secundaria' | 'peligro';

export interface PropsBoton {
  etiqueta: string;
  /** Obligatoria: lo que anuncia el lector de pantalla. */
  accessibilityLabel: string;
  /** Obligatorio: 'button' para acciones, 'link' para navegar. */
  accessibilityRole: 'button' | 'link';
  accessibilityHint?: string;
  variante?: VarianteBoton;
  /** Texto pequeno debajo de la etiqueta. */
  descripcion?: string;
  onPress?: () => void;
  /** Si se da, el boton navega a esa ruta. */
  href?: Href;
  /** Con href: reemplaza la pantalla actual en vez de apilarla. */
  reemplazar?: boolean;
  deshabilitado?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** Boton accesible: minimo 56 px de alto, texto del tamano base y anillo de foco visible. */
export function Boton({
  etiqueta,
  accessibilityLabel,
  accessibilityRole,
  accessibilityHint,
  variante = 'primaria',
  descripcion,
  onPress,
  href,
  reemplazar,
  deshabilitado,
  testID,
  style,
}: PropsBoton) {
  const tema = useTema();
  const { colores, medidas, espacio, radio } = tema;
  const [enfocado, setEnfocado] = useState(false);

  const paleta = {
    primaria: { fondo: colores.primario, presionado: colores.primarioPresionado, texto: 'sobrePrimario', borde: colores.primario },
    secundaria: { fondo: colores.superficie, presionado: colores.primarioSuave, texto: 'primario', borde: colores.primario },
    peligro: { fondo: colores.peligro, presionado: colores.peligroPresionado, texto: 'sobrePeligro', borde: colores.peligro },
  } as const;
  const p = paleta[variante];

  const alPresionar = () => {
    if (deshabilitado) return;
    onPress?.();
    if (href) {
      if (reemplazar) router.replace(href);
      else router.push(href);
    }
  };

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      aria-disabled={deshabilitado || undefined}
      disabled={deshabilitado}
      onPress={alPresionar}
      onFocus={() => setEnfocado(true)}
      onBlur={() => setEnfocado(false)}
      testID={testID}
      style={({ pressed }) => [
        {
          minHeight: medidas.altoMinimoBoton,
          paddingVertical: espacio.s + 4,
          paddingHorizontal: espacio.m,
          borderRadius: radio.m,
          borderWidth: 2,
          borderColor: p.borde,
          backgroundColor: pressed ? p.presionado : p.fondo,
          justifyContent: 'center',
          alignItems: 'center',
          opacity: deshabilitado ? 0.55 : 1,
        },
        enfocado && estiloFoco(tema),
        style,
      ]}
    >
      {/* Un solo bloque de texto: asi el nombre accesible contiene el texto visible (WCAG 2.5.3). */}
      <Texto negrita centrado color={p.texto}>
        {etiqueta}
        {descripcion ? (
          <Text style={{ fontSize: tema.tipo.nota, lineHeight: tema.tipo.alturaLinea(tema.tipo.nota), fontWeight: '400' }}>
            {`\n${descripcion}`}
          </Text>
        ) : null}
      </Texto>
    </Pressable>
  );
}
