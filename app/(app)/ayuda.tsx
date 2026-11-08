import { router, useLocalSearchParams } from 'expo-router';

import { Boton, Lista, ListaItem, Pantalla, Seccion } from '../../src/ui';
import { buscarGuia, GUIAS_SITUACION, pasosParaEscuchar, type GuiaSituacion } from '../../src/ui/guia/contenidoGuia';
import { PasosNumerados } from '../../src/ui/guia/PasosNumerados';

// Ayuda con sesion: guias por situacion en pasos numerados. /ayuda muestra la lista y
// /ayuda?guia=<id> abre una guia, asi el boton atras del navegador vuelve a la lista.
export default function Ayuda() {
  const { guia } = useLocalSearchParams<{ guia?: string }>();
  const elegida = buscarGuia(typeof guia === 'string' ? guia : undefined);
  if (elegida) return <VistaGuia guia={elegida} />;

  return (
    <Pantalla titulo="Ayuda" descripcion="Elige lo que te pasa y sigue los pasos." testID="pantalla-ayuda">
      <Seccion titulo="¿Qué te pasa?">
        <Lista accessibilityLabel="Guías por situación" testID="lista-guias">
          {GUIAS_SITUACION.map((g) => (
            <ListaItem key={g.id} titulo={g.titulo} descripcion={g.resumen} icono={g.icono} href={`/ayuda?guia=${g.id}`} testID={`guia-${g.id}`} />
          ))}
        </Lista>
      </Seccion>
      <Seccion titulo="¿Quieres verlo todo otra vez?">
        <Lista accessibilityLabel="Recorrido de bienvenida">
          <ListaItem titulo="Cómo funciona VozVial" descripcion="El recorrido de bienvenida en 5 pasos" icono="info" href="/guia" testID="ir-recorrido" />
        </Lista>
      </Seccion>
    </Pantalla>
  );
}

function VistaGuia({ guia }: { guia: GuiaSituacion }) {
  const [principal, ...otras] = guia.acciones;
  const volverALista = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/ayuda');
  };
  return (
    <Pantalla titulo={guia.titulo} descripcion={guia.resumen} volverA="/ayuda" lectura={pasosParaEscuchar(guia)} testID={`vista-guia-${guia.id}`}>
      <Seccion titulo="Paso a paso">
        <PasosNumerados pasos={guia.pasos} accessibilityLabel={`Pasos: ${guia.titulo}`} testID="pasos-guia" />
      </Seccion>
      <Seccion titulo="Hazlo ahora">
        {principal ? (
          <Boton
            etiqueta={principal.etiqueta}
            accessibilityRole="link"
            accessibilityLabel={principal.accessibilityLabel}
            descripcion={principal.descripcion}
            icono={principal.icono}
            href={principal.href}
            testID="accion-guia"
          />
        ) : null}
        {otras.map((a) => (
          <Boton
            key={a.href + a.etiqueta}
            etiqueta={a.etiqueta}
            accessibilityRole="link"
            accessibilityLabel={a.accessibilityLabel}
            descripcion={a.descripcion}
            icono={a.icono}
            variante="secundaria"
            href={a.href}
          />
        ))}
        <Boton
          etiqueta="Ver otras guías"
          accessibilityRole="link"
          accessibilityLabel="Ver otras guías de ayuda"
          variante="texto"
          icono="volver"
          onPress={volverALista}
          testID="ver-otras-guias"
        />
      </Seccion>
    </Pantalla>
  );
}
