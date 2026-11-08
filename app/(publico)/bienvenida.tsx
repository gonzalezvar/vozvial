import { View } from 'react-native';

import { Boton, Enlace, Pantalla, Tarjeta, Texto, useTema } from '../../src/ui';

export default function Bienvenida() {
  const { espacio } = useTema();
  return (
    <Pantalla titulo="VozVial" volverA={false}>
      <Texto variante="destacado" color="primario" style={{ marginBottom: espacio.s }}>
        Entiende tu comparendo.
      </Texto>
      <Texto style={{ marginBottom: espacio.l }}>
        Te explica tus derechos con la norma a la vista, guarda lo que pasa cuando te para un agente y te avisa hasta
        cuándo puedes pedir la audiencia.
      </Texto>

      <View style={{ gap: espacio.m, marginBottom: espacio.l }}>
        <Boton
          etiqueta="Crear mi cuenta"
          accessibilityRole="link"
          accessibilityLabel="Crear mi cuenta"
          href="/registro"
          testID="ir-registro"
        />
        <Boton
          etiqueta="Ya tengo cuenta"
          descripcion="Entrar con mi PIN"
          accessibilityRole="link"
          accessibilityLabel="Ya tengo cuenta. Entrar con mi PIN"
          variante="secundaria"
          href="/entrar"
          testID="ir-entrar"
        />
        <Boton
          etiqueta="Olvidé mi PIN"
          accessibilityRole="link"
          accessibilityLabel="Olvidé mi PIN"
          variante="secundaria"
          href="/recuperar"
        />
      </View>

      <Tarjeta titulo="Antes de empezar">
        <Texto>Tus datos se quedan en tu celular, cifrados. No necesitas correo ni contraseña larga.</Texto>
        <Enlace href="/privacidad">Lee la política de datos</Enlace>
        <Enlace href="/acerca">Qué es real y qué es simulado</Enlace>
      </Tarjeta>
    </Pantalla>
  );
}
