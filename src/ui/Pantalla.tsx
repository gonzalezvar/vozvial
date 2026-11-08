import { Stack, type Href } from 'expo-router';
import { useRef, type ComponentRef, type ReactNode } from 'react';
import { Platform, ScrollView, View } from 'react-native';

import { AvisoLegal } from './AvisoLegal';
import { EncabezadoPantalla } from './EncabezadoPantalla';
import { useTema } from './estadoAjustes';
import { MarcaEjemplo } from './MarcaEjemplo';

interface PropsPantalla {
  titulo: string;
  /** Una frase bajo el titulo: para que sirve esta pantalla. Tambien se lee con "Escuchar". */
  descripcion?: string;
  children: ReactNode;
  /** Texto que lee "Escuchar". Si no se da, en web se lee el contenido visible de la pantalla. */
  lectura?: string;
  /** Ruta a la que vuelve si no hay historial. Con false no se muestra "Volver" y aparece la marca. */
  volverA?: Href | false;
  /** Marca la pantalla como ejemplo con datos simulados. Un texto reemplaza el mensaje por defecto. */
  ejemplo?: boolean | string;
  /** El aviso legal se muestra siempre salvo que se pida lo contrario. */
  sinAviso?: boolean;
  /** Elemento extra en la barra superior, junto a "Escuchar" (por ejemplo la ayuda de la pantalla). */
  extraEncabezado?: ReactNode;
  /** Contenido al final, despues de children y antes del aviso legal (acciones finales). */
  pie?: ReactNode;
  testID?: string;
}

/**
 * Contenedor comun de pantalla: encabezado (Volver o marca, Escuchar y titulo h1), contenido con
 * scroll en una columna de 480 px como maximo y aviso legal al final.
 */
export function Pantalla({
  titulo,
  descripcion,
  children,
  lectura,
  volverA = '/inicio',
  ejemplo,
  sinAviso,
  extraEncabezado,
  pie,
  testID,
}: PropsPantalla) {
  const { colores, espacio, medidas } = useTema();
  const contenido = useRef<ComponentRef<typeof View>>(null);
  const cabeza = descripcion ? `${titulo}. ${descripcion}` : titulo;

  const textoParaLeer = () => {
    if (lectura) return `${cabeza}. ${lectura}`;
    if (Platform.OS === 'web' && contenido.current) {
      // En web el ref de View es el elemento del DOM: se lee lo que se ve en la pantalla.
      const nodo = contenido.current as unknown as { innerText?: string };
      if (typeof nodo.innerText === 'string') return `${cabeza}. ${nodo.innerText}`;
    }
    return cabeza;
  };

  return (
    <View style={{ flex: 1, backgroundColor: colores.fondo }} testID={testID}>
      <Stack.Screen options={{ title: `${titulo} · VozVial` }} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ alignItems: 'center', paddingBottom: espacio.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ width: '100%', maxWidth: medidas.anchoMaximoContenido, paddingHorizontal: espacio.m }}>
          <View accessibilityRole="banner">
            <EncabezadoPantalla
              titulo={titulo}
              descripcion={descripcion}
              volverA={volverA}
              lectura={textoParaLeer}
              extra={extraEncabezado}
            />
          </View>
          <View accessibilityRole="main" ref={contenido}>
            {ejemplo ? <MarcaEjemplo texto={typeof ejemplo === 'string' ? ejemplo : undefined} /> : null}
            {children}
            {pie ? <View style={{ marginTop: espacio.l, gap: espacio.ms }}>{pie}</View> : null}
          </View>
          {sinAviso ? null : (
            <View accessibilityRole="contentinfo">
              <AvisoLegal />
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
