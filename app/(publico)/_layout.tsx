import { Stack } from 'expo-router';

import { colores } from '../../src/ui/tema';

// Pantallas que se abren sin cuenta: bienvenida, registro, entrar, recuperar, acerca y privacidad.
export default function LayoutPublico() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colores.fondo } }} />;
}
