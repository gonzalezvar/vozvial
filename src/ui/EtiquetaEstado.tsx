import { View } from 'react-native';

import { useTema } from './estadoAjustes';
import { Texto } from './Texto';

export type TonoEstado = 'urgente' | 'aviso' | 'exito' | 'neutro' | 'vencido';

/** Etiqueta corta de estado. El texto siempre dice el estado; el color solo lo refuerza. */
export function EtiquetaEstado({ texto, tono = 'neutro', testID }: { texto: string; tono?: TonoEstado; testID?: string }) {
  const { colores, espacio } = useTema();
  const estilos = {
    urgente: { fondo: colores.urgenciaSuave, texto: 'urgenciaTexto', borde: colores.urgencia },
    aviso: { fondo: colores.avisoSuave, texto: 'avisoTexto', borde: colores.avisoTexto },
    exito: { fondo: colores.exitoSuave, texto: 'exitoTexto', borde: colores.exitoTexto },
    neutro: { fondo: colores.primarioSuave, texto: 'primario', borde: colores.primario },
    vencido: { fondo: colores.peligroSuave, texto: 'peligroTexto', borde: colores.peligro },
  } as const;
  const e = estilos[tono];
  return (
    <View
      testID={testID}
      style={{
        alignSelf: 'flex-start',
        backgroundColor: e.fondo,
        borderColor: e.borde,
        borderWidth: 2,
        borderRadius: 999,
        paddingHorizontal: espacio.m,
        paddingVertical: espacio.xs,
      }}
    >
      <Texto variante="nota" negrita color={e.texto}>
        {texto}
      </Texto>
    </View>
  );
}
