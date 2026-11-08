import type { Href } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Boton } from './Boton';
import { useTema } from './estadoAjustes';
import { Icono } from './Icono';
import type { NombreIcono } from './iconos';
import type { NombreColor } from './tema';
import { Texto, Titulo } from './Texto';

/**
 * urgente: un plazo que vence o algo que pide actuar ya.
 * aviso: algo que conviene revisar.
 * info: explicacion o dato util.
 * exito: algo que salio bien.
 * peligro: un error que impide seguir.
 */
export type TonoAlerta = 'urgente' | 'aviso' | 'info' | 'exito' | 'peligro';

interface PropsAlerta {
  titulo: string;
  children?: ReactNode;
  tono?: TonoAlerta;
  /** Reemplaza el icono del tono. */
  icono?: NombreIcono;
  /** Si es true, el lector de pantalla la anuncia al aparecer. */
  anunciar?: boolean;
  accion?: { etiqueta: string; accessibilityLabel: string; href?: Href; onPress?: () => void; icono?: NombreIcono };
  testID?: string;
}

const ESTILOS: Record<TonoAlerta, { fondo: NombreColor; franja: NombreColor; texto: NombreColor; icono: NombreIcono }> = {
  urgente: { fondo: 'urgenciaSuave', franja: 'urgencia', texto: 'urgenciaTexto', icono: 'reloj' },
  aviso: { fondo: 'avisoSuave', franja: 'avisoTexto', texto: 'avisoTexto', icono: 'alerta' },
  info: { fondo: 'primarioSuave', franja: 'primario', texto: 'primario', icono: 'info' },
  exito: { fondo: 'exitoSuave', franja: 'exitoTexto', texto: 'exitoTexto', icono: 'check' },
  peligro: { fondo: 'peligroSuave', franja: 'peligro', texto: 'peligroTexto', icono: 'alerta' },
};

/** Recuadro destacado con icono, titulo y texto. Pensado para plazos (CA-12.1 y CA-12.2) y avisos. */
export function Alerta({ titulo, children, tono = 'urgente', icono, anunciar, accion, testID }: PropsAlerta) {
  const { colores, espacio, radio } = useTema();
  const e = ESTILOS[tono];
  return (
    <View
      accessibilityRole={anunciar ? 'alert' : undefined}
      testID={testID}
      style={{
        backgroundColor: colores[e.fondo],
        borderLeftWidth: 6,
        borderLeftColor: colores[e.franja],
        borderRadius: radio.l,
        padding: espacio.m,
        gap: espacio.s,
        marginBottom: espacio.m,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: espacio.s }}>
        <Icono nombre={icono ?? e.icono} color={e.texto} style={{ marginTop: 2 }} />
        <Titulo nivel={2} tamanoVisual={3} color={e.texto} style={{ flex: 1 }}>
          {titulo}
        </Titulo>
      </View>
      {typeof children === 'string' ? <Texto>{children}</Texto> : children}
      {accion ? (
        <Boton
          etiqueta={accion.etiqueta}
          accessibilityLabel={accion.accessibilityLabel}
          accessibilityRole={accion.href ? 'link' : 'button'}
          href={accion.href}
          onPress={accion.onPress}
          icono={accion.icono}
          variante="secundaria"
        />
      ) : null}
    </View>
  );
}
