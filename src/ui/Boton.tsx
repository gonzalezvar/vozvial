import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTema } from './estadoAjustes';
import { aria, estiloFoco } from './foco';
import { Icono } from './Icono';
import type { NombreIcono } from './iconos';
import type { NombreColor } from './tema';
import { Texto } from './Texto';

/**
 * primaria: la accion principal de la pantalla (una sola por pantalla).
 * secundaria: acciones de apoyo; fondo blanco con borde.
 * tonal: acciones frecuentes de poco peso, como "Escuchar".
 * texto: acciones de navegacion discretas, como "Volver".
 * urgencia: solo para grabar o detener una grabacion.
 * peligro: borrar o cerrar sesion (rellena) y peligroSecundaria (con borde) para el disparador.
 */
export type VarianteBoton = 'primaria' | 'secundaria' | 'tonal' | 'texto' | 'urgencia' | 'peligro' | 'peligroSecundaria';

export interface PropsBoton {
  etiqueta: string;
  /** Obligatoria: lo que anuncia el lector de pantalla. Debe contener la etiqueta visible. */
  accessibilityLabel: string;
  /** Obligatorio: 'button' para acciones, 'link' para navegar. */
  accessibilityRole: 'button' | 'link';
  accessibilityHint?: string;
  variante?: VarianteBoton;
  /** Texto pequeno debajo de la etiqueta. */
  descripcion?: string;
  /** Icono antes de la etiqueta. */
  icono?: NombreIcono;
  /** Icono despues de la etiqueta (por ejemplo "siguiente" o "externo"). */
  iconoFinal?: NombreIcono;
  /** Muestra un indicador de carga y deja de responder a toques hasta que termine. */
  cargando?: boolean;
  /** Alineacion del contenido. Por defecto centrado; "inicio" para botones con descripcion larga. */
  alineacion?: 'centro' | 'inicio';
  onPress?: () => void;
  /** Si se da, el boton navega a esa ruta. */
  href?: Href;
  /** Con href: reemplaza la pantalla actual en vez de apilarla. */
  reemplazar?: boolean;
  deshabilitado?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

interface Paleta {
  fondo: string;
  presionado: string;
  texto: NombreColor;
  borde: string;
  grosorBorde: number;
}

/** Boton accesible: minimo 56 px de alto, texto del tamano base y anillo de foco visible. */
export function Boton({
  etiqueta,
  accessibilityLabel,
  accessibilityRole,
  accessibilityHint,
  variante = 'primaria',
  descripcion,
  icono,
  iconoFinal,
  cargando,
  alineacion = 'centro',
  onPress,
  href,
  reemplazar,
  deshabilitado,
  testID,
  style,
}: PropsBoton) {
  const tema = useTema();
  const { colores, medidas, espacio, radio, tipo, peso } = tema;
  const [enfocado, setEnfocado] = useState(false);

  const paletas: Record<VarianteBoton, Paleta> = {
    primaria: { fondo: colores.primario, presionado: colores.primarioPresionado, texto: 'sobrePrimario', borde: colores.primario, grosorBorde: 2 },
    secundaria: { fondo: colores.superficie, presionado: colores.primarioSuave, texto: 'primario', borde: colores.primario, grosorBorde: 2 },
    tonal: { fondo: colores.primarioSuave, presionado: colores.primarioSuaveFuerte, texto: 'primario', borde: colores.primarioSuave, grosorBorde: 2 },
    texto: { fondo: 'transparent', presionado: colores.primarioSuave, texto: 'primario', borde: 'transparent', grosorBorde: 2 },
    urgencia: { fondo: colores.urgencia, presionado: colores.urgenciaPresionado, texto: 'sobreUrgencia', borde: colores.urgencia, grosorBorde: 2 },
    peligro: { fondo: colores.peligro, presionado: colores.peligroPresionado, texto: 'sobrePeligro', borde: colores.peligro, grosorBorde: 2 },
    peligroSecundaria: { fondo: colores.superficie, presionado: colores.peligroSuave, texto: 'peligroTexto', borde: colores.peligro, grosorBorde: 2 },
  };
  const p = paletas[variante];
  const inactivo = deshabilitado || cargando;

  const alPresionar = () => {
    if (inactivo) return;
    onPress?.();
    if (href) {
      if (reemplazar) router.replace(href);
      else router.push(href);
    }
  };

  const centrado = alineacion === 'centro';

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!deshabilitado, busy: !!cargando }}
      aria-disabled={deshabilitado || undefined}
      {...aria({ 'aria-busy': cargando || undefined })}
      disabled={deshabilitado}
      onPress={alPresionar}
      onFocus={() => setEnfocado(true)}
      onBlur={() => setEnfocado(false)}
      testID={testID}
      style={({ pressed }) => [
        {
          minHeight: medidas.altoMinimoBoton,
          paddingVertical: espacio.ms,
          paddingHorizontal: variante === 'texto' ? espacio.s : espacio.m,
          borderRadius: radio.m,
          borderWidth: p.grosorBorde,
          borderColor: p.borde,
          backgroundColor: pressed && !inactivo ? p.presionado : p.fondo,
          flexDirection: 'row',
          justifyContent: centrado ? 'center' : 'flex-start',
          alignItems: 'center',
          gap: espacio.s,
          opacity: deshabilitado ? 0.55 : 1,
        },
        enfocado && estiloFoco(tema),
        style,
      ]}
    >
      {cargando ? (
        <ActivityIndicator color={colores[p.texto]} size="small" />
      ) : icono ? (
        <Icono nombre={icono} color={p.texto} />
      ) : null}
      {/* Un solo bloque de texto: asi el nombre accesible contiene el texto visible (WCAG 2.5.3). */}
      <View style={{ flexShrink: 1, flexGrow: centrado ? 0 : 1 }}>
        <Texto negrita centrado={centrado} color={p.texto} style={{ fontWeight: peso.medio }}>
          {etiqueta}
          {descripcion ? (
            <Text style={{ fontSize: tipo.nota, lineHeight: tipo.alturaLinea(tipo.nota), fontWeight: peso.normal }}>
              {`\n${descripcion}`}
            </Text>
          ) : null}
        </Texto>
      </View>
      {iconoFinal ? <Icono nombre={iconoFinal} color={p.texto} /> : null}
    </Pressable>
  );
}
