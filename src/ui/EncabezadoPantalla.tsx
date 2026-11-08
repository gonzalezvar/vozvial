import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Boton } from './Boton';
import { BotonEscuchar } from './BotonEscuchar';
import { useTema } from './estadoAjustes';
import { Marca } from './Marca';
import { Texto, Titulo } from './Texto';

export interface PropsEncabezadoPantalla {
  titulo: string;
  /** Una frase bajo el titulo que dice para que sirve la pantalla. */
  descripcion?: string;
  /** Ruta a la que vuelve si no hay historial. Con false no se muestra "Volver" y aparece la marca. */
  volverA?: Href | false;
  /** Texto que lee "Escuchar" (o funcion que lo arma al tocar). */
  lectura: string | (() => string);
  /** Elemento extra al final de la barra superior (por ejemplo la ayuda de la pantalla). */
  extra?: ReactNode;
}

/**
 * Encabezado comun: barra con "Volver" (o la marca) y "Escuchar", y debajo el titulo h1.
 * Va dentro de un landmark "banner" que pone Pantalla.
 */
export function EncabezadoPantalla({ titulo, descripcion, volverA = '/inicio', lectura, extra }: PropsEncabezadoPantalla) {
  const { espacio } = useTema();

  const volver = () => {
    if (router.canGoBack()) router.back();
    else if (volverA) router.replace(volverA);
  };

  return (
    <View style={{ paddingTop: espacio.m, paddingBottom: espacio.l, gap: espacio.m }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: espacio.xs }}>
        {volverA !== false ? (
          <Boton
            etiqueta="Volver"
            accessibilityRole="button"
            accessibilityLabel="Volver a la pantalla anterior"
            variante="texto"
            icono="volver"
            onPress={volver}
            style={{ marginLeft: -espacio.s }}
          />
        ) : (
          <Marca />
        )}
        {/* Separacion corta para que Volver, Ayuda y Escuchar quepan en una fila a 412 px con letra normal. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.xs, flexShrink: 1, marginLeft: 'auto' }}>
          {extra}
          <BotonEscuchar texto={lectura} variante="tonal" />
        </View>
      </View>
      <View style={{ gap: espacio.s }}>
        <Titulo nivel={1}>{titulo}</Titulo>
        {descripcion ? <Texto color="textoSuave">{descripcion}</Texto> : null}
      </View>
    </View>
  );
}
