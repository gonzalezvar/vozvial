import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import type { Caso } from '../../../src/core/Caso';
import { useCasos } from '../../../src/state/casos';
import { obtenerRepositorioCasos } from '../../../src/state/servicios';
import { Alerta, Boton, Cargando, EtiquetaEstado, Pantalla, Tarjeta, Texto, useTema } from '../../../src/ui';
import { DatoEnLinea } from '../../../src/ui/caso/DatoEnLinea';
import { fechaHoraCaso, tituloCaso } from '../../../src/ui/caso/formatoCaso';
import { SeccionComparendo } from '../../../src/ui/caso/SeccionComparendo';
import { SeccionEvidencias } from '../../../src/ui/caso/SeccionEvidencias';
import { AyudaPantalla } from '../../../src/ui/guia/AyudaPantalla';

type Carga = { estado: 'cargando' } | { estado: 'listo'; caso: Caso } | { estado: 'no_existe' } | { estado: 'error' };
/** Resultado de la carga junto con el id que se pidio, para no mostrar un caso viejo al cambiar de id. */
type CargaDe = Carga & { id: string };

export default function DetalleCaso() {
  const { espacio } = useTema();
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
          <Cargando texto="Abriendo el caso" />
        ) : (
          <Alerta
            titulo={carga.estado === 'no_existe' ? 'Este caso no existe' : 'No pudimos abrir el caso'}
            tono={carga.estado === 'no_existe' ? 'aviso' : 'peligro'}
            anunciar
            accion={{ etiqueta: 'Ir a mis casos', accessibilityLabel: 'Ir a mis casos', href: '/casos', icono: 'casos' }}
          >
            {carga.estado === 'no_existe' ? 'Puede que lo hayas borrado.' : 'Intenta de nuevo.'}
          </Alerta>
        )}
      </Pantalla>
    );
  }

  const { caso } = carga;
  return (
    <Pantalla
      titulo={tituloCaso(caso)}
      descripcion="Aquí están el plazo, los datos y las evidencias de este caso."
      volverA="/casos"
      testID="detalle-caso"
      extraEncabezado={<AyudaPantalla pantalla="caso" />}
      pie={
        <>
          <Boton
            etiqueta="Generar solicitud"
            descripcion="Pide la audiencia para no aceptar el comparendo"
            accessibilityRole="link"
            accessibilityLabel="Generar solicitud de audiencia"
            icono="solicitud"
            href={`/solicitud/${caso.id}`}
          />
          {confirmarBorrado ? (
            <Alerta titulo="¿Borrar este caso?" tono="peligro" anunciar>
              <Texto>Se borra para siempre, con todas sus evidencias. No se puede deshacer.</Texto>
              <View style={{ gap: espacio.s }}>
                <Boton
                  etiqueta="Sí, borrar"
                  accessibilityRole="button"
                  accessibilityLabel="Sí, borrar el caso"
                  variante="peligro"
                  icono="borrar"
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
              </View>
            </Alerta>
          ) : (
            <Boton
              etiqueta="Borrar"
              accessibilityRole="button"
              accessibilityLabel="Borrar este caso"
              variante="peligroSecundaria"
              icono="borrar"
              onPress={() => setConfirmarBorrado(true)}
            />
          )}
        </>
      }
    >
      <SeccionComparendo caso={caso} onCambio={alCambiar} />

      <Tarjeta titulo="Datos del caso" icono="casos">
        <EtiquetaEstado texto={caso.etiquetaEstado()} />
        <DatoEnLinea etiqueta="Fecha y hora" testID="fecha-hora-detalle">
          {fechaHoraCaso(caso)}
        </DatoEnLinea>
        <DatoEnLinea etiqueta="Ubicación" testID="ubicacion-caso">
          {caso.descripcionUbicacion()}
        </DatoEnLinea>
      </Tarjeta>

      <SeccionEvidencias caso={caso} onCambio={alCambiar} />
    </Pantalla>
  );
}
