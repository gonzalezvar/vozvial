import { router, type Href } from 'expo-router';
import { Children, isValidElement, useState, type ReactNode } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { EtiquetaEstado, type TonoEstado } from './EtiquetaEstado';
import { useTema } from './estadoAjustes';
import { estiloFoco } from './foco';
import { Icono } from './Icono';
import type { NombreIcono } from './iconos';
import { Texto } from './Texto';

interface PropsLista {
  children: ReactNode;
  /** Nombre del grupo para el lector de pantalla. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Marco de lista: superficie blanca con borde fino y una linea entre filas. Agrupa ListaItem. */
export function Lista({ children, accessibilityLabel, style, testID }: PropsLista) {
  const { colores, radio, espacio, elevacion } = useTema();
  const filas = Children.toArray(children).filter(isValidElement);
  return (
    <View
      accessibilityRole="list"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={[
        {
          backgroundColor: colores.superficie,
          borderWidth: 1,
          borderColor: colores.bordeSuave,
          borderRadius: radio.l,
          overflow: 'hidden',
          marginBottom: espacio.m,
        },
        elevacion.baja,
        style,
      ]}
    >
      {/* En web la lista es <ul> y solo puede contener <li>: la linea entre filas va dentro de cada una. */}
      {filas.map((fila, i) => (
        <View key={fila.key ?? i} accessibilityRole="listitem" style={{ borderTopWidth: i > 0 ? 1 : 0, borderTopColor: colores.bordeSuave }}>
          {fila}
        </View>
      ))}
    </View>
  );
}

interface PropsListaItem {
  titulo: string;
  /** Linea de apoyo bajo el titulo. */
  descripcion?: string;
  /** Dato pequeno al final (fecha, duracion). */
  meta?: string;
  icono?: NombreIcono;
  /** Estado visible bajo el titulo, con texto y tono. */
  estado?: { texto: string; tono: TonoEstado };
  /** Navega a la ruta. Con href o onPress la fila entera se puede tocar y muestra la flecha. */
  href?: Href;
  onPress?: () => void;
  /** Por defecto: "link" si hay href, "button" si solo hay onPress. */
  accessibilityRole?: 'link' | 'button';
  /** Por defecto se arma con titulo, estado, descripcion y meta. */
  accessibilityLabel?: string;
  /** Pinta titulo e icono en rojo (por ejemplo "Cerrar sesion"). */
  peligro?: boolean;
  /** Contenido extra bajo el texto (por ejemplo un reproductor). */
  children?: ReactNode;
  /** Va en la vista que envuelve la fila, asi fila.getByRole('link') encuentra el control. */
  testID?: string;
}

/** Fila de lista: icono, titulo, descripcion, estado y flecha. Toda la fila se puede tocar. */
export function ListaItem({
  titulo,
  descripcion,
  meta,
  icono,
  estado,
  href,
  onPress,
  accessibilityRole,
  accessibilityLabel,
  peligro,
  children,
  testID,
}: PropsListaItem) {
  const tema = useTema();
  const { colores, espacio, radio, medidas, tipo, peso } = tema;
  const [enfocado, setEnfocado] = useState(false);
  const interactiva = !!href || !!onPress;
  const colorTitulo = peligro ? 'peligroTexto' : 'texto';
  const etiqueta =
    accessibilityLabel ?? [titulo, estado?.texto, descripcion, meta].filter((x): x is string => !!x).join('. ');

  const contenido = (
    <>
      {icono ? (
        <View
          style={{
            width: medidas.cajaIcono,
            height: medidas.cajaIcono,
            borderRadius: radio.m,
            backgroundColor: peligro ? colores.peligroSuave : colores.primarioSuave,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icono nombre={icono} color={peligro ? 'peligroTexto' : 'primario'} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: espacio.xs }}>
        {/* Titulo y descripcion en un solo bloque para que el nombre accesible contenga el texto visible. */}
        <Texto negrita color={colorTitulo}>
          {titulo}
          {descripcion ? (
            <Text style={{ fontSize: tipo.nota, lineHeight: tipo.alturaLinea(tipo.nota), fontWeight: peso.normal, color: colores.textoSuave }}>
              {`\n${descripcion}`}
            </Text>
          ) : null}
        </Texto>
        {estado ? <EtiquetaEstado texto={estado.texto} tono={estado.tono} /> : null}
        {meta ? (
          <Texto variante="nota" color="textoSuave">
            {meta}
          </Texto>
        ) : null}
        {children}
      </View>
      {interactiva ? <Icono nombre="siguiente" color={peligro ? 'peligroTexto' : 'primario'} respaldo="›" /> : null}
    </>
  );

  const estiloFila: ViewStyle = {
    minHeight: medidas.altoMinimoFila,
    paddingVertical: espacio.ms,
    paddingHorizontal: espacio.m,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
  };

  if (!interactiva) {
    return (
      <View testID={testID} style={estiloFila}>
        {contenido}
      </View>
    );
  }

  return (
    <View testID={testID}>
      <Pressable
        accessibilityRole={accessibilityRole ?? (href ? 'link' : 'button')}
        accessibilityLabel={etiqueta}
        onPress={() => {
          onPress?.();
          if (href) router.push(href);
        }}
        onFocus={() => setEnfocado(true)}
        onBlur={() => setEnfocado(false)}
        style={({ pressed }) => [
          estiloFila,
          { backgroundColor: pressed ? (peligro ? colores.peligroSuave : colores.primarioSuave) : colores.superficie },
          enfocado && { ...estiloFoco(tema), outlineOffset: -3 },
        ]}
      >
        {contenido}
      </Pressable>
    </View>
  );
}

interface Dato {
  etiqueta: string;
  valor: string;
  testID?: string;
}

/**
 * Pares etiqueta / valor (Numero, Fecha, Placa...). La etiqueta va arriba en gris y el valor debajo
 * en negro: se lee en una columna, sin tablas. Si una prueba espera "Etiqueta: valor" en un solo
 * texto, usa Texto con ese formato en vez de este componente.
 */
export function ListaDatos({ datos, testID }: { datos: readonly Dato[]; testID?: string }) {
  const { colores, espacio } = useTema();
  return (
    <View testID={testID} style={{ gap: 0 }}>
      {datos.map((d, i) => (
        <View
          key={`${d.etiqueta}-${i}`}
          testID={d.testID}
          style={{
            paddingVertical: espacio.s,
            borderTopWidth: i === 0 ? 0 : 1,
            borderTopColor: colores.bordeSuave,
          }}
        >
          <Texto variante="nota" color="textoSuave">
            {d.etiqueta}
          </Texto>
          <Texto negrita>{d.valor}</Texto>
        </View>
      ))}
    </View>
  );
}
