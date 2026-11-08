import { useId, useState } from 'react';
import { TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { useTema } from './estadoAjustes';
import { aria } from './foco';
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
  testID,
}: PropsCampoTexto) {
  const { colores, tipo, espacio, radio, medidas } = useTema();
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
    <View style={{ gap: espacio.xs, marginBottom: espacio.m }}>
      <Texto negrita nativeID={idEtiqueta}>
        {etiqueta}
      </Texto>
      {ayuda ? (
        <Texto variante="nota" color="textoSuave" nativeID={idAyuda}>
          {ayuda}
        </Texto>
      ) : null}
      {dudoso ? (
        <View style={{ backgroundColor: colores.avisoSuave, borderRadius: radio.s, padding: espacio.s }}>
          <Texto negrita color="avisoTexto" nativeID={idDudoso}>
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
        onBlur={() => setEnfocado(false)}
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
          borderWidth: enfocado || error || dudoso ? 3 : 2,
          borderRadius: radio.m,
          paddingHorizontal: espacio.m,
          paddingVertical: espacio.s,
          textAlignVertical: multilinea ? 'top' : 'center',
        }}
      />
      {error ? (
        <View accessibilityRole="alert" style={{ backgroundColor: colores.peligroSuave, borderRadius: radio.s, padding: espacio.s }}>
          <Texto negrita color="peligroTexto" nativeID={idError}>
            {error}
          </Texto>
        </View>
      ) : null}
    </View>
  );
}
