import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useSesion } from '../../src/state/sesion';
import { Boton, BotonEscuchar, Icono, Pantalla, Texto, Titulo, useTema } from '../../src/ui';
import { aria } from '../../src/ui/foco';
import { PASOS_RECORRIDO, textoParaEscuchar, type PasoRecorrido } from '../../src/ui/guia/contenidoGuia';
import { marcarRecorridoVisto } from '../../src/ui/guia/marcasGuia';
import { RecorridoGuia } from '../../src/ui/guia/RecorridoGuia';

// Recorrido de bienvenida: cinco pasos grandes con "Siguiente", "Atrás" y "Saltar".
// Es publico: se abre desde la bienvenida antes de crear la cuenta o desde el inicio con sesion.
export default function Guia() {
  const { espacio } = useTema();
  const parametros = useLocalSearchParams<{ paso?: string }>();
  const [recorrido, setRecorrido] = useState(() => RecorridoGuia.desdeParametro(PASOS_RECORRIDO.length, parametros.paso));
  const conSesion = useSesion((s) => s.claveDatos !== null);
  const paso = PASOS_RECORRIDO[recorrido.indice] ?? PASOS_RECORRIDO[0]!;

  // Saltar o terminar con sesion vuelve a donde estaba; sin sesion, a la bienvenida.
  const salir = () => {
    marcarRecorridoVisto();
    if (router.canGoBack()) router.back();
    else router.replace(conSesion ? '/inicio' : '/bienvenida');
  };

  // Al final, sin sesion la accion principal es crear la cuenta y la alternativa es entrar.
  const finalPrincipal = conSesion ? (
    <Boton
      etiqueta="Ir al inicio"
      accessibilityRole="link"
      accessibilityLabel="Terminé. Ir al inicio"
      icono="inicio"
      onPress={salir}
      testID="recorrido-final"
    />
  ) : (
    <Boton
      etiqueta="Crear mi cuenta"
      accessibilityRole="link"
      accessibilityLabel="Crear mi cuenta"
      iconoFinal="siguiente"
      onPress={() => {
        marcarRecorridoVisto();
        router.replace('/registro');
      }}
      testID="recorrido-final"
    />
  );
  const finalAlterno = conSesion ? null : (
    <Boton
      etiqueta="Ya tengo cuenta"
      accessibilityRole="link"
      accessibilityLabel="Ya tengo cuenta. Entrar con mi PIN"
      variante="texto"
      onPress={() => {
        marcarRecorridoVisto();
        router.replace('/entrar');
      }}
    />
  );

  return (
    <Pantalla
      titulo="Cómo funciona VozVial"
      descripcion={`Son ${recorrido.total} pasos cortos. Puedes saltarlos cuando quieras.`}
      volverA={conSesion ? '/inicio' : '/bienvenida'}
      testID="pantalla-guia"
      pie={
        <>
          {recorrido.esUltimo ? (
            finalPrincipal
          ) : (
            <Boton
              etiqueta="Siguiente"
              accessibilityRole="button"
              accessibilityLabel="Siguiente paso"
              iconoFinal="siguiente"
              onPress={() => setRecorrido((r) => r.siguiente())}
              testID="recorrido-siguiente"
            />
          )}
          {recorrido.esPrimero ? null : (
            <Boton
              etiqueta="Atrás"
              accessibilityRole="button"
              accessibilityLabel="Atrás, paso anterior"
              variante="secundaria"
              icono="volver"
              onPress={() => setRecorrido((r) => r.atras())}
              testID="recorrido-atras"
            />
          )}
          {recorrido.esUltimo ? (
            finalAlterno
          ) : (
            <Boton
              etiqueta="Saltar"
              accessibilityRole="button"
              accessibilityLabel="Saltar el recorrido"
              variante="texto"
              onPress={salir}
              testID="recorrido-saltar"
            />
          )}
        </>
      }
    >
      <View style={{ gap: espacio.m }}>
        <IndicadorPaso recorrido={recorrido} />
        <TarjetaPaso key={paso.id} paso={paso} numero={recorrido.numero} />
      </View>
    </Pantalla>
  );
}

/** "Paso 2 de 5" en texto, y puntos decorativos que repiten la misma informacion. */
function IndicadorPaso({ recorrido }: { recorrido: RecorridoGuia }) {
  const { colores, espacio, radio } = useTema();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.m, flexWrap: 'wrap' }}>
      <Texto negrita color="primario" testID="indicador-paso" accessibilityLiveRegion="polite">
        {recorrido.textoProgreso}
      </Texto>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        {...aria({ 'aria-hidden': true })}
        style={{ flexDirection: 'row', gap: espacio.s }}
      >
        {Array.from({ length: recorrido.total }, (_, i) => (
          <View
            key={i}
            style={{
              width: i === recorrido.indice ? 28 : 12,
              height: 12,
              borderRadius: radio.circulo,
              backgroundColor: i <= recorrido.indice ? colores.primario : colores.borde,
            }}
          />
        ))}
      </View>
    </View>
  );
}

function TarjetaPaso({ paso, numero }: { paso: PasoRecorrido; numero: number }) {
  const { colores, espacio, radio, elevacion } = useTema();
  const fondoDibujo = paso.urgente ? colores.urgenciaSuave : colores.primarioSuave;
  return (
    <View
      testID={`paso-${paso.id}`}
      style={[
        { backgroundColor: colores.superficie, borderColor: colores.bordeSuave, borderWidth: 1, borderRadius: radio.l, overflow: 'hidden' },
        elevacion.baja,
      ]}
    >
      {/* Dibujo simple: el icono del paso en un circulo, sobre una franja de color suave. */}
      <View style={{ backgroundColor: fondoDibujo, alignItems: 'center', justifyContent: 'center', paddingVertical: espacio.l }}>
        <View
          style={{
            width: 112,
            height: 112,
            borderRadius: radio.circulo,
            backgroundColor: colores.superficie,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icono nombre={paso.icono} color={paso.urgente ? 'urgencia' : 'primario'} tamano={56} />
        </View>
      </View>
      <View style={{ padding: espacio.l, gap: espacio.ms }}>
        <Titulo nivel={2}>{paso.titulo}</Titulo>
        {paso.frases.map((frase) => (
          <Texto key={frase}>{frase}</Texto>
        ))}
        <BotonEscuchar
          texto={textoParaEscuchar(paso.titulo, paso.frases)}
          etiqueta="Escuchar este paso"
          que={`el paso ${numero}`}
          variante="tonal"
          testID="escuchar-paso"
          style={{ marginTop: espacio.s }}
        />
      </View>
    </View>
  );
}
