import { useEffect, useRef, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { servicioLecturaVoz } from '../services/ServicioLecturaVoz';

import { Boton } from './Boton';
import { Texto } from './Texto';

interface PropsBotonEscuchar {
  /** Texto a leer, o una funcion que lo arma en el momento de tocar. */
  texto: string | (() => string);
  /** Que se lee, para la etiqueta accesible. Por ejemplo "esta pantalla". */
  que?: string;
  etiqueta?: string;
  /** tonal es la del encabezado; secundaria, la de un boton dentro del contenido. */
  variante?: 'primaria' | 'secundaria' | 'tonal';
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** Lee en voz alta en espanol (es-CO). Mientras lee, el boton dice "Detener". */
export function BotonEscuchar({ texto, que = 'esta pantalla', etiqueta = 'Escuchar', variante = 'secundaria', testID, style }: PropsBotonEscuchar) {
  const [leyendo, setLeyendo] = useState(false);
  const [sinVoz, setSinVoz] = useState(false);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
      // Si se sale de la pantalla mientras lee, se calla.
      servicioLecturaVoz.detener();
    };
  }, []);

  const alternar = () => {
    if (leyendo) {
      servicioLecturaVoz.detener();
      setLeyendo(false);
      return;
    }
    const contenido = typeof texto === 'function' ? texto() : texto;
    setLeyendo(true);
    const empezo = servicioLecturaVoz.leer(contenido, {
      alTerminar: () => {
        if (montado.current) setLeyendo(false);
      },
    });
    setSinVoz(!empezo && !servicioLecturaVoz.disponible());
  };

  return (
    <View style={[{ gap: 4 }, style]}>
      <Boton
        icono={leyendo ? 'detener' : 'escuchar'}
        etiqueta={leyendo ? 'Detener' : etiqueta}
        accessibilityRole="button"
        accessibilityLabel={leyendo ? `Detener la lectura de ${que}` : `${etiqueta}: leer en voz alta ${que}`}
        variante={leyendo ? 'primaria' : variante}
        onPress={alternar}
        testID={testID}
      />
      {sinVoz ? (
        <Texto variante="nota" color="peligroTexto" accessibilityLiveRegion="polite">
          Este navegador no puede leer en voz alta. Prueba con Chrome.
        </Texto>
      ) : null}
    </View>
  );
}
