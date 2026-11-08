import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { Boton } from './Boton';
import { useTema } from './estadoAjustes';
import { aria, estiloFoco } from './foco';
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

/** Tarjeta de cita normativa. Al tocarla despliega el texto literal, la fecha de consulta y el enlace oficial. */
export function TarjetaCita({ cita, testID }: { cita: DatosCita; testID?: string }) {
  const tema = useTema();
  const { colores, espacio, radio, medidas } = tema;
  const [abierta, setAbierta] = useState(false);
  const [enfocado, setEnfocado] = useState(false);
  const idDetalle = `cita-${cita.id.replace(/[^A-Za-z0-9_-]/g, '')}-detalle`;
  const encabezado = `${cita.norma}, artículo ${cita.articulo}`;

  return (
    <View
      testID={testID}
      style={{
        backgroundColor: colores.superficie,
        borderColor: colores.primario,
        borderWidth: 2,
        borderRadius: radio.m,
        marginBottom: espacio.m,
        overflow: 'hidden',
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${encabezado}. ${cita.titulo}. ${abierta ? 'Ocultar texto literal' : 'Ver texto literal'}`}
        aria-expanded={abierta}
        {...aria({ 'aria-controls': abierta ? idDetalle : undefined })}
        onPress={() => setAbierta((a) => !a)}
        onFocus={() => setEnfocado(true)}
        onBlur={() => setEnfocado(false)}
        style={({ pressed }) => [
          {
            minHeight: medidas.altoMinimoBoton,
            padding: espacio.m,
            gap: espacio.xs,
            backgroundColor: pressed ? colores.primarioSuave : colores.superficie,
          },
          enfocado && estiloFoco(tema),
        ]}
      >
        {/* Un solo bloque de texto para que el nombre accesible contenga el texto visible. */}
        <Texto negrita color="primario">
          {encabezado}
          <Text style={{ color: colores.texto, fontWeight: '400' }}>{`\n${cita.titulo}`}</Text>
          <Text style={{ fontSize: tema.tipo.nota }}>{`\n${abierta ? 'Ocultar texto literal' : 'Ver texto literal'}`}</Text>
        </Texto>
      </Pressable>
      {abierta ? (
        <View nativeID={idDetalle} style={{ padding: espacio.m, paddingTop: 0, gap: espacio.s }}>
          <View
            style={{
              borderLeftWidth: 4,
              borderLeftColor: colores.bordeSuave,
              backgroundColor: colores.superficieAlterna,
              padding: espacio.m,
              borderRadius: radio.s,
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
