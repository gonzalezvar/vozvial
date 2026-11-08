import { View } from 'react-native';

import { useSesion } from '../../src/state/sesion';
import { AccesoGrande, BotonMePararon, Pantalla, Texto, useTema } from '../../src/ui';
import { AlertasPlazo } from '../../src/ui/caso/AlertasPlazo';

export default function Inicio() {
  const { espacio } = useTema();
  const nombre = useSesion((s) => s.perfil?.nombre ?? '');
  return (
    <Pantalla titulo={`Hola, ${nombre}`} volverA={false}>
      <AlertasPlazo />

      <BotonMePararon href="/me-pararon" />

      <Texto negrita style={{ marginBottom: espacio.s }}>
        ¿Qué quieres hacer?
      </Texto>
      <View style={{ gap: espacio.m }}>
        <AccesoGrande titulo="Preguntar" descripcion="Pregunta tus derechos hablando o escribiendo" href="/asistente" testID="ir-asistente" />
        <AccesoGrande titulo="Mis casos" descripcion="Tus casos, evidencias y plazos" href="/casos" testID="ir-casos" />
        <AccesoGrande
          titulo="Registrar un comparendo"
          descripcion="Con una foto o escribiendo los datos"
          href="/comparendo/nuevo"
          testID="ir-comparendo"
        />
        <AccesoGrande titulo="Ajustes" descripcion="Tamaño de letra y tus datos" href="/ajustes" testID="ir-ajustes" />
        <AccesoGrande titulo="Acerca del prototipo" descripcion="Qué es real y qué es simulado" href="/acerca" />
      </View>
    </Pantalla>
  );
}
