import { View } from 'react-native';

import { useSesion } from '../../src/state/sesion';
import { AccesoGrande, BotonMePararon, Lista, ListaItem, Pantalla, Seccion, useTema } from '../../src/ui';
import { AlertasPlazo } from '../../src/ui/caso/AlertasPlazo';
import { AyudaPantalla } from '../../src/ui/guia/AyudaPantalla';
import { OfertaRecorrido } from '../../src/ui/guia/OfertaRecorrido';

export default function Inicio() {
  const { espacio } = useTema();
  const nombre = useSesion((s) => s.perfil?.nombre ?? '');
  return (
    <Pantalla
      titulo={`Hola, ${nombre}`}
      descripcion="Si te para un agente, toca “Me pararon”. Para lo demás, elige abajo."
      volverA={false}
      extraEncabezado={<AyudaPantalla pantalla="inicio" />}
    >
      <AlertasPlazo />

      {/* Solo la primera vez, tras crear la cuenta: ofrece el recorrido sin bloquear. */}
      <OfertaRecorrido />

      <BotonMePararon href="/me-pararon" />

      <Seccion titulo="¿Qué quieres hacer?">
        <View style={{ gap: espacio.ms }}>
          <AccesoGrande
            titulo="Preguntar"
            descripcion="Pregunta tus derechos hablando o escribiendo"
            href="/asistente"
            icono="conversacion"
            testID="ir-asistente"
          />
          <AccesoGrande titulo="Mis casos" descripcion="Tus casos, evidencias y plazos" href="/casos" icono="casos" testID="ir-casos" />
          <AccesoGrande
            titulo="Registrar un comparendo"
            descripcion="Con una foto o escribiendo los datos"
            href="/comparendo/nuevo"
            icono="comparendo"
            testID="ir-comparendo"
          />
          <AccesoGrande
            titulo="Ayuda y guía"
            descripcion="Aprende a usar VozVial paso a paso"
            href="/ayuda"
            icono="ayuda"
            testID="ir-ayuda"
          />
        </View>
      </Seccion>

      <Lista accessibilityLabel="Más opciones">
        <ListaItem icono="ajustes" titulo="Ajustes" descripcion="Tamaño de letra y tus datos" href="/ajustes" testID="ir-ajustes" />
        <ListaItem icono="info" titulo="Acerca del prototipo" descripcion="Qué es real y qué es simulado" href="/acerca" />
      </Lista>
    </Pantalla>
  );
}
