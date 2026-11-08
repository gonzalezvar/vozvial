import { router } from 'expo-router';
import { View } from 'react-native';

import { useRegistro } from '../../src/state/registro';
import { useSesion } from '../../src/state/sesion';
import { Alerta, Boton, BotonEscuchar, Pantalla, Texto, useTema } from '../../src/ui';

export default function CodigoRecuperacion() {
  const { colores, espacio, radio, tipo } = useTema();
  const codigo = useRegistro((s) => s.codigoRecuperacion);
  const conSesion = useSesion((s) => s.claveDatos !== null);

  const continuar = () => {
    // El codigo se muestra una sola vez: al seguir se borra de la memoria.
    useRegistro.getState().olvidarCodigo();
    router.replace(conSesion ? '/inicio' : '/entrar');
  };

  if (!codigo) {
    return (
      <Pantalla titulo="Tu código de recuperación" volverA={false}>
        <Alerta titulo="El código ya no se puede mostrar" tono="aviso">
          Por seguridad, el código solo se muestra una vez, al crear la cuenta.
        </Alerta>
        <Boton etiqueta="Continuar" accessibilityRole="link" accessibilityLabel="Continuar" onPress={continuar} />
      </Pantalla>
    );
  }

  // Se lee caracter por caracter, en tres grupos de 4, para que se pueda copiar a mano.
  const deletreado = codigo
    .split('-')
    .map((grupo, i) => `Grupo ${i + 1}: ${grupo.split('').join(', ')}.`)
    .join(' ');
  return (
    <Pantalla titulo="Tu código de recuperación" volverA={false}>
      <Texto style={{ marginBottom: espacio.m }}>
        Tu cuenta quedó creada. Si olvidas tu PIN, con este código de 12 letras y números vuelves a entrar sin perder
        tus casos.
      </Texto>
      <View
        testID="codigo-recuperacion"
        style={{
          backgroundColor: colores.superficie,
          borderColor: colores.primario,
          borderWidth: 3,
          borderRadius: radio.m,
          padding: espacio.l,
          marginBottom: espacio.m,
        }}
      >
        <Texto
          centrado
          color="primario"
          style={{ fontSize: tipo.destacado, lineHeight: tipo.alturaLinea(tipo.destacado), fontWeight: '800', letterSpacing: 2 }}
        >
          {codigo}
        </Texto>
      </View>
      <View style={{ marginBottom: espacio.m }}>
        <BotonEscuchar texto={`Tu código tiene 12 caracteres. ${deletreado}`} etiqueta="Escuchar el código" que="el código de recuperación" />
      </View>
      <Alerta titulo="Guárdalo en un lugar seguro" tono="aviso" testID="aviso-guardar-codigo">
        Escríbelo en un papel y guárdalo. Solo se muestra esta vez y VozVial no lo puede recuperar por ti.
      </Alerta>
      <Boton etiqueta="Ya lo guardé" accessibilityRole="link" accessibilityLabel="Ya lo guardé. Ir al inicio" onPress={continuar} />
    </Pantalla>
  );
}
