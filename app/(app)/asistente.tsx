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
import { useSesion } from '../../src/state/sesion';
import {
  Alerta,
  AvisoLegal,
  Boton,
  BotonEscuchar,
  CampoTexto,
  Cargando,
  Icono,
  Lista,
  ListaItem,
  Pantalla,
  Tarjeta,
  TarjetaCita,
  Texto,
  Titulo,
  useTema,
} from '../../src/ui';
import { AyudaPantalla } from '../../src/ui/guia/AyudaPantalla';

const cliente = new ClienteAsistente();

interface RespuestaMostrada {
  /** Cambia en cada respuesta para volver a leerla aunque el texto se repita. */
  numero: number;
  pregunta: string;
  datos: RespuestaAsistente;
}

type EstadoVoz = { tipo: 'revisando' } | { tipo: 'lista' } | { tipo: 'no_disponible'; motivo: string };

const AVISO_IA = 'Respuesta redactada con IA (Claude) a partir de los artículos citados. Revisa el texto de la norma.';

function esDeClaude(r: RespuestaAsistente): boolean {
  return r.modo === 'claude' && r.tipo === 'respuesta';
}

function textoParaLeer(r: RespuestaAsistente): string {
  // Quien solo escucha también debe saber que el texto lo redactó la IA.
  const partes = [r.texto, esDeClaude(r) ? AVISO_IA : null, r.sugerencia ?? null];
  return partes.filter(Boolean).join(' ');
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

  // Mientras se escucha la voz o se espera la respuesta la sesion no se cierra por inactividad:
  // la persona no toca la pantalla y la respuesta se perderia.
  useEffect(() => {
    if (!consultando && !escuchando) return;
    useSesion.getState().tocar();
    const intervalo = setInterval(() => useSesion.getState().tocar(), 500);
    return () => clearInterval(intervalo);
  }, [consultando, escuchando]);

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
    <Pantalla
      titulo="Preguntar"
      descripcion="Pregunta por tus derechos. Cada respuesta dice de qué ley sale."
      extraEncabezado={<AyudaPantalla pantalla="asistente" />}
    >
      {sinConexion ? (
        <Alerta titulo="El asistente necesita internet" tono="aviso" anunciar testID="aviso-sin-conexion">
          <Texto>No hay conexión. Sin internet puedes seguir usando:</Texto>
          <Lista accessibilityLabel="Lo que funciona sin internet" style={{ marginBottom: 0 }}>
            <ListaItem icono="grabar" titulo="Me pararon" descripcion="Grabar lo que pasa" href="/me-pararon" />
            <ListaItem icono="casos" titulo="Mis casos y evidencias" href="/casos" />
            <ListaItem icono="comparendo" titulo="Registrar un comparendo" href="/comparendo/nuevo" />
            <ListaItem icono="calendario" titulo="Ver mis plazos" descripcion="Están en cada caso" href="/casos" />
          </Lista>
          {enLinea ? (
            <Boton
              etiqueta="Intentar de nuevo"
              accessibilityRole="button"
              accessibilityLabel="Intentar de nuevo la pregunta"
              onPress={() => setError(null)}
            />
          ) : null}
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
              variante={escuchando ? 'urgencia' : 'primaria'}
              icono={escuchando ? 'detener' : 'microfono'}
              deshabilitado={!vozLista || consultando}
              onPress={() => void hablar()}
              testID="boton-microfono"
              style={{ marginBottom: espacio.l }}
            />
          )}

          {escuchando && parcial ? (
            <Texto color="textoSuave" accessibilityLiveRegion="polite">
              {parcial}
            </Texto>
          ) : null}
          {avisoVoz ? (
            <View style={{ flexDirection: 'row', gap: espacio.s, alignItems: 'flex-start', marginBottom: espacio.m }}>
              <Icono nombre="alerta" color="avisoTexto" />
              <Texto color="avisoTexto" negrita accessibilityLiveRegion="polite" testID="aviso-voz" style={{ flex: 1 }}>
                {avisoVoz}
              </Texto>
            </View>
          ) : null}

          {transcrita ? (
            <Tarjeta titulo="Esto entendí" icono="microfono" variante="resaltada" testID="transcripcion">
              <Texto testID="texto-transcrito">{transcrita}</Texto>
              <View style={{ flexDirection: 'row', gap: espacio.s, flexWrap: 'wrap' }}>
                <Boton
                  etiqueta="Enviar"
                  accessibilityRole="button"
                  accessibilityLabel="Enviar la pregunta"
                  iconoFinal="enviar"
                  onPress={() => void enviar(transcrita)}
                  style={{ flexGrow: 1 }}
                />
                <Boton
                  etiqueta="Corregir"
                  accessibilityRole="button"
                  accessibilityLabel="Corregir la pregunta"
                  variante="secundaria"
                  icono="nota"
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
            ayuda="Por ejemplo: ¿Me pueden inmovilizar el carro? No escribas tu nombre, tu cédula ni tu placa."
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
            variante={vozLista ? 'secundaria' : 'primaria'}
            iconoFinal="enviar"
            deshabilitado={consultando}
            onPress={() => void enviar(pregunta)}
            style={{ marginBottom: espacio.l }}
          />

          {consultando ? <Cargando texto="Buscando en la base de normas verificadas…" /> : null}
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
      <Tarjeta titulo="Respuesta" icono="conversacion" testID="respuesta">
        <Texto variante="nota" color="textoSuave">
          Preguntaste: {pregunta}
        </Texto>
        <Texto testID="texto-respuesta">{datos.texto}</Texto>
        {esDeClaude(datos) ? (
          <Texto color="textoSuave" testID="aviso-ia">
            {AVISO_IA}
          </Texto>
        ) : null}
        {datos.sugerencia ? (
          <Texto color="textoSuave" testID="sugerencia">
            {datos.sugerencia}
          </Texto>
        ) : null}
        <BotonEscuchar texto={textoParaLeer(datos)} etiqueta="Repetir" que="la respuesta" variante="tonal" testID="boton-repetir" />
        {datos.tipo === 'respuesta' && datos.citas.length > 0 ? (
          <>
            <Titulo nivel={3}>En qué norma se basa</Titulo>
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
