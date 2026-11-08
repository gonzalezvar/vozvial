import { useId, useState } from 'react';
import { TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { useTema } from './estadoAjustes';
import { aria, estiloFoco } from './foco';
import { Icono } from './Icono';
import { Texto } from './Texto';

export interface PropsCampoTexto {
  etiqueta: string;
  valor: string;
  alCambiar: (texto: string) => void;
  /** Por defecto es la etiqueta visible. */
  accessibilityLabel?: string;
  ayuda?: string;
  error?: string | null;
  /** Campo leido con baja confianza (OCR): se resalta y pide revision. */
  dudoso?: boolean;
  teclado?: KeyboardTypeOptions;
  secreto?: boolean;
  multilinea?: boolean;
  maxLength?: number;
  placeholder?: string;
  autoComplete?: 'off' | 'name' | 'tel' | 'one-time-code';
  /** Se llama al salir del campo: ahi se valida por primera vez (no mientras se escribe). */
  alSalir?: () => void;
  /** Al tocar "Enter" en el teclado. */
  alEnviar?: () => void;
  testID?: string;
}

/** Campo con etiqueta visible, ayuda y mensaje de error asociados al control. */
export function CampoTexto({
  etiqueta,
  valor,
  alCambiar,
  accessibilityLabel,
  ayuda,
  error,
  dudoso,
  teclado,
  secreto,
  multilinea,
  maxLength,
  placeholder,
  autoComplete,
  alSalir,
  alEnviar,
  testID,
}: PropsCampoTexto) {
  const tema = useTema();
  const { colores, tipo, espacio, radio, medidas } = tema;
  const [enfocado, setEnfocado] = useState(false);
  const id = useId().replace(/:/g, '');
  const idEtiqueta = `campo-${id}-etiqueta`;
  const idAyuda = `campo-${id}-ayuda`;
  const idError = `campo-${id}-error`;
  const idDudoso = `campo-${id}-dudoso`;
  const describe = [ayuda ? idAyuda : null, dudoso ? idDudoso : null, error ? idError : null]
    .filter(Boolean)
    .join(' ');

  const colorBorde = error ? colores.peligro : dudoso ? colores.avisoTexto : enfocado ? colores.primario : colores.borde;

  return (
    <View style={{ gap: espacio.s, marginBottom: espacio.l }}>
      <Texto negrita nativeID={idEtiqueta}>
        {etiqueta}
      </Texto>
      {ayuda ? (
        <Texto variante="nota" color="textoSuave" nativeID={idAyuda}>
          {ayuda}
        </Texto>
      ) : null}
      {dudoso ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s, backgroundColor: colores.avisoSuave, borderRadius: radio.s, paddingHorizontal: espacio.ms, paddingVertical: espacio.s }}>
          <Icono nombre="alerta" color="avisoTexto" />
          <Texto negrita color="avisoTexto" nativeID={idDudoso} style={{ flex: 1 }}>
            Revisa este dato
          </Texto>
        </View>
      ) : null}
      <TextInput
        accessibilityLabel={accessibilityLabel ?? etiqueta}
        {...aria({ 'aria-describedby': describe || undefined, 'aria-invalid': error ? true : undefined })}
        value={valor}
        onChangeText={alCambiar}
        onFocus={() => setEnfocado(true)}
        onBlur={() => {
          setEnfocado(false);
          alSalir?.();
        }}
        onSubmitEditing={alEnviar ? () => alEnviar() : undefined}
        keyboardType={teclado}
        secureTextEntry={secreto}
        multiline={multilinea}
        maxLength={maxLength}
        placeholder={placeholder}
        placeholderTextColor={colores.textoSuave}
        autoComplete={autoComplete}
        testID={testID}
        style={{
          minHeight: multilinea ? medidas.altoMinimoBoton * 2 : medidas.altoMinimoBoton,
          fontSize: tipo.base,
          lineHeight: tipo.alturaLinea(tipo.base),
          color: colores.texto,
          backgroundColor: dudoso ? colores.avisoSuave : colores.superficie,
          borderColor: colorBorde,
          borderWidth: 2,
          borderRadius: radio.m,
          paddingHorizontal: espacio.m,
          paddingVertical: espacio.ms,
          textAlignVertical: multilinea ? 'top' : 'center',
          // El anillo de foco va por fuera del borde para que el campo no cambie de tamano.
          ...(enfocado ? estiloFoco(tema) : null),
        }}
      />
      {error ? (
        <View
          accessibilityRole="alert"
          style={{ flexDirection: 'row', alignItems: 'flex-start', gap: espacio.s, backgroundColor: colores.peligroSuave, borderRadius: radio.s, paddingHorizontal: espacio.ms, paddingVertical: espacio.s }}
        >
          <Icono nombre="alerta" color="peligroTexto" style={{ marginTop: 2 }} />
          <Texto negrita color="peligroTexto" nativeID={idError} style={{ flex: 1 }}>
            {error}
          </Texto>
        </View>
      ) : null}
    </View>
  );
}
