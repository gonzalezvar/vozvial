import { useState } from 'react';
import { View } from 'react-native';

import { Alerta, Boton, CampoTexto, Pantalla, Tarjeta, Texto, Titulo, useTema } from '../../../src/ui';
import { NOMBRE_EJEMPLO } from '../../../src/ui/ejemplos';

export default function Solicitud() {
  const { colores, espacio, radio } = useTema();
  const [cedula, setCedula] = useState('');
  const [vistaPrevia, setVistaPrevia] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  return (
    <Pantalla titulo="Solicitud de audiencia" volverA="/casos" ejemplo="Simulación: todavía no se genera el PDF.">
      <Texto style={{ marginBottom: espacio.m }}>
        Con este documento pides la audiencia para decir que no estás de acuerdo con el comparendo. Tú lo presentas ante
        el organismo de tránsito.
      </Texto>

      {!vistaPrevia ? (
        <Alerta titulo="Falta un dato" tono="aviso" testID="datos-faltantes">
          <Texto>Para generar la solicitud falta tu cédula.</Texto>
        </Alerta>
      ) : null}

      <CampoTexto etiqueta="Tu cédula" valor={cedula} alCambiar={setCedula} teclado="number-pad" maxLength={10} />

      <Boton
        etiqueta="Generar solicitud"
        accessibilityRole="button"
        accessibilityLabel="Generar solicitud"
        onPress={() => setVistaPrevia(true)}
        style={{ marginBottom: espacio.l }}
        testID="generar-solicitud"
      />

      {vistaPrevia ? (
        <>
          <Titulo nivel={2}>Vista previa</Titulo>
          <View
            testID="vista-previa"
            style={{
              backgroundColor: colores.superficie,
              borderWidth: 1,
              borderColor: colores.borde,
              borderRadius: radio.s,
              padding: espacio.l,
              marginVertical: espacio.m,
              gap: espacio.s,
            }}
          >
            <Texto negrita centrado>
              Solicitud de audiencia (ejemplo)
            </Texto>
            <Texto variante="nota">Señores: organismo de tránsito (ejemplo)</Texto>
            <Texto variante="nota">
              Yo, {NOMBRE_EJEMPLO} (ejemplo), con cédula {cedula || '________'}, solicito audiencia por el comparendo
              000000000000 (ejemplo).
            </Texto>
            <Texto variante="nota" negrita>
              Evidencias
            </Texto>
            <Texto variante="nota">1. Audio de 3:12. 2. Foto. 3. Nota.</Texto>
            <Texto variante="nota" negrita>
              Normas citadas
            </Texto>
            <Texto variante="nota">Norma y artículo de la base verificada (ejemplo).</Texto>
          </View>
          <Tarjeta>
            <Boton
              etiqueta="Descargar PDF"
              accessibilityRole="button"
              accessibilityLabel="Descargar PDF de la solicitud"
              onPress={() => setMensaje('En el prototipo final se descarga solicitud-audiencia-<numero>.pdf.')}
            />
          </Tarjeta>
        </>
      ) : null}

      {mensaje ? (
        <Alerta titulo="Descarga simulada" tono="info" anunciar>
          {mensaje}
        </Alerta>
      ) : null}
    </Pantalla>
  );
}
