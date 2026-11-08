import { useState } from 'react';
import { View } from 'react-native';

import {
  Alerta,
  Boton,
  CampoTexto,
  GrupoOpciones,
  Pantalla,
  TAMANOS_LETRA,
  Tarjeta,
  Texto,
  useAjustes,
  useTema,
  type TamanoLetra,
} from '../../src/ui';

export default function Ajustes() {
  const { espacio, tipo } = useTema();
  const tamano = useAjustes((e) => e.tamanoLetra);
  const cambiar = useAjustes((e) => e.cambiarTamanoLetra);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const [pin, setPin] = useState('');

  return (
    <Pantalla titulo="Ajustes">
      <Tarjeta titulo="Tamaño de letra">
        <GrupoOpciones<TamanoLetra>
          accessibilityLabel="Tamaño de letra"
          seleccion={tamano}
          alElegir={cambiar}
          testID="tamano-letra"
          opciones={TAMANOS_LETRA.map((t) => ({ valor: t.id, etiqueta: t.nombre, descripcion: `Letra de ${t.base} puntos` }))}
        />
        <Texto testID="muestra-letra" style={{ marginTop: espacio.s }}>
          Así se ve el texto ({tipo.base} px).
        </Texto>
      </Tarjeta>

      <Tarjeta titulo="Tu información">
        <View style={{ gap: espacio.s }}>
          <Boton etiqueta="Política de datos" accessibilityRole="link" accessibilityLabel="Política de datos" variante="secundaria" href="/privacidad" />
          <Boton etiqueta="Acerca del prototipo" accessibilityRole="link" accessibilityLabel="Acerca del prototipo" variante="secundaria" href="/acerca" />
          <Boton etiqueta="Cerrar sesión" accessibilityRole="button" accessibilityLabel="Cerrar sesión" variante="secundaria" href="/entrar" reemplazar />
        </View>
      </Tarjeta>

      <Tarjeta titulo="Borrar todo">
        <Texto>Borra tu cuenta, tus casos y tus evidencias de este celular.</Texto>
        {confirmarBorrado ? (
          <Alerta titulo="¿Borrar todos tus datos?" tono="urgente" anunciar>
            <Texto>No se puede deshacer. Escribe tu PIN para confirmar.</Texto>
            <CampoTexto etiqueta="Tu PIN" valor={pin} alCambiar={setPin} teclado="number-pad" maxLength={6} secreto />
            <Boton
              etiqueta="Sí, borrar todo"
              accessibilityRole="button"
              accessibilityLabel="Sí, borrar todos mis datos"
              variante="peligro"
              href="/bienvenida"
              reemplazar
            />
            <Boton
              etiqueta="No, cancelar"
              accessibilityRole="button"
              accessibilityLabel="No, cancelar el borrado"
              variante="secundaria"
              onPress={() => setConfirmarBorrado(false)}
            />
          </Alerta>
        ) : (
          <Boton
            etiqueta="Borrar todos mis datos"
            accessibilityRole="button"
            accessibilityLabel="Borrar todos mis datos"
            variante="peligro"
            onPress={() => setConfirmarBorrado(true)}
          />
        )}
        <Texto variante="nota" color="textoSuave">
          Ejemplo: en el diseño rápido el borrado no borra nada todavía.
        </Texto>
      </Tarjeta>
    </Pantalla>
  );
}
