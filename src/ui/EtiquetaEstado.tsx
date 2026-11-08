import { View } from 'react-native';

import { useTema } from './estadoAjustes';
import { aria } from './foco';
import type { NombreColor } from './tema';
import { Texto } from './Texto';

export type TonoEstado = 'urgente' | 'aviso' | 'exito' | 'neutro' | 'vencido';

const ESTILOS: Record<TonoEstado, { fondo: NombreColor; texto: NombreColor; punto: NombreColor }> = {
  urgente: { fondo: 'urgenciaSuave', texto: 'urgenciaTexto', punto: 'urgencia' },
  aviso: { fondo: 'avisoSuave', texto: 'avisoTexto', punto: 'avisoTexto' },
  exito: { fondo: 'exitoSuave', texto: 'exitoTexto', punto: 'exitoTexto' },
  neutro: { fondo: 'superficieAlterna', texto: 'textoSuave', punto: 'textoSuave' },
  vencido: { fondo: 'peligroSuave', texto: 'peligroTexto', punto: 'peligro' },
};

/**
 * Etiqueta corta de estado (no se toca). El texto siempre dice el estado; el color y el punto solo
 * lo refuerzan. Sin borde para que no parezca un boton.
 */
export function EtiquetaEstado({ texto, tono = 'neutro', testID }: { texto: string; tono?: TonoEstado; testID?: string }) {
  const { colores, espacio, radio } = useTema();
  const e = ESTILOS[tono];
  return (
    <View
      testID={testID}
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: espacio.s,
        backgroundColor: colores[e.fondo],
        borderRadius: radio.s,
        paddingHorizontal: espacio.ms,
        paddingVertical: 2,
      }}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no"
        {...aria({ 'aria-hidden': true })}
        style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colores[e.punto] }}
      />
      <Texto variante="nota" negrita color={e.texto}>
        {texto}
      </Texto>
    </View>
  );
}
