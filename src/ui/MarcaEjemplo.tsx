import { View } from 'react-native';

import { useTema } from './estadoAjustes';
import { Texto } from './Texto';

/** Franja que declara que la pantalla muestra datos simulados (diseno rapido). */
export function MarcaEjemplo({ texto }: { texto?: string }) {
  const { colores, espacio, radio } = useTema();
  return (
    <View
      accessibilityRole="note"
      testID="marca-ejemplo"
      style={{
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: colores.avisoTexto,
        backgroundColor: colores.avisoSuave,
        borderRadius: radio.s,
        padding: espacio.m,
        marginBottom: espacio.l,
      }}
    >
      <Texto negrita color="avisoTexto">
        Ejemplo
      </Texto>
      <Texto variante="nota" color="avisoTexto">
        {texto ?? 'Esta pantalla muestra datos simulados. Todavía no guarda ni consulta nada.'}
      </Texto>
    </View>
  );
}
