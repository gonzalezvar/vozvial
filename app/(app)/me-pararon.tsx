import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import type { Caso } from '../../src/core/Caso';
import { obtenerBaseNormativa } from '../../src/core/cargarDatos';
import { DerechosClave } from '../../src/core/DerechosClave';
import { GrabadorAudio } from '../../src/services/GrabadorAudio';
import { RegistroMePararon } from '../../src/services/RegistroMePararon';
import { explicacionSinUbicacion, ServicioUbicacion } from '../../src/services/ServicioUbicacion';
import { useCasos } from '../../src/state/casos';
import { obtenerRepositorioCasos } from '../../src/state/servicios';
import { useSesion } from '../../src/state/sesion';
import { Alerta, Boton, EtiquetaEstado, Pantalla, Tarjeta, TarjetaCita, Texto, Titulo, useTema } from '../../src/ui';
import { fechaHoraEvidencia, SeccionEvidencias } from '../../src/ui/caso/SeccionEvidencias';

type EstadoAudio = { estado: 'preparando' } | { estado: 'grabando'; desde: number } | { estado: 'sin_audio'; motivo: string };

function formatoTiempo(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * HU-07. Al abrir la pantalla (un toque desde el inicio) empieza a grabar y crea el caso con
 * fecha, hora y ubicacion. "Terminar" guarda el audio cifrado y abre el caso.
 */
export default function MePararon() {
  const { colores, espacio, radio, tipo } = useTema();
  const actualizarEnLista = useCasos((s) => s.actualizarEnLista);
  const registro = useRef<RegistroMePararon | null>(null);
  const casoActual = useRef<Caso | null>(null);
  const [audio, setAudio] = useState<EstadoAudio>({ estado: 'preparando' });
  const [caso, setCaso] = useState<Caso | null>(null);
  // Instante del toque en "Me pararon": es la fecha y hora del caso.
  const [instante] = useState(() => new Date());
  const [errorCaso, setErrorCaso] = useState<string | null>(null);
  const [segundos, setSegundos] = useState(0);
  const [terminando, setTerminando] = useState(false);
  const derechos = useMemo(() => new DerechosClave(obtenerBaseNormativa()).lista(), []);

  useEffect(() => {
    const r = new RegistroMePararon(obtenerRepositorioCasos(), new GrabadorAudio(), new ServicioUbicacion(), () => instante);
    registro.current = r;
    let vigente = true;

    void r.iniciarGrabacion().then((resultado) => {
      if (!vigente) return;
      setAudio(resultado.grabando ? { estado: 'grabando', desde: resultado.desde } : { estado: 'sin_audio', motivo: resultado.motivo });
    });
    r.crearCaso()
      .then((nuevo) => {
        if (!vigente) return;
        casoActual.current = nuevo;
        setCaso(nuevo);
        useCasos.getState().actualizarEnLista(nuevo);
      })
      .catch(() => vigente && setErrorCaso('No pudimos crear el caso. Toca "Volver" e intenta de nuevo.'));

    return () => {
      vigente = false;
      // Si sale sin tocar "Terminar", el audio se guarda igual para no perder la prueba.
      if (!r.yaTermino) {
        void r
          .terminar(casoActual.current)
          .then((final) => useCasos.getState().actualizarEnLista(final))
          .catch(() => undefined);
      }
    };
  }, [instante]);

  // Mientras el modo esta activo la sesion no se cierra por inactividad: no se toca la pantalla al hablar con el agente.
  useEffect(() => {
    if (terminando) return;
    const intervalo = setInterval(() => {
      useSesion.getState().tocar();
      if (audio.estado === 'grabando') setSegundos(Math.floor((Date.now() - audio.desde) / 1000));
    }, 500);
    return () => clearInterval(intervalo);
  }, [audio, terminando]);

  const alCambiarCaso = useCallback(
    (actualizado: Caso) => {
      casoActual.current = actualizado;
      setCaso(actualizado);
      actualizarEnLista(actualizado);
    },
    [actualizarEnLista],
  );

  const terminar = async () => {
    const r = registro.current;
    if (!r || terminando) return;
    setTerminando(true);
    setErrorCaso(null);
    try {
      const final = await r.terminar(casoActual.current);
      actualizarEnLista(final);
      router.replace(`/casos/${final.id}`);
    } catch {
      setTerminando(false);
      setErrorCaso('No pudimos guardar el caso. Toca "Terminar" otra vez.');
    }
  };

  return (
    <Pantalla titulo="Me pararon" testID="pantalla-me-pararon">
      {audio.estado === 'grabando' ? (
        <View
          accessibilityRole="timer"
          accessibilityLabel={`Grabando. Tiempo ${formatoTiempo(segundos)}`}
          testID="indicador-grabando"
          style={{
            backgroundColor: colores.urgencia,
            borderRadius: radio.l,
            padding: espacio.l,
            flexDirection: 'row',
            alignItems: 'center',
            gap: espacio.m,
            marginBottom: espacio.m,
          }}
        >
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colores.sobreUrgencia }} />
          <View style={{ flex: 1 }}>
            <Texto negrita color="sobreUrgencia">
              Grabando
            </Texto>
            <Texto
              color="sobreUrgencia"
              testID="tiempo-grabacion"
              style={{ fontSize: tipo.destacado, lineHeight: tipo.alturaLinea(tipo.destacado), fontWeight: '800' }}
            >
              {formatoTiempo(segundos)}
            </Texto>
          </View>
        </View>
      ) : audio.estado === 'preparando' ? (
        <Tarjeta testID="preparando-microfono">
          <Texto negrita>Preparando el micrófono…</Texto>
          <Texto variante="nota" color="textoSuave">
            Si el navegador te pregunta, permite usar el micrófono.
          </Texto>
        </Tarjeta>
      ) : (
        <Alerta titulo="No se está grabando audio" tono="aviso" anunciar testID="sin-audio">
          <Texto>{audio.motivo}</Texto>
        </Alerta>
      )}

      <View style={{ marginBottom: espacio.m }}>
        <Boton
          etiqueta={terminando ? 'Guardando…' : 'Terminar'}
          descripcion="Detiene la grabación y guarda el caso"
          accessibilityRole="button"
          accessibilityLabel="Terminar. Detiene la grabación y guarda el caso"
          deshabilitado={terminando}
          onPress={() => void terminar()}
          testID="boton-terminar"
        />
      </View>

      {errorCaso ? (
        <Alerta titulo="Algo no salió bien" tono="urgente" anunciar testID="error-caso">
          <Texto>{errorCaso}</Texto>
        </Alerta>
      ) : null}

      <Tarjeta titulo="Datos del momento" testID="datos-momento">
        <Texto testID="fecha-hora-caso">Fecha y hora: {fechaHoraEvidencia(instante.toISOString())}</Texto>
        {caso === null ? (
          <Texto testID="ubicacion-me-pararon">Ubicación: buscando dónde estás…</Texto>
        ) : caso.tieneUbicacion() ? (
          <Texto testID="ubicacion-me-pararon">Ubicación: {caso.descripcionUbicacion()}</Texto>
        ) : (
          <>
            <View
              testID="ubicacion-me-pararon"
              style={{ flexDirection: 'row', gap: espacio.s, alignItems: 'center', flexWrap: 'wrap' }}
            >
              <Texto>Ubicación:</Texto>
              <EtiquetaEstado texto={caso.descripcionUbicacion()} tono="aviso" />
            </View>
            {caso.motivoSinUbicacion ? (
              <Texto variante="nota" color="textoSuave" testID="motivo-sin-ubicacion">
                {explicacionSinUbicacion(caso.motivoSinUbicacion)}
              </Texto>
            ) : null}
          </>
        )}
      </Tarjeta>

      <Tarjeta testID="derechos-clave">
        <Titulo nivel={2}>Tus derechos clave</Titulo>
        <Texto variante="nota" color="textoSuave">
          Salen de la ley. Toca el artículo para ver el texto exacto.
        </Texto>
        {derechos.length === 0 ? (
          <Texto>No hay derechos verificados para mostrar.</Texto>
        ) : (
          derechos.map((d) => (
            <View key={d.id} testID={`derecho-${d.id}`} style={{ gap: espacio.s }}>
              <Texto>{d.resumen}</Texto>
              <TarjetaCita cita={d.cita} />
            </View>
          ))
        )}
      </Tarjeta>

      {caso ? (
        <SeccionEvidencias caso={caso} onCambio={alCambiarCaso} />
      ) : (
        <Tarjeta titulo="Evidencias">
          <Texto>Preparando el caso…</Texto>
        </Tarjeta>
      )}
    </Pantalla>
  );
}
