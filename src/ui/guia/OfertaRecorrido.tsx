// Ofrece el recorrido una sola vez en el inicio (la primera visita tras crear la cuenta).
// No bloquea: es una tarjeta que se cierra con "Ahora no" y no vuelve a salir.
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Boton } from '../Boton';
import { useTema } from '../estadoAjustes';
import { Tarjeta } from '../Tarjeta';
import { Texto } from '../Texto';

import { PASOS_RECORRIDO } from './contenidoGuia';
import { debeOfrecerRecorrido, marcarOfertaMostrada } from './marcasGuia';

export function OfertaRecorrido() {
  const { espacio } = useTema();
  // Se decide una vez al montar: si se vuelve al inicio despues, ya no aparece.
  const [visible, setVisible] = useState(() => debeOfrecerRecorrido());

  useEffect(() => {
    if (visible) marcarOfertaMostrada();
    // Solo al montar: la marca se escribe la primera vez que se muestra.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  return (
    <Tarjeta titulo="¿Primera vez en VozVial?" icono="ayuda" variante="resaltada" testID="oferta-recorrido">
      <Texto>{`Mira en ${PASOS_RECORRIDO.length} pasos cortos cómo funciona. Tarda menos de un minuto.`}</Texto>
      <View style={{ gap: espacio.s }}>
        <Boton
          etiqueta="Ver cómo funciona"
          accessibilityRole="link"
          accessibilityLabel="Ver cómo funciona VozVial, paso a paso"
          variante="secundaria"
          iconoFinal="siguiente"
          href="/guia"
          onPress={() => setVisible(false)}
          testID="ver-recorrido"
        />
        <Boton
          etiqueta="Ahora no"
          accessibilityRole="button"
          accessibilityLabel="Ahora no, ocultar esta sugerencia"
          variante="texto"
          onPress={() => setVisible(false)}
          testID="ocultar-recorrido"
        />
      </View>
    </Tarjeta>
  );
}
