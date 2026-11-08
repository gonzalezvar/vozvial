import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { MAX_CARACTERES_PREGUNTA } from '../../src/core/AsistenteNormativo';
import type { RespuestaAsistente } from '../../src/core/ProveedorRespuesta';
import type { ProveedorVoz } from '../../src/core/ProveedorVoz';
import { ClienteAsistente, ErrorAsistente } from '../../src/services/ClienteAsistente';
import { crearProveedorVoz } from '../../src/services/ProveedorTexto';
import { ErrorVoz } from '../../src/services/ProveedorVozWeb';
import { servicioConectividad } from '../../src/services/ServicioConectividad';
import { servicioLecturaVoz } from '../../src/services/ServicioLecturaVoz';
import {
  Alerta,
  AvisoLegal,
  Boton,
  BotonEscuchar,
  CampoTexto,
  Pantalla,
  Tarjeta,
  TarjetaCita,
  Texto,
  useTema,
} from '../../src/ui';

const cliente = new ClienteAsistente();

interface RespuestaMostrada {
  /** Cambia en cada respuesta para volver a leerla aunque el texto se repita. */
  numero: number;
  pregunta: string;
  datos: RespuestaAsistente;
}

type EstadoVoz = { tipo: 'revisando' } | { tipo: 'lista' } | { tipo: 'no_disponible'; motivo: string };

function textoParaLeer(r: RespuestaAsistente): string {
  return r.sugerencia ? `${r.texto} ${r.sugerencia}` : r.texto;
}

export default function Asistente() {
  const { espacio } = useTema();
  const voz = useRef<ProveedorVoz | null>(null);
  const contador = useRef(0);

  const [enLinea, setEnLinea] = useState(() => servicioConectividad.enLinea());
  const [estadoVoz, setEstadoVoz] = useState<EstadoVoz>({ tipo: 'revisando' });
  const [escuchando, setEscuchando] = useState(false);
  const [parcial, setParcial] = useState('');
  const [avisoVoz, setAvisoVoz] = useState<string | null>(null);
  const [transcrita, setTranscrita] = useState<string | null>(null);
  const [pregunta, setPregunta] = useState('');
  const [errorCampo, setErrorCampo] = useState<string | null>(null);
  const [consultando, setConsultando] = useState(false);
  const [error, setError] = useState<ErrorAsistente | null>(null);
  const [respuesta, setRespuesta] = useState<RespuestaMostrada | null>(null);

  useEffect(() => {
    const proveedor = crearProveedorVoz();
    voz.current = proveedor;
    let vigente = true;
    void proveedor.disponible().then((d) => {
      if (!vigente) return;
      setEstadoVoz(d.ok ? { tipo: 'lista' } : { tipo: 'no_disponible', motivo: d.motivo ?? 'No se puede usar el micrófono.' });
    });
    const dejar = servicioConectividad.suscribir(setEnLinea);
    return () => {
      vigente = false;
      dejar();
      proveedor.detener();
      servicioLecturaVoz.detener();
    };
  }, []);

  // La respuesta se lee en voz alta apenas llega (CA-05.3).
  useEffect(() => {
    if (respuesta) servicioLecturaVoz.leer(textoParaLeer(respuesta.datos));
  }, [respuesta]);

  const hablar = async () => {
    const proveedor = voz.current;
    if (!proveedor) return;
    if (escuchando) {
      proveedor.detener();
      return;
    }
    servicioLecturaVoz.detener();
    setAvisoVoz(null);
    setTranscrita(null);
    setParcial('');
    setEscuchando(true);
    try {
      const texto = await proveedor.escuchar({ idioma: 'es-CO', tiempoMaximoMs: 15_000, alParcial: setParcial });
      setTranscrita(texto.slice(0, MAX_CARACTERES_PREGUNTA));
    } catch (e) {
      if (e instanceof ErrorVoz && (e.causa === 'permiso_negado' || e.causa === 'no_disponible')) {
        setEstadoVoz({ tipo: 'no_disponible', motivo: e.message });
      } else {
        setAvisoVoz(e instanceof Error ? e.message : 'No te escuché. Intenta de nuevo o escribe tu pregunta.');
      }
    } finally {
      setEscuchando(false);
      setParcial('');
    }
  };

  const enviar = async (texto: string) => {
    const limpia = texto.trim();
    if (!limpia) {
      setErrorCampo('Escribe tu pregunta.');
      return;
    }
    setErrorCampo(null);
    setTranscrita(null);
    setError(null);
    setConsultando(true);
    servicioLecturaVoz.detener();
    try {
      const datos = await cliente.preguntar(limpia);
      contador.current += 1;
      setRespuesta({ numero: contador.current, pregunta: limpia, datos });
    } catch (e) {
      setRespuesta(null);
      setError(e instanceof ErrorAsistente ? e : new ErrorAsistente('servidor', 'No pudimos responder. Intenta de nuevo.'));
    } finally {
      setConsultando(false);
    }
  };

  const sinConexion = !enLinea || error?.causa === 'sin_conexion';
  const vozLista = estadoVoz.tipo === 'lista';

  return (
    <Pantalla titulo="Preguntar">
      {sinConexion ? (
        <Alerta titulo="El asistente necesita internet" tono="aviso" anunciar testID="aviso-sin-conexion">
          <Texto>No hay conexión. Sin internet puedes seguir usando:</Texto>
          <View style={{ gap: espacio.s }}>
            <Boton etiqueta="Me pararon" accessibilityRole="link" accessibilityLabel="Me pararon: grabar lo que pasa" variante="secundaria" href="/me-pararon" />
            <Boton
              etiqueta="Mis casos y evidencias"
              accessibilityRole="link"
              accessibilityLabel="Mis casos y evidencias"
              variante="secundaria"
              href="/casos"
            />
            <Boton
              etiqueta="Registrar un comparendo"
              accessibilityRole="link"
              accessibilityLabel="Registrar un comparendo"
              variante="secundaria"
              href="/comparendo/nuevo"
            />
            <Boton
              etiqueta="Ver mis plazos"
              descripcion="Están en cada caso"
              accessibilityRole="link"
              accessibilityLabel="Ver mis plazos. Están en cada caso"
              variante="secundaria"
              href="/casos"
            />
            {enLinea ? (
              <Boton
                etiqueta="Intentar de nuevo"
                accessibilityRole="button"
                accessibilityLabel="Intentar de nuevo la pregunta"
                onPress={() => setError(null)}
              />
            ) : null}
          </View>
        </Alerta>
      ) : (
        <>
          {estadoVoz.tipo === 'no_disponible' ? (
            <Alerta titulo="Puedes escribir tu pregunta" tono="aviso" anunciar testID="aviso-sin-voz">
              {estadoVoz.motivo}
            </Alerta>
          ) : (
            <Boton
              etiqueta={escuchando ? 'Te estoy escuchando' : 'Hablar'}
              descripcion={escuchando ? 'Toca cuando termines' : 'Toca y haz tu pregunta'}
              accessibilityRole="button"
              accessibilityLabel={escuchando ? 'Te estoy escuchando. Toca cuando termines' : 'Hablar. Toca y haz tu pregunta'}
              variante={escuchando ? 'peligro' : 'primaria'}
              deshabilitado={!vozLista || consultando}
              onPress={() => void hablar()}
              testID="boton-microfono"
              style={{ minHeight: 96, marginBottom: espacio.m }}
            />
          )}

          {escuchando && parcial ? (
            <Texto color="textoSuave" accessibilityLiveRegion="polite">
              {parcial}
            </Texto>
          ) : null}
          {avisoVoz ? (
            <Texto color="avisoTexto" negrita accessibilityLiveRegion="polite" testID="aviso-voz">
              {avisoVoz}
            </Texto>
          ) : null}

          {transcrita ? (
            <Tarjeta titulo="Esto entendí" testID="transcripcion">
              <Texto testID="texto-transcrito">{transcrita}</Texto>
              <View style={{ flexDirection: 'row', gap: espacio.s, flexWrap: 'wrap' }}>
                <Boton
                  etiqueta="Enviar"
                  accessibilityRole="button"
                  accessibilityLabel="Enviar la pregunta"
                  onPress={() => void enviar(transcrita)}
                  style={{ flexGrow: 1 }}
                />
                <Boton
                  etiqueta="Corregir"
                  accessibilityRole="button"
                  accessibilityLabel="Corregir la pregunta"
                  variante="secundaria"
                  onPress={() => {
                    setPregunta(transcrita);
                    setTranscrita(null);
                  }}
                  style={{ flexGrow: 1 }}
                />
              </View>
            </Tarjeta>
          ) : null}

          <CampoTexto
            etiqueta={vozLista ? 'O escribe tu pregunta' : 'Escribe tu pregunta'}
            valor={pregunta}
            alCambiar={(t) => {
              setPregunta(t);
              if (errorCampo) setErrorCampo(null);
            }}
            error={errorCampo}
            multilinea
            maxLength={MAX_CARACTERES_PREGUNTA}
            testID="campo-pregunta"
          />
          <Boton
            etiqueta={consultando ? 'Buscando…' : 'Enviar'}
            accessibilityRole="button"
            accessibilityLabel="Enviar la pregunta escrita"
            deshabilitado={consultando}
            onPress={() => void enviar(pregunta)}
            style={{ marginBottom: espacio.l }}
          />

          {consultando ? (
            <Texto color="textoSuave" accessibilityLiveRegion="polite">
              Buscando en la base de normas verificadas…
            </Texto>
          ) : null}
          {error ? (
            <Alerta titulo="No pudimos responder" tono="aviso" anunciar testID="error-asistente">
              {error.message}
            </Alerta>
          ) : null}

          {respuesta ? <TarjetaRespuesta key={respuesta.numero} respuesta={respuesta} /> : null}
        </>
      )}
    </Pantalla>
  );
}

function TarjetaRespuesta({ respuesta }: { respuesta: RespuestaMostrada }) {
  const { datos, pregunta } = respuesta;
  return (
    <View accessibilityLiveRegion="polite">
      <Tarjeta titulo="Respuesta" testID="respuesta">
        <Texto variante="nota" color="textoSuave">
          Preguntaste: {pregunta}
        </Texto>
        <Texto testID="texto-respuesta">{datos.texto}</Texto>
        {datos.sugerencia ? (
          <Texto color="textoSuave" testID="sugerencia">
            {datos.sugerencia}
          </Texto>
        ) : null}
        <BotonEscuchar texto={textoParaLeer(datos)} etiqueta="Repetir" que="la respuesta" testID="boton-repetir" />
        {datos.tipo === 'respuesta' && datos.citas.length > 0 ? (
          <>
            <Texto negrita>En qué norma se basa</Texto>
            <Texto variante="nota" color="textoSuave">
              Toca una norma para ver el texto exacto de la ley.
            </Texto>
            {datos.citas.map((cita) => (
              <TarjetaCita key={cita.id} cita={cita} testID="tarjeta-cita" />
            ))}
          </>
        ) : null}
        <AvisoLegal />
      </Tarjeta>
    </View>
  );
}
