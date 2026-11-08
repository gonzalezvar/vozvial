import { Redirect, router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';

import { CONFIG } from '../../src/state/configuracion';
import { useSesion } from '../../src/state/sesion';
import { colores } from '../../src/ui/tema';

const EVENTOS_ACTIVIDAD = ['pointerdown', 'keydown', 'touchstart', 'wheel', 'input'] as const;

// Pantallas con sesion: sin clave en memoria se va a "Entrar". CA-02.4: tras CONFIG.inactividadMs
// sin toques ni teclas la sesion se cierra y se vuelve a pedir el PIN.
export default function LayoutApp() {
  const conSesion = useSesion((s) => s.claveDatos !== null);

  useEffect(() => {
    if (!conSesion) return;
    const { tocar } = useSesion.getState();
    tocar();
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      for (const evento of EVENTOS_ACTIVIDAD) document.addEventListener(evento, tocar, { capture: true, passive: true });
    }
    // Revisa seguido para cerrar a tiempo tambien cuando la pestana vuelve de segundo plano.
    const intervalo = setInterval(
      () => {
        const { ultimaActividad, cerrar } = useSesion.getState();
        if (Date.now() - ultimaActividad >= CONFIG.inactividadMs) {
          cerrar('inactividad');
          router.replace('/entrar');
        }
      },
      Math.min(1000, CONFIG.inactividadMs / 5),
    );
    return () => {
      clearInterval(intervalo);
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        for (const evento of EVENTOS_ACTIVIDAD) document.removeEventListener(evento, tocar, { capture: true });
      }
    };
  }, [conSesion]);

  if (!conSesion) return <Redirect href="/entrar" />;

  return (
    // En el celular (sin document) cada toque tambien cuenta como actividad.
    <View
      style={{ flex: 1 }}
      onStartShouldSetResponderCapture={() => {
        useSesion.getState().tocar();
        return false;
      }}
    >
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colores.fondo } }} />
    </View>
  );
}
