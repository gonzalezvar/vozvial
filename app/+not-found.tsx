import { Boton, Pantalla, Texto } from '../src/ui';

// Reemplaza la pagina por defecto de Expo Router ("Unmatched Route", en ingles y con el mapa del sitio).
export default function NoEncontrada() {
  return (
    <Pantalla
      titulo="No encontramos esta página"
      descripcion="El enlace puede estar mal escrito o la página ya no existe."
      volverA="/"
      testID="pantalla-no-encontrada"
    >
      <Texto>Vuelve al comienzo para seguir usando VozVial.</Texto>
      <Boton etiqueta="Ir al comienzo" accessibilityRole="link" accessibilityLabel="Ir al comienzo de VozVial" href="/" reemplazar testID="ir-comienzo" />
    </Pantalla>
  );
}
