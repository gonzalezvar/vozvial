import { View } from 'react-native';

import { Boton, Enlace, Lista, ListaItem, Pantalla, Seccion, Tarjeta, Texto, useTema } from '../../src/ui';
import { AyudaPantalla } from '../../src/ui/guia/AyudaPantalla';

export default function Bienvenida() {
  const { espacio } = useTema();
  return (
    <Pantalla
      titulo="VozVial"
      descripcion="Entiende tu comparendo y conoce tus derechos, paso a paso."
      volverA={false}
      extraEncabezado={<AyudaPantalla pantalla="bienvenida" />}
    >
      <Seccion>
        <Lista accessibilityLabel="Lo que hace VozVial">
          <ListaItem icono="ley" titulo="Tus derechos, con la ley a la vista" descripcion="Cada respuesta dice de qué norma sale." />
          <ListaItem icono="grabar" titulo="Guarda lo que pasa" descripcion="Si te para un agente, graba con un toque." />
          <ListaItem icono="calendario" titulo="Cuida tus plazos" descripcion="Te avisa hasta cuándo puedes pedir la audiencia." />
        </Lista>
      </Seccion>

      <View style={{ gap: espacio.ms, marginBottom: espacio.xl }}>
        <Boton
          etiqueta="Crear mi cuenta"
          accessibilityRole="link"
          accessibilityLabel="Crear mi cuenta"
          icono="usuario"
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
          etiqueta="¿Cómo funciona?"
          descripcion="Una guía corta antes de empezar"
          accessibilityRole="link"
          accessibilityLabel="¿Cómo funciona? Una guía corta antes de empezar"
          variante="tonal"
          icono="ayuda"
          href="/guia"
          testID="ir-guia"
        />
        <Boton etiqueta="Olvidé mi PIN" accessibilityRole="link" accessibilityLabel="Olvidé mi PIN" variante="texto" href="/recuperar" />
      </View>

      <Tarjeta titulo="Antes de empezar" icono="candado">
        <Texto>Tus datos se guardan cifrados. No necesitas correo ni contraseña larga.</Texto>
        <Enlace href="/privacidad">Lee la política de datos</Enlace>
        <Enlace href="/acerca">Qué es real y qué es simulado</Enlace>
      </Tarjeta>
    </Pantalla>
  );
}
