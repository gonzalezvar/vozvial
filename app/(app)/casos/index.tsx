import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';

import { useCasos } from '../../../src/state/casos';
import { Alerta, Boton, EtiquetaEstado, Pantalla, Tarjeta, Texto, useTema } from '../../../src/ui';
import { fechaHoraCaso, tituloCaso } from '../../../src/ui/caso/formatoCaso';
import { ResumenPlazo } from '../../../src/ui/caso/ResumenPlazo';

export default function MisCasos() {
  const { espacio } = useTema();
  const { casos, cargando, error, recargar } = useCasos();

  // Se recarga al volver a la pantalla, por ejemplo despues de crear o borrar un caso.
  useFocusEffect(
    useCallback(() => {
      void recargar();
    }, [recargar]),
  );

  return (
    <Pantalla titulo="Mis casos">
      {error ? (
        <Alerta titulo="No pudimos abrir tus casos" tono="aviso" anunciar>
          {error}
        </Alerta>
      ) : null}
      {!cargando && casos.length === 0 && !error ? (
        <View testID="sin-casos" style={{ gap: espacio.m }}>
          <Texto>Todavía no tienes casos. Se crea uno cuando tocas “Me pararon” o registras un comparendo.</Texto>
          <Boton
            etiqueta="Registrar un comparendo"
            accessibilityRole="link"
            accessibilityLabel="Registrar un comparendo"
            variante="secundaria"
            href="/comparendo/nuevo"
          />
        </View>
      ) : null}
      <View accessibilityRole="list" testID="lista-casos">
        {casos.map((caso) => {
          const titulo = tituloCaso(caso);
          return (
            <View key={caso.id} accessibilityRole="listitem" testID={`caso-${caso.id}`}>
              <Tarjeta titulo={titulo}>
                <EtiquetaEstado texto={caso.etiquetaEstado()} />
                <ResumenPlazo caso={caso} />
                <Texto variante="nota" color="textoSuave">
                  {fechaHoraCaso(caso)}
                </Texto>
                <Boton
                  etiqueta="Abrir"
                  accessibilityRole="link"
                  accessibilityLabel={`Abrir ${titulo}`}
                  variante="secundaria"
                  href={`/casos/${caso.id}`}
                />
              </Tarjeta>
            </View>
          );
        })}
      </View>
    </Pantalla>
  );
}
