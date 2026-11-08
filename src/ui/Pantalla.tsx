import { router, Stack, type Href } from 'expo-router';
import { useRef, type ComponentRef, type ReactNode } from 'react';
import { Platform, ScrollView, View } from 'react-native';

import { AvisoLegal } from './AvisoLegal';
import { Boton } from './Boton';
import { BotonEscuchar } from './BotonEscuchar';
import { useTema } from './estadoAjustes';
import { MarcaEjemplo } from './MarcaEjemplo';
import { Titulo } from './Texto';

interface PropsPantalla {
  titulo: string;
  children: ReactNode;
  /** Texto que lee "Escuchar". Si no se da, en web se lee el contenido visible de la pantalla. */
  lectura?: string;
  /** Ruta a la que vuelve si no hay historial. Con false no se muestra "Volver". */
  volverA?: Href | false;
  /** Marca la pantalla como ejemplo con datos simulados. Un texto reemplaza el mensaje por defecto. */
  ejemplo?: boolean | string;
  /** El aviso legal se muestra siempre salvo que se pida lo contrario. */
  sinAviso?: boolean;
  testID?: string;
}

/** Contenedor comun: encabezado con titulo y "Escuchar", contenido con scroll y ancho maximo de 480 px. */
export function Pantalla({ titulo, children, lectura, volverA = '/inicio', ejemplo, sinAviso, testID }: PropsPantalla) {
  const { colores, espacio, medidas } = useTema();
  const contenido = useRef<ComponentRef<typeof View>>(null);

  const textoParaLeer = () => {
    if (lectura) return `${titulo}. ${lectura}`;
    if (Platform.OS === 'web' && contenido.current) {
      // En web el ref de View es el elemento del DOM: se lee lo que se ve en la pantalla.
      const nodo = contenido.current as unknown as { innerText?: string };
      if (typeof nodo.innerText === 'string') return `${titulo}. ${nodo.innerText}`;
    }
    return titulo;
  };

  const volver = () => {
    if (router.canGoBack()) router.back();
    else if (volverA) router.replace(volverA);
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
          <View
            accessibilityRole="banner"
            style={{ paddingTop: espacio.l, paddingBottom: espacio.m, gap: espacio.m }}
          >
            <View style={{ flexDirection: 'row', gap: espacio.s, flexWrap: 'wrap' }}>
              {volverA !== false ? (
                <Boton
                  etiqueta="Volver"
                  accessibilityRole="button"
                  accessibilityLabel="Volver a la pantalla anterior"
                  variante="secundaria"
                  onPress={volver}
                  style={{ flexGrow: 1, flexBasis: 120 }}
                />
              ) : null}
              <View style={{ flexGrow: 2, flexBasis: 160 }}>
                <BotonEscuchar texto={textoParaLeer} />
              </View>
            </View>
            <Titulo nivel={1}>{titulo}</Titulo>
          </View>
          <View accessibilityRole="main" ref={contenido}>
            {ejemplo ? <MarcaEjemplo texto={typeof ejemplo === 'string' ? ejemplo : undefined} /> : null}
            {children}
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
