import { useEffect, useRef, useState } from 'react';
import { Image, Platform, View } from 'react-native';

import type { Caso } from '../../core/Caso';
import { CodificacionBase64 } from '../../core/CodificacionBase64';
import { Evidencia } from '../../core/Evidencia';
import type { ProveedorVoz } from '../../core/ProveedorVoz';
import { crearProveedorVoz } from '../../services/ProveedorTexto';
import { ErrorFoto, ServicioFotos, type OrigenFoto } from '../../services/ServicioFotos';
import { obtenerRepositorioCasos } from '../../state/servicios';
import { Alerta, Boton, CampoTexto, Tarjeta, Texto, Titulo, useTema } from '..';
import type { PropsSeccionCaso } from './tipos';

const ZONA = 'America/Bogota';

/** "jueves 13 de noviembre de 2026, 8:15 a. m." en hora de Colombia. */
export function fechaHoraEvidencia(iso: string): string {
  const d = new Date(iso);
  const fecha = new Intl.DateTimeFormat('es-CO', {
    timeZone: ZONA,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
  const hora = new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, hour: 'numeric', minute: '2-digit' }).format(d);
  return `${fecha.replace(',', '')}, ${hora}`;
}

function duracionLegible(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

const NOMBRE_TIPO = { audio: 'Audio', foto: 'Foto', nota: 'Nota' } as const;

/** Los mensajes de voz estan escritos para el asistente: aqui se habla de la nota. */
function paraNota(mensaje: string): string {
  return mensaje.replace(/tu pregunta/g, 'la nota');
}

/** Convierte los bytes descifrados en algo que la pantalla puede mostrar o reproducir. */
function urlDeContenido(bytes: Uint8Array<ArrayBuffer>, mime: string): string {
  if (Platform.OS === 'web') return URL.createObjectURL(new Blob([bytes], { type: mime }));
  return `data:${mime};base64,${CodificacionBase64.codificar(bytes)}`;
}

/** Lista de evidencias del caso y captura de fotos y notas (HU-08). Todo se guarda cifrado. */
export function SeccionEvidencias({ caso, onCambio }: PropsSeccionCaso) {
  const { colores, espacio, radio } = useTema();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [sinContenido, setSinContenido] = useState<Record<string, true>>({});
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const [notaAbierta, setNotaAbierta] = useState(false);
  const [textoNota, setTextoNota] = useState('');
  const [escuchando, setEscuchando] = useState(false);
  const [parcial, setParcial] = useState('');
  const [motivoSinVoz, setMotivoSinVoz] = useState<string | null>(null);
  const [vozLista, setVozLista] = useState(false);

  // Caso mas reciente: evita perder una evidencia si se agregan dos seguidas antes de re-renderizar.
  const casoActual = useRef<Caso>(caso);
  const pedidos = useRef(new Set<string>());
  const creadas = useRef<string[]>([]);
  const voz = useRef<ProveedorVoz | null>(null);

  useEffect(() => {
    casoActual.current = caso;
  }, [caso]);

  // Descifra el contenido de fotos y audios una sola vez por evidencia.
  useEffect(() => {
    const repo = obtenerRepositorioCasos();
    for (const evidencia of caso.evidencias) {
      if (!evidencia.tieneArchivo() || pedidos.current.has(evidencia.id) || !evidencia.mime) continue;
      pedidos.current.add(evidencia.id);
      const mime = evidencia.mime;
      repo
        .leerContenido(evidencia.id)
        .then((bytes) => {
          const url = urlDeContenido(bytes, mime);
          creadas.current.push(url);
          setUrls((previas) => ({ ...previas, [evidencia.id]: url }));
        })
        .catch(() => setSinContenido((previas) => ({ ...previas, [evidencia.id]: true })));
    }
  }, [caso]);

  useEffect(
    () => () => {
      voz.current?.detener();
      if (Platform.OS === 'web') for (const url of creadas.current) URL.revokeObjectURL(url);
    },
    [],
  );

  useEffect(() => {
    if (!notaAbierta) return;
    const proveedor = (voz.current ??= crearProveedorVoz());
    let vigente = true;
    void proveedor.disponible().then((d) => {
      if (!vigente) return;
      setVozLista(d.ok);
      setMotivoSinVoz(d.ok ? null : (d.motivo ?? null));
    });
    return () => {
      vigente = false;
    };
  }, [notaAbierta]);

  const guardar = async (evidencia: Evidencia, bytes?: Uint8Array<ArrayBuffer>) => {
    const actualizado = await obtenerRepositorioCasos().agregarEvidencia(casoActual.current, evidencia, bytes);
    casoActual.current = actualizado;
    if (bytes && evidencia.mime) {
      // Ya se tienen los bytes en claro: no hace falta volver a descifrarlos para mostrarlos.
      pedidos.current.add(evidencia.id);
      const url = urlDeContenido(bytes, evidencia.mime);
      creadas.current.push(url);
      setUrls((previas) => ({ ...previas, [evidencia.id]: url }));
    }
    onCambio(actualizado);
  };

  const agregarFoto = (origen: OrigenFoto) => {
    setError(null);
    setAviso(null);
    // El selector se abre en este mismo toque; lo asincrono va despues.
    new ServicioFotos()
      .elegir(origen)
      .then(async (foto) => {
        if (!foto) return;
        setOcupado(true);
        const evidencia = Evidencia.crear({
          id: obtenerRepositorioCasos().nuevoId(),
          tipo: 'foto',
          creadaEn: new Date().toISOString(),
          mime: foto.mime,
          tamano: foto.bytes.byteLength,
        });
        await guardar(evidencia, foto.bytes);
        setAviso('Foto guardada.');
      })
      .catch((e: unknown) => setError(e instanceof ErrorFoto ? e.message : 'No pudimos guardar la foto. Intenta de nuevo.'))
      .finally(() => setOcupado(false));
  };

  const dictar = () => {
    const proveedor = (voz.current ??= crearProveedorVoz());
    if (escuchando) {
      proveedor.detener();
      return;
    }
    setError(null);
    setEscuchando(true);
    setParcial('');
    proveedor
      .escuchar({ idioma: 'es-CO', tiempoMaximoMs: 30_000, alParcial: setParcial })
      .then((texto) => setTextoNota((previo) => (previo.trim() ? `${previo.trim()} ${texto}` : texto)))
      .catch((e: unknown) => setError(e instanceof Error ? paraNota(e.message) : 'No te escuché. Escribe la nota.'))
      .finally(() => {
        setEscuchando(false);
        setParcial('');
      });
  };

  const guardarNota = async () => {
    setError(null);
    setAviso(null);
    if (!textoNota.trim()) {
      setError('Escribe o dicta la nota antes de guardarla.');
      return;
    }
    setOcupado(true);
    try {
      const evidencia = Evidencia.crear({
        id: obtenerRepositorioCasos().nuevoId(),
        tipo: 'nota',
        creadaEn: new Date().toISOString(),
        texto: textoNota,
      });
      await guardar(evidencia);
      setTextoNota('');
      setNotaAbierta(false);
      setAviso('Nota guardada.');
    } catch {
      setError('No pudimos guardar la nota. Intenta de nuevo.');
    } finally {
      setOcupado(false);
    }
  };

  const evidencias = caso.evidenciasOrdenadas();

  return (
    <Tarjeta titulo="Evidencias" testID="seccion-evidencias">
      <Texto variante="nota" color="textoSuave">
        Se guardan cifradas en este celular. Solo se abren con tu PIN.
      </Texto>

      {evidencias.length === 0 ? (
        <Texto testID="sin-evidencias">Todavía no hay evidencias en este caso.</Texto>
      ) : (
        <View style={{ gap: espacio.m }} testID="lista-evidencias">
          {evidencias.map((evidencia) => {
            const cuando = fechaHoraEvidencia(evidencia.creadaEn);
            const url = urls[evidencia.id];
            return (
              <View
                key={evidencia.id}
                testID={`evidencia-${evidencia.tipo}`}
                style={{
                  borderWidth: 1,
                  borderColor: colores.bordeSuave,
                  borderRadius: radio.s,
                  padding: espacio.m,
                  gap: espacio.s,
                  backgroundColor: colores.superficieAlterna,
                }}
              >
                <Titulo nivel={3}>{NOMBRE_TIPO[evidencia.tipo]}</Titulo>
                <Texto variante="nota" testID="fecha-evidencia">
                  {cuando}
                </Texto>

                {evidencia.tipo === 'nota' ? <Texto testID="texto-nota">{evidencia.texto}</Texto> : null}

                {evidencia.tipo === 'foto' ? (
                  url ? (
                    <Image
                      source={{ uri: url }}
                      accessibilityLabel={`Foto del ${cuando}`}
                      testID="miniatura-foto"
                      resizeMode="cover"
                      style={{ width: 128, height: 128, borderRadius: radio.s, backgroundColor: colores.bordeSuave }}
                    />
                  ) : (
                    <Texto variante="nota" color="textoSuave">
                      {sinContenido[evidencia.id] ? 'No pudimos abrir esta foto.' : 'Abriendo la foto…'}
                    </Texto>
                  )
                ) : null}

                {evidencia.tipo === 'audio' ? (
                  <>
                    {evidencia.duracionMs !== null ? (
                      <Texto variante="nota">Duración: {duracionLegible(evidencia.duracionMs)}</Texto>
                    ) : null}
                    {Platform.OS !== 'web' ? (
                      <Texto variante="nota" color="textoSuave">
                        Para escuchar este audio abre VozVial en el navegador.
                      </Texto>
                    ) : url ? (
                      <audio
                        controls
                        preload="metadata"
                        src={url}
                        aria-label={`Audio del ${cuando}`}
                        data-testid="reproductor-audio"
                        style={{ width: '100%', minHeight: 56 }}
                      />
                    ) : (
                      <Texto variante="nota" color="textoSuave">
                        {sinContenido[evidencia.id] ? 'No pudimos abrir este audio.' : 'Abriendo el audio…'}
                      </Texto>
                    )}
                  </>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      {error ? (
        <Alerta titulo="Algo no salió bien" tono="aviso" anunciar testID="error-evidencia">
          <Texto>{error}</Texto>
        </Alerta>
      ) : null}
      {aviso ? (
        <Texto negrita color="exitoTexto" accessibilityLiveRegion="polite" testID="aviso-evidencia">
          {aviso}
        </Texto>
      ) : null}

      <View style={{ gap: espacio.m, marginTop: espacio.s }}>
        <Boton
          etiqueta="Tomar una foto"
          accessibilityRole="button"
          accessibilityLabel="Tomar una foto"
          variante="secundaria"
          deshabilitado={ocupado}
          onPress={() => agregarFoto('camara')}
          testID="boton-tomar-foto"
        />
        <Boton
          etiqueta="Elegir una foto guardada"
          accessibilityRole="button"
          accessibilityLabel="Elegir una foto guardada"
          variante="secundaria"
          deshabilitado={ocupado}
          onPress={() => agregarFoto('galeria')}
          testID="boton-elegir-foto"
        />

        {notaAbierta ? (
          <View style={{ gap: espacio.s }} testID="formulario-nota">
            <CampoTexto
              etiqueta="Tu nota"
              ayuda="Escribe o dicta lo que pasó: placa del agente, lo que te dijeron, testigos."
              valor={escuchando && parcial ? parcial : textoNota}
              alCambiar={setTextoNota}
              multilinea
              maxLength={2000}
              testID="campo-nota"
            />
            {vozLista ? (
              <Boton
                etiqueta={escuchando ? 'Escuchando… toca para parar' : 'Dictar la nota'}
                accessibilityRole="button"
                accessibilityLabel={escuchando ? 'Escuchando. Toca para parar' : 'Dictar la nota con tu voz'}
                variante="secundaria"
                onPress={dictar}
                testID="boton-dictar-nota"
              />
            ) : motivoSinVoz ? (
              <Texto variante="nota" color="textoSuave">
                {paraNota(motivoSinVoz)}
              </Texto>
            ) : null}
            <Boton
              etiqueta="Guardar la nota"
              accessibilityRole="button"
              accessibilityLabel="Guardar la nota"
              deshabilitado={ocupado || escuchando}
              onPress={() => void guardarNota()}
              testID="boton-guardar-nota"
            />
            <Boton
              etiqueta="Cancelar la nota"
              accessibilityRole="button"
              accessibilityLabel="Cancelar la nota"
              variante="secundaria"
              onPress={() => {
                voz.current?.detener();
                setNotaAbierta(false);
                setTextoNota('');
              }}
            />
          </View>
        ) : (
          <Boton
            etiqueta="Agregar una nota"
            accessibilityRole="button"
            accessibilityLabel="Agregar una nota escrita o dictada"
            variante="secundaria"
            deshabilitado={ocupado}
            onPress={() => {
              setAviso(null);
              setError(null);
              setNotaAbierta(true);
            }}
            testID="boton-agregar-nota"
          />
        )}
      </View>
    </Tarjeta>
  );
}
