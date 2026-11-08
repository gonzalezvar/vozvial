import type { Href } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Boton } from './Boton';
import { useTema } from './estadoAjustes';
import { Texto, Titulo } from './Texto';

type TonoAlerta = 'urgente' | 'aviso' | 'info' | 'exito';

interface PropsAlerta {
  titulo: string;
  children?: ReactNode;
  tono?: TonoAlerta;
  /** Si es true, el lector de pantalla la anuncia al aparecer. */
  anunciar?: boolean;
  accion?: { etiqueta: string; accessibilityLabel: string; href?: Href; onPress?: () => void };
  testID?: string;
}

/** Recuadro destacado, pensado para plazos (CA-12.1 y CA-12.2). */
export function Alerta({ titulo, children, tono = 'urgente', anunciar, accion, testID }: PropsAlerta) {
  const { colores, espacio, radio } = useTema();
  const estilos = {
    urgente: { fondo: colores.urgenciaSuave, franja: colores.urgencia, texto: 'urgenciaTexto' },
    aviso: { fondo: colores.avisoSuave, franja: colores.avisoTexto, texto: 'avisoTexto' },
    info: { fondo: colores.primarioSuave, franja: colores.primario, texto: 'primario' },
    exito: { fondo: colores.exitoSuave, franja: colores.exitoTexto, texto: 'exitoTexto' },
  } as const;
  const e = estilos[tono];
  return (
    <View
      accessibilityRole={anunciar ? 'alert' : undefined}
      testID={testID}
      style={{
        backgroundColor: e.fondo,
        borderLeftWidth: 8,
        borderLeftColor: e.franja,
        borderRadius: radio.m,
        padding: espacio.m,
        gap: espacio.s,
        marginBottom: espacio.m,
      }}
    >
      <Titulo nivel={2} color={e.texto}>
        {titulo}
      </Titulo>
      {typeof children === 'string' ? <Texto>{children}</Texto> : children}
      {accion ? (
        <Boton
          etiqueta={accion.etiqueta}
          accessibilityLabel={accion.accessibilityLabel}
          accessibilityRole={accion.href ? 'link' : 'button'}
          href={accion.href}
          onPress={accion.onPress}
          variante="secundaria"
        />
      ) : null}
    </View>
  );
}
