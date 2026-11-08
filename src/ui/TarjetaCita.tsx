import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { Boton } from './Boton';
import { useTema } from './estadoAjustes';
import { aria, estiloFoco } from './foco';
import { Icono } from './Icono';
import { Texto } from './Texto';

/** Compatible con Cita de src/core (RespuestaAsistente.citas). */
export interface DatosCita {
  id: string;
  norma: string;
  articulo: string;
  titulo: string;
  textoLiteral: string;
  /** Cadena vacia si no hay enlace (solo en ejemplos). */
  urlFuente: string;
  /** ISO AAAA-MM-DD. */
  fechaConsulta: string;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// Formato de presentacion sin Date para no depender del huso horario del navegador.
function fechaLegible(iso: string): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!partes) return iso;
  const mes = MESES[Number(partes[2]) - 1];
  return mes ? `${Number(partes[3])} de ${mes} de ${partes[1]}` : iso;
}

/**
 * Tarjeta de cita normativa. La franja de color marca que es una fuente; al tocarla despliega el
 * texto literal, la fecha de consulta y el enlace oficial.
 */
export function TarjetaCita({ cita, testID }: { cita: DatosCita; testID?: string }) {
  const tema = useTema();
  const { colores, espacio, radio, medidas, tipo, peso } = tema;
  const [abierta, setAbierta] = useState(false);
  const [enfocado, setEnfocado] = useState(false);
  const idDetalle = `cita-${cita.id.replace(/[^A-Za-z0-9_-]/g, '')}-detalle`;
  const encabezado = `${cita.norma}, artículo ${cita.articulo}`;
  const accion = abierta ? 'Ocultar texto literal' : 'Ver texto literal';

  return (
    <View
      testID={testID}
      style={{
        backgroundColor: colores.superficie,
        borderColor: colores.bordeSuave,
        borderWidth: 1,
        borderLeftWidth: 6,
        borderLeftColor: colores.primario,
        borderRadius: radio.l,
        marginBottom: espacio.m,
        overflow: 'hidden',
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${encabezado}. ${cita.titulo}. ${accion}`}
        aria-expanded={abierta}
        {...aria({ 'aria-controls': abierta ? idDetalle : undefined })}
        onPress={() => setAbierta((a) => !a)}
        onFocus={() => setEnfocado(true)}
        onBlur={() => setEnfocado(false)}
        style={({ pressed }) => [
          {
            minHeight: medidas.altoMinimoBoton,
            padding: espacio.m,
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: espacio.ms,
            backgroundColor: pressed ? colores.primarioSuave : colores.superficie,
          },
          enfocado && estiloFoco(tema),
        ]}
      >
        <Icono nombre="ley" color="primario" style={{ marginTop: 2 }} />
        {/* Un solo bloque de texto para que el nombre accesible contenga el texto visible. */}
        <Texto negrita color="primario" style={{ flex: 1 }}>
          {encabezado}
          <Text style={{ color: colores.texto, fontWeight: peso.normal }}>{`\n${cita.titulo}`}</Text>
          <Text style={{ fontSize: tipo.nota, lineHeight: tipo.alturaLinea(tipo.nota), textDecorationLine: 'underline' }}>{`\n${accion}`}</Text>
        </Texto>
        <Icono nombre={abierta ? 'arriba' : 'abajo'} color="primario" respaldo={abierta ? '▴' : '▾'} style={{ marginTop: 2 }} />
      </Pressable>
      {abierta ? (
        <View nativeID={idDetalle} style={{ paddingHorizontal: espacio.m, paddingBottom: espacio.m, gap: espacio.ms }}>
          <View
            style={{
              backgroundColor: colores.superficieAlterna,
              padding: espacio.m,
              borderRadius: radio.m,
            }}
          >
            <Texto>{cita.textoLiteral}</Texto>
          </View>
          <Texto variante="nota" color="textoSuave">
            Consultado el {fechaLegible(cita.fechaConsulta)}.
          </Texto>
          {cita.urlFuente ? (
            <Boton
              etiqueta="Ver texto oficial"
              accessibilityRole="link"
              accessibilityLabel={`Ver texto oficial de ${encabezado} (se abre en otra pestaña)`}
              variante="secundaria"
              iconoFinal="externo"
              onPress={() => void Linking.openURL(cita.urlFuente)}
            />
          ) : (
            <Texto variante="nota" color="textoSuave">
              Esta cita es de ejemplo y no tiene enlace.
            </Texto>
          )}
        </View>
      ) : null}
    </View>
  );
}
