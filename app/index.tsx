import { Redirect, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { obtenerServicioCuenta } from '../src/state/servicios';
import { useSesion } from '../src/state/sesion';
import { useTema } from '../src/ui';

// Sin cuenta -> bienvenida; con cuenta y sin sesion -> entrar; con sesion -> inicio.
export default function Raiz() {
  const { colores } = useTema();
  const conSesion = useSesion((s) => s.claveDatos !== null);
  const [destino, setDestino] = useState<Href | null>(conSesion ? '/inicio' : null);

  useEffect(() => {
    if (conSesion) return;
    let vigente = true;
    obtenerServicioCuenta()
      .existeCuenta()
      .then((existe) => vigente && setDestino(existe ? '/entrar' : '/bienvenida'))
      .catch(() => vigente && setDestino('/bienvenida'));
    return () => {
      vigente = false;
    };
  }, [conSesion]);

  if (destino) return <Redirect href={destino} />;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colores.fondo }}>
      <ActivityIndicator size="large" color={colores.primario} accessibilityLabel="Cargando VozVial" />
    </View>
  );
}
