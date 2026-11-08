// Ayuda contextual: cada pantalla principal pone <AyudaPantalla pantalla="..." /> en extraEncabezado.
// Abre una explicacion corta de esa pantalla, con "Escuchar", y lleva a las guias si hay sesion.
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, ScrollView, View } from 'react-native';

import { useSesion } from '../../state/sesion';
import { Boton } from '../Boton';
import { BotonEscuchar } from '../BotonEscuchar';
import { useTema } from '../estadoAjustes';
import { aria } from '../foco';
import { Icono } from '../Icono';
import { Texto, Titulo } from '../Texto';

import { AYUDA_PANTALLAS, textoParaEscuchar, type IdPantallaAyuda } from './contenidoGuia';

export type { IdPantallaAyuda } from './contenidoGuia';

export interface PropsAyudaPantalla {
  pantalla: IdPantallaAyuda;
}

const ID_TITULO = 'titulo-ayuda-pantalla';

export function AyudaPantalla({ pantalla }: PropsAyudaPantalla) {
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <Boton
        etiqueta="Ayuda"
        accessibilityRole="button"
        accessibilityLabel="Ayuda de esta pantalla"
        accessibilityHint="Abre una explicación corta"
        variante="tonal"
        icono="ayuda"
        onPress={() => setAbierta(true)}
        testID="boton-ayuda-pantalla"
      />
      {abierta ? <VentanaAyuda pantalla={pantalla} alCerrar={() => setAbierta(false)} /> : null}
    </>
  );
}

/** Ventana a pantalla completa: menos distracciones que una hoja sobre la pantalla anterior. */
function VentanaAyuda({ pantalla, alCerrar }: { pantalla: IdPantallaAyuda; alCerrar: () => void }) {
  const { colores, espacio, radio, medidas } = useTema();
  const conSesion = useSesion((s) => s.claveDatos !== null);
  const ayuda = AYUDA_PANTALLAS[pantalla];

  const irAGuias = () => {
    alCerrar();
    router.push('/ayuda');
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={alCerrar} {...aria({ 'aria-labelledby': ID_TITULO })}>
      <View style={{ flex: 1, backgroundColor: colores.fondo }} testID="ventana-ayuda">
        <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: espacio.xxl }}>
          <View style={{ width: '100%', maxWidth: medidas.anchoMaximoContenido, paddingHorizontal: espacio.m }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: espacio.s, paddingTop: espacio.m, paddingBottom: espacio.l }}>
              <Boton
                etiqueta="Cerrar"
                accessibilityRole="button"
                accessibilityLabel="Cerrar la ayuda"
                variante="texto"
                icono="cerrar"
                onPress={alCerrar}
              />
              <BotonEscuchar texto={textoParaEscuchar(ayuda.titulo, ayuda.frases)} que="la ayuda de esta pantalla" variante="tonal" testID="escuchar-ayuda" />
            </View>

            <View
              style={{
                backgroundColor: colores.superficie,
                borderColor: colores.bordeSuave,
                borderWidth: 1,
                borderRadius: radio.l,
                padding: espacio.l,
                gap: espacio.m,
              }}
            >
              <View
                style={{
                  width: medidas.cajaIcono,
                  height: medidas.cajaIcono,
                  borderRadius: radio.m,
                  backgroundColor: colores.primarioSuave,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icono nombre="ayuda" color="primario" />
              </View>
              <Titulo nivel={2} nativeID={ID_TITULO}>
                {ayuda.titulo}
              </Titulo>
              <View style={{ gap: espacio.ms }} testID="texto-ayuda">
                {ayuda.frases.map((frase) => (
                  <Texto key={frase}>{frase}</Texto>
                ))}
              </View>
            </View>

            <View style={{ gap: espacio.ms, marginTop: espacio.l }}>
              <Boton etiqueta="Entendido" accessibilityRole="button" accessibilityLabel="Entendido, cerrar la ayuda" icono="check" onPress={alCerrar} testID="cerrar-ayuda" />
              {conSesion ? (
                <Boton
                  etiqueta="Ver guías paso a paso"
                  accessibilityRole="link"
                  accessibilityLabel="Ver guías paso a paso"
                  variante="secundaria"
                  icono="ayuda"
                  onPress={irAGuias}
                  testID="ir-guias"
                />
              ) : (
                <Boton
                  etiqueta="Ver cómo funciona VozVial"
                  accessibilityRole="link"
                  accessibilityLabel="Ver cómo funciona VozVial, paso a paso"
                  variante="secundaria"
                  icono="siguiente"
                  onPress={() => {
                    alCerrar();
                    router.push('/guia');
                  }}
                  testID="ir-recorrido"
                />
              )}
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
