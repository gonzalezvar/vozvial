import { useState } from 'react';

import { Alerta, Boton, CampoTexto, Pantalla, Seccion, Tarjeta, Texto, useTema } from '../../../src/ui';
import { NOMBRE_EJEMPLO } from '../../../src/ui/ejemplos';
import { AyudaPantalla } from '../../../src/ui/guia/AyudaPantalla';

export default function Solicitud() {
  const { espacio } = useTema();
  const [cedula, setCedula] = useState('');
  const [vistaPrevia, setVistaPrevia] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  return (
    <Pantalla
      titulo="Solicitud de audiencia"
      descripcion="Con este documento pides la audiencia para decir que no estás de acuerdo con el comparendo. Tú lo presentas ante el organismo de tránsito."
      volverA="/casos"
      ejemplo="Simulación: todavía no se genera el PDF."
      extraEncabezado={<AyudaPantalla pantalla="solicitud" />}
    >
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
        icono="solicitud"
        variante={vistaPrevia ? 'secundaria' : 'primaria'}
        onPress={() => setVistaPrevia(true)}
        testID="generar-solicitud"
      />

      {vistaPrevia ? (
        <Seccion titulo="Vista previa" descripcion="Así se verá el documento. Los datos son de ejemplo." style={{ marginTop: espacio.xl }}>
          <Tarjeta testID="vista-previa" style={{ marginBottom: 0 }}>
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
          </Tarjeta>
          <Boton
            etiqueta="Descargar PDF"
            accessibilityRole="button"
            accessibilityLabel="Descargar PDF de la solicitud"
            icono="descargar"
            onPress={() => setMensaje('En el prototipo final se descarga solicitud-audiencia-<numero>.pdf.')}
          />
        </Seccion>
      ) : null}

      {mensaje ? (
        <Alerta titulo="Descarga simulada" tono="info" anunciar>
          {mensaje}
        </Alerta>
      ) : null}
    </Pantalla>
  );
}
