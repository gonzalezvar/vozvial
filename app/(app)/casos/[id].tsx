import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import type { Caso } from '../../../src/core/Caso';
import { useCasos } from '../../../src/state/casos';
import { obtenerRepositorioCasos } from '../../../src/state/servicios';
import { Alerta, Boton, EtiquetaEstado, Pantalla, Tarjeta, Texto, useTema } from '../../../src/ui';
import { fechaHoraCaso, tituloCaso } from '../../../src/ui/caso/formatoCaso';
import { SeccionComparendo } from '../../../src/ui/caso/SeccionComparendo';
import { SeccionEvidencias } from '../../../src/ui/caso/SeccionEvidencias';

type Carga = { estado: 'cargando' } | { estado: 'listo'; caso: Caso } | { estado: 'no_existe' } | { estado: 'error' };
/** Resultado de la carga junto con el id que se pidio, para no mostrar un caso viejo al cambiar de id. */
type CargaDe = Carga & { id: string };

export default function DetalleCaso() {
  const { colores, espacio } = useTema();
  const { id } = useLocalSearchParams<{ id: string }>();
  const actualizarEnLista = useCasos((s) => s.actualizarEnLista);
  const quitarDeLista = useCasos((s) => s.quitarDeLista);
  const [cargaDe, setCargaDe] = useState<CargaDe | null>(null);
  const carga: Carga = cargaDe && cargaDe.id === String(id) ? cargaDe : { estado: 'cargando' };
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const [borrando, setBorrando] = useState(false);

  useEffect(() => {
    let vigente = true;
    const pedido = String(id);
    obtenerRepositorioCasos()
      .obtener(pedido)
      .then((caso) => vigente && setCargaDe(caso ? { id: pedido, estado: 'listo', caso } : { id: pedido, estado: 'no_existe' }))
      .catch(() => vigente && setCargaDe({ id: pedido, estado: 'error' }));
    return () => {
      vigente = false;
    };
  }, [id]);

  // Las secciones guardan el caso y avisan aqui para refrescar la pantalla y la lista.
  const alCambiar = useCallback(
    (caso: Caso) => {
      setCargaDe({ id: caso.id, estado: 'listo', caso });
      actualizarEnLista(caso);
    },
    [actualizarEnLista],
  );

  const borrar = async (caso: Caso) => {
    setBorrando(true);
    await obtenerRepositorioCasos().borrar(caso.id);
    quitarDeLista(caso.id);
    router.replace('/casos');
  };

  if (carga.estado !== 'listo') {
    return (
      <Pantalla titulo={carga.estado === 'cargando' ? 'Abriendo el caso' : 'Caso no disponible'} volverA="/casos">
        {carga.estado === 'cargando' ? (
          <ActivityIndicator size="large" color={colores.primario} accessibilityLabel="Abriendo el caso" />
        ) : (
          <Alerta titulo={carga.estado === 'no_existe' ? 'Este caso no existe' : 'No pudimos abrir el caso'} tono="aviso" anunciar>
            {carga.estado === 'no_existe' ? 'Puede que lo hayas borrado.' : 'Intenta de nuevo.'}
          </Alerta>
        )}
      </Pantalla>
    );
  }

  const { caso } = carga;
  return (
    <Pantalla titulo={tituloCaso(caso)} volverA="/casos" testID="detalle-caso">
      <Tarjeta titulo="Datos del caso">
        <EtiquetaEstado texto={caso.etiquetaEstado()} />
        <Texto testID="fecha-hora-detalle">{fechaHoraCaso(caso)}</Texto>
        <Texto testID="ubicacion-caso">Ubicación: {caso.descripcionUbicacion()}</Texto>
      </Tarjeta>

      <SeccionEvidencias caso={caso} onCambio={alCambiar} />
      <SeccionComparendo caso={caso} onCambio={alCambiar} />

      <View style={{ gap: espacio.m }}>
        <Boton
          etiqueta="Generar solicitud"
          accessibilityRole="link"
          accessibilityLabel="Generar solicitud de audiencia"
          href={`/solicitud/${caso.id}`}
        />
        {confirmarBorrado ? (
          <Alerta titulo="¿Borrar este caso?" tono="urgente" anunciar>
            <Texto>Se borra para siempre, con todas sus evidencias. No se puede deshacer.</Texto>
            <Boton
              etiqueta="Sí, borrar"
              accessibilityRole="button"
              accessibilityLabel="Sí, borrar el caso"
              variante="peligro"
              deshabilitado={borrando}
              onPress={() => void borrar(caso)}
            />
            <Boton
              etiqueta="No, dejarlo"
              accessibilityRole="button"
              accessibilityLabel="No, dejar el caso"
              variante="secundaria"
              onPress={() => setConfirmarBorrado(false)}
            />
          </Alerta>
        ) : (
          <Boton
            etiqueta="Borrar"
            accessibilityRole="button"
            accessibilityLabel="Borrar este caso"
            variante="peligro"
            onPress={() => setConfirmarBorrado(true)}
          />
        )}
      </View>
    </Pantalla>
  );
}
