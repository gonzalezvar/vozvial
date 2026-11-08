import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';

import type { Caso } from '../../../src/core/Caso';
import { PrioridadCasos } from '../../../src/core/PrioridadCasos';
import { useCasos } from '../../../src/state/casos';
import { Alerta, Cargando, EstadoVacio, Lista, ListaItem, Pantalla, Texto, type TonoEstado } from '../../../src/ui';
import { fechaHoraCaso, tituloCaso } from '../../../src/ui/caso/formatoCaso';
import { estadoPlazoSeguro, ResumenPlazo, textoPlazo } from '../../../src/ui/caso/ResumenPlazo';
import { AyudaPantalla } from '../../../src/ui/guia/AyudaPantalla';

const prioridad = new PrioridadCasos((caso) => {
  const estado = estadoPlazoSeguro(caso);
  return estado ? { fechaLimite: estado.resultado.fechaLimite, vencido: estado.restantes.vencido } : null;
});

/** El punto del estado refuerza la urgencia del plazo; el texto del plazo dice lo mismo con palabras. */
function tonoDe(caso: Caso): TonoEstado {
  if (caso.estado === 'cerrado') return 'neutro';
  const nivel = estadoPlazoSeguro(caso)?.nivel;
  if (nivel === 'vencido') return 'vencido';
  if (nivel === 'hoy' || nivel === 'urgente') return 'urgente';
  if (nivel === 'en_tiempo') return 'exito';
  return 'neutro';
}

export default function MisCasos() {
  const { casos, cargando, error, recargar } = useCasos();
  // CA-14.1: el plazo mas proximo primero.
  const ordenados = useMemo(() => prioridad.ordenar(casos), [casos]);

  // Se recarga al volver a la pantalla, por ejemplo despues de crear o borrar un caso.
  useFocusEffect(
    useCallback(() => {
      void recargar();
    }, [recargar]),
  );

  return (
    <Pantalla
      titulo="Mis casos"
      descripcion="Arriba van los casos con el plazo más cercano. Toca uno para abrirlo."
      extraEncabezado={<AyudaPantalla pantalla="casos" />}
    >
      {error ? (
        <Alerta
          titulo="No pudimos abrir tus casos"
          tono="peligro"
          anunciar
          accion={{ etiqueta: 'Intentar de nuevo', accessibilityLabel: 'Intentar de nuevo abrir tus casos', onPress: () => void recargar() }}
        >
          {error}
        </Alerta>
      ) : null}

      {cargando && casos.length === 0 ? <Cargando texto="Abriendo tus casos" testID="cargando-casos" /> : null}

      {!cargando && casos.length === 0 && !error ? (
        <EstadoVacio
          testID="sin-casos"
          icono="casos"
          titulo="Todavía no tienes casos"
          texto="Se crea uno cuando tocas “Me pararon” o registras un comparendo."
          accion={{
            etiqueta: 'Registrar un comparendo',
            accessibilityLabel: 'Registrar un comparendo',
            href: '/comparendo/nuevo',
            icono: 'comparendo',
          }}
        />
      ) : null}

      {ordenados.length > 0 ? (
        <Lista testID="lista-casos" accessibilityLabel="Tus casos, el plazo más cercano primero">
          {ordenados.map((caso) => {
            const titulo = tituloCaso(caso);
            const fecha = fechaHoraCaso(caso);
            return (
              <ListaItem
                key={caso.id}
                testID={`caso-${caso.id}`}
                icono={caso.comparendo ? 'comparendo' : 'casos'}
                titulo={caso.comparendo ? 'Comparendo' : titulo}
                descripcion={caso.comparendo ? `N.º ${caso.comparendo.numero}` : undefined}
                estado={{ texto: caso.etiquetaEstado(), tono: tonoDe(caso) }}
                href={`/casos/${caso.id}`}
                accessibilityLabel={`Abrir ${titulo}. ${caso.etiquetaEstado()}. ${textoPlazo(caso)} ${fecha}`}
              >
                <ResumenPlazo caso={caso} />
                <Texto variante="nota" color="textoSuave">
                  {fecha}
                </Texto>
              </ListaItem>
            );
          })}
        </Lista>
      ) : null}
    </Pantalla>
  );
}
