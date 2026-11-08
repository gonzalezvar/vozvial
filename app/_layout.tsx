import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { colores } from '../src/ui/tema';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colores.fondo } }} />
    </>
  );
}
