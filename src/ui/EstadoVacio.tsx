import type { Href } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { Boton } from './Boton';
import { useTema } from './estadoAjustes';
import { Icono } from './Icono';
import type { NombreIcono } from './iconos';
import { Texto, Titulo } from './Texto';

interface AccionEstado {
  etiqueta: string;
  accessibilityLabel: string;
  href?: Href;
  onPress?: () => void;
  icono?: NombreIcono;
  testID?: string;
}

interface PropsEstadoVacio {
  /** Que va aqui. Ejemplo: "Todavia no tienes casos". */
  titulo: string;
  /** Una frase sobre para que sirve llenarlo. */
  texto: string;
  icono?: NombreIcono;
  /** La accion para empezar. Siempre que exista una, ponla. */
  accion?: AccionEstado;
  /** Una segunda accion de menos peso. */
  accionSecundaria?: AccionEstado;
  testID?: string;
}

/** Estado vacio dentro del marco de la seccion: icono, titulo, frase y la accion para empezar. */
export function EstadoVacio({ titulo, texto, icono = 'casos', accion, accionSecundaria, testID }: PropsEstadoVacio) {
  const { colores, espacio, radio, medidas } = useTema();
  return (
    <View
      testID={testID}
      style={{
        backgroundColor: colores.superficie,
        borderWidth: 1,
        borderColor: colores.bordeSuave,
        borderRadius: radio.l,
        padding: espacio.l,
        gap: espacio.ms,
        alignItems: 'stretch',
        marginBottom: espacio.m,
      }}
    >
      <View
        style={{
          width: medidas.cajaIcono + 8,
          height: medidas.cajaIcono + 8,
          borderRadius: radio.circulo,
          backgroundColor: colores.superficieAlterna,
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: 'center',
        }}
      >
        <Icono nombre={icono} color="textoSuave" tamano={28} />
      </View>
      <Titulo nivel={2} tamanoVisual={3} centrado>
        {titulo}
      </Titulo>
      <Texto color="textoSuave" centrado>
        {texto}
      </Texto>
      {accion ? (
        <Boton
          etiqueta={accion.etiqueta}
          accessibilityLabel={accion.accessibilityLabel}
          accessibilityRole={accion.href ? 'link' : 'button'}
          href={accion.href}
          onPress={accion.onPress}
          icono={accion.icono}
          testID={accion.testID}
          style={{ marginTop: espacio.s }}
        />
      ) : null}
      {accionSecundaria ? (
        <Boton
          etiqueta={accionSecundaria.etiqueta}
          accessibilityLabel={accionSecundaria.accessibilityLabel}
          accessibilityRole={accionSecundaria.href ? 'link' : 'button'}
          href={accionSecundaria.href}
          onPress={accionSecundaria.onPress}
          icono={accionSecundaria.icono}
          testID={accionSecundaria.testID}
          variante="secundaria"
        />
      ) : null}
    </View>
  );
}

/** Indicador de carga con texto: dice que se esta haciendo, no solo que algo gira. */
export function Cargando({ texto, testID }: { texto: string; testID?: string }) {
  const { colores, espacio } = useTema();
  return (
    <View
      testID={testID}
      accessibilityLiveRegion="polite"
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espacio.ms, paddingVertical: espacio.l }}
    >
      <ActivityIndicator size="large" color={colores.primario} accessibilityLabel={texto} />
      <Texto color="textoSuave">{texto}</Texto>
    </View>
  );
}
