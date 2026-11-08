import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Comparendo, ErrorComparendo, type CampoComparendo, type TipoComparendo } from '../../../src/core/Comparendo';
import { obtenerBaseNormativa } from '../../../src/core/cargarDatos';
import { FechaCivil } from '../../../src/core/FechaCivil';
import { ParserComparendo, type CampoOCR } from '../../../src/core/ParserComparendo';
import { ServicioOCR, type ProgresoOCR } from '../../../src/services/ServicioOCR';
import { obtenerServicioPlazos } from '../../../src/services/ServicioPlazos';
import { useCasos } from '../../../src/state/casos';
import { obtenerRepositorioCasos } from '../../../src/state/servicios';
import {
  Alerta,
  Boton,
  CampoTexto,
  Casilla,
  GrupoOpciones,
  Icono,
  Pantalla,
  Seccion,
  Tarjeta,
  TarjetaCita,
  Texto,
  useTema,
} from '../../../src/ui';
import { fechaCorta, leerFecha, obtenerCatalogo } from '../../../src/ui/caso/datosComparendo';
import { AyudaPantalla } from '../../../src/ui/guia/AyudaPantalla';

type Origen = 'foto' | 'manual';
/** Campos que el OCR puede marcar como dudosos (el tipo se elige siempre a mano). */
type CampoRevisable = Exclude<CampoOCR, 'tipo'>;
type Errores = Partial<Record<CampoComparendo, string>>;

const REVISABLES: readonly CampoRevisable[] = ['numero', 'fecha', 'placa', 'codigoInfraccion'];

const NOMBRE_CAMPO: Readonly<Record<CampoRevisable, string>> = {
  numero: 'el número del comparendo',
  fecha: 'la fecha de la infracción',
  placa: 'la placa',
  codigoInfraccion: 'el código de la infracción',
};

const MENSAJE_PENDIENTES = 'Antes de guardar, revisa los datos marcados con “Revisa este dato” y confírmalos.';

type EstadoLectura = { fase: 'inactiva' } | { fase: 'leyendo'; progreso: ProgresoOCR } | { fase: 'lista' } | { fase: 'fallo' };

export default function NuevoComparendo() {
  const { espacio, colores, radio } = useTema();
  const { caso: casoParam } = useLocalSearchParams<{ caso?: string }>();
  const casoId = typeof casoParam === 'string' && casoParam !== '' ? casoParam : null;
  const actualizarEnLista = useCasos((s) => s.actualizarEnLista);

  const [origen, setOrigen] = useState<Origen | null>(null);
  const [lectura, setLectura] = useState<EstadoLectura>({ fase: 'inactiva' });
  const [numero, setNumero] = useState('');
  const [fecha, setFecha] = useState('');
  const [placa, setPlaca] = useState('');
  const [codigo, setCodigo] = useState('');
  const [tipo, setTipo] = useState<TipoComparendo | null>(null);
  const [notificacion, setNotificacion] = useState('');
  const [dudosos, setDudosos] = useState<ReadonlySet<CampoRevisable>>(new Set());
  const [confirmados, setConfirmados] = useState<ReadonlySet<CampoRevisable>>(new Set());
  const [errores, setErrores] = useState<Errores>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Si el caso ya tiene comparendo, se abre para corregirlo.
  useEffect(() => {
    if (!casoId) return;
    let vigente = true;
    obtenerRepositorioCasos()
      .obtener(casoId)
      .then((caso) => {
        const c = caso?.comparendo;
        if (!vigente || !c) return;
        setOrigen('manual');
        setNumero(c.numero);
        setFecha(fechaCorta(c.fecha));
        setPlaca(c.placa ?? '');
        setCodigo(c.codigoInfraccion);
        setTipo(c.tipo);
        setNotificacion(c.fechaNotificacion ? fechaCorta(c.fechaNotificacion) : '');
      })
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [casoId]);

  const leerFoto = async () => {
    setErrorGeneral(null);
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, exif: false });
    const foto = r.canceled ? null : r.assets?.[0];
    if (!foto) return;
    setOrigen('foto');
    setLectura({ fase: 'leyendo', progreso: { etapa: 'preparando', progreso: 0 } });
    try {
      const { texto, palabras } = await new ServicioOCR().leer(foto.file ?? foto.uri, (progreso) =>
        setLectura({ fase: 'leyendo', progreso }),
      );
      const { campos } = new ParserComparendo().analizar(texto, palabras);
      setNumero(campos.numero.valor ?? '');
      setFecha(campos.fecha.valor ? fechaCorta(FechaCivil.desdeISO(campos.fecha.valor)) : '');
      setPlaca(campos.placa.valor ?? '');
      setCodigo(campos.codigoInfraccion.valor ?? '');
      if (campos.tipo.valor === 'fotodeteccion') setTipo('fotodeteccion');
      setDudosos(new Set(REVISABLES.filter((c) => campos[c].dudoso)));
      setConfirmados(new Set());
      setErrores({});
      setLectura({ fase: 'lista' });
    } catch {
      setOrigen('manual');
      setLectura({ fase: 'fallo' });
    }
  };

  // Las marcas de dudoso se conservan: si los datos vienen de una foto, siguen siendo lo que leyó el OCR
  // y no se pueden guardar sin confirmarlos aunque se cambie a escribir a mano (CA-09.2).
  const escribirAMano = () => {
    setOrigen('manual');
    setLectura({ fase: 'inactiva' });
    setErrorGeneral(null);
  };

  const alternarConfirmado = (campo: CampoRevisable, marcado: boolean) => {
    const siguiente = new Set(confirmados);
    if (marcado) siguiente.add(campo);
    else siguiente.delete(campo);
    setConfirmados(siguiente);
    if (errorGeneral === MENSAJE_PENDIENTES && REVISABLES.every((c) => !dudosos.has(c) || siguiente.has(c))) setErrorGeneral(null);
  };

  const guardar = async () => {
    // CA-09.2: lo que el OCR leyó con baja confianza no se guarda sin confirmación.
    if (REVISABLES.some((c) => dudosos.has(c) && !confirmados.has(c))) {
      setErrorGeneral(MENSAJE_PENDIENTES);
      return;
    }
    const nuevos: Errores = {};
    const fechaInfraccion = leerFecha(fecha);
    const hoy = obtenerServicioPlazos().hoy();
    if (!fechaInfraccion) nuevos.fecha = 'Escribe la fecha como día/mes/año, por ejemplo 13/11/2026.';
    else if (fechaInfraccion.esPosterior(hoy)) nuevos.fecha = 'La fecha de la infracción no puede ser después de hoy.';
    if (!tipo) nuevos.tipo = 'Elige cómo te hicieron el comparendo.';
    const fechaNotif = tipo === 'fotodeteccion' ? leerFecha(notificacion) : null;
    if (tipo === 'fotodeteccion' && !fechaNotif) {
      nuevos.fechaNotificacion = 'Escribe el día en que recibiste la notificación, por ejemplo 13/11/2026.';
    } else if (fechaNotif?.esPosterior(hoy)) {
      nuevos.fechaNotificacion = 'La fecha de la notificación no puede ser después de hoy.';
    }
    // CA-09.3: solo se aceptan códigos del catálogo verificado.
    const validacion = obtenerCatalogo().validarCodigo(codigo);
    if (codigo.trim() === '') nuevos.codigoInfraccion = 'Falta el código de la infracción.';
    else if (!validacion.valido) nuevos.codigoInfraccion = validacion.mensaje;

    let comparendo: Comparendo | null = null;
    if (Object.keys(nuevos).length === 0 && fechaInfraccion && tipo) {
      try {
        comparendo = Comparendo.crear({
          numero,
          fecha: fechaInfraccion,
          placa,
          codigoInfraccion: codigo,
          tipo,
          fechaNotificacion: fechaNotif,
          camposConfirmados: [...confirmados],
        });
      } catch (e) {
        if (e instanceof ErrorComparendo && e.campo !== 'camposConfirmados') nuevos[e.campo] = e.message;
        else setErrorGeneral('No pudimos guardar el comparendo. Revisa los datos.');
      }
    }
    // Errores de forma que Comparendo.crear también revisa, para mostrarlos todos a la vez.
    if (!nuevos.numero && Comparendo.normalizarNumero(numero) === '') nuevos.numero = 'Falta el número del comparendo.';
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0 || !comparendo) {
      setErrorGeneral('Revisa los datos marcados en rojo.');
      return;
    }

    setErrorGeneral(null);
    setGuardando(true);
    try {
      const repositorio = obtenerRepositorioCasos();
      let caso;
      if (casoId) {
        const existente = await repositorio.obtener(casoId);
        if (!existente) throw new Error('caso no encontrado');
        caso = existente.conComparendo(comparendo);
        await repositorio.guardar(caso);
      } else {
        caso = await repositorio.crear({ ubicacion: null, motivoSinUbicacion: 'no_disponible', comparendo, estado: 'abierto' });
      }
      actualizarEnLista(caso);
      router.replace(`/comparendo/${caso.id}`);
    } catch {
      setGuardando(false);
      setErrorGeneral('No pudimos guardar el comparendo. Intenta de nuevo.');
    }
  };

  const campoRevisable = (campo: CampoRevisable) => {
    if (!dudosos.has(campo)) return null;
    return (
      <Casilla
        marcada={confirmados.has(campo)}
        alCambiar={(m) => alternarConfirmado(campo, m)}
        accessibilityLabel={`Ya revisé ${NOMBRE_CAMPO[campo]} y está bien`}
        testID={`confirmar-${campo}`}
      >
        {`Ya revisé ${NOMBRE_CAMPO[campo]} y está bien`}
      </Casilla>
    );
  };
  const resaltado = (campo: CampoRevisable) => dudosos.has(campo) && !confirmados.has(campo);

  const citaNotificacion = obtenerBaseNormativa().cita('L1843-2017-art8');
  const leyendo = lectura.fase === 'leyendo';
  const porcentaje = leyendo ? Math.round(lectura.progreso.progreso * 100) : 0;

  return (
    <Pantalla
      titulo="Registrar un comparendo"
      descripcion="Guarda los datos de tu comparendo para saber qué significa y hasta cuándo tienes plazo."
      volverA={casoId ? `/casos/${casoId}` : '/inicio'}
      extraEncabezado={<AyudaPantalla pantalla="comparendo" />}
    >
      <Seccion titulo="¿Cómo quieres registrarlo?">
        <Boton
          etiqueta="Tomar foto del comparendo"
          descripcion="La app lee los datos. La foto no sale de tu celular."
          accessibilityRole="button"
          accessibilityLabel="Tomar foto del comparendo o elegir una guardada. La app lee los datos"
          icono="camara"
          alineacion="inicio"
          variante={origen ? 'secundaria' : 'primaria'}
          onPress={() => void leerFoto()}
          deshabilitado={leyendo || guardando}
          testID="comparendo-foto"
        />
        <Boton
          etiqueta="Escribir los datos"
          accessibilityRole="button"
          accessibilityLabel="Escribir los datos del comparendo a mano"
          descripcion="Copia los datos del papel"
          variante="secundaria"
          icono="nota"
          alineacion="inicio"
          onPress={escribirAMano}
          deshabilitado={leyendo || guardando}
          testID="comparendo-manual"
        />
      </Seccion>

      {leyendo ? (
        <Alerta
          titulo={lectura.progreso.etapa === 'preparando' ? 'Preparando el lector...' : 'Leyendo el comparendo...'}
          tono="info"
          testID="progreso-ocr"
        >
          <View
            accessibilityRole="progressbar"
            accessibilityLabel="Avance de la lectura"
            accessibilityValue={{ min: 0, max: 100, now: porcentaje }}
            style={{
              height: espacio.m,
              borderRadius: radio.s,
              backgroundColor: colores.superficie,
              borderWidth: 1,
              borderColor: colores.borde,
              overflow: 'hidden',
            }}
          >
            <View style={{ width: `${porcentaje}%`, height: '100%', backgroundColor: colores.primario }} />
          </View>
          <Texto accessibilityLiveRegion="polite">{porcentaje} %</Texto>
          <Texto variante="nota">La primera vez puede tardar un poco.</Texto>
        </Alerta>
      ) : null}

      {lectura.fase === 'fallo' ? (
        <Alerta titulo="No pudimos leer la foto" tono="aviso" icono="camara" anunciar testID="ocr-fallo">
          Escribe los datos a mano. Se guardan igual.
        </Alerta>
      ) : null}

      {origen && !leyendo ? (
        <Tarjeta
          titulo={origen === 'foto' ? 'Revisa los datos leídos' : 'Datos del comparendo'}
          descripcion="Cópialos tal como aparecen en el papel."
          icono="comparendo"
          testID="formulario-comparendo"
        >
          {REVISABLES.some((c) => dudosos.has(c) && !confirmados.has(c)) ? (
            <Alerta titulo="Hay datos por revisar" tono="aviso" anunciar>
              Compáralos con tu comparendo. Corrígelos si hace falta y marca la casilla “Ya revisé…” debajo de cada uno.
            </Alerta>
          ) : null}

          <CampoTexto
            etiqueta="Número del comparendo"
            valor={numero}
            alCambiar={setNumero}
            teclado="number-pad"
            dudoso={resaltado('numero')}
            error={errores.numero}
            testID="campo-numero"
          />
          {campoRevisable('numero')}
          <CampoTexto
            etiqueta="Fecha de la infracción"
            ayuda="Día/mes/año, por ejemplo 13/11/2026"
            valor={fecha}
            alCambiar={setFecha}
            dudoso={resaltado('fecha')}
            error={errores.fecha}
            testID="campo-fecha"
          />
          {campoRevisable('fecha')}
          <CampoTexto
            etiqueta="Placa"
            ayuda="Por ejemplo ABC123, o ABC12D si es moto"
            valor={placa}
            alCambiar={setPlaca}
            maxLength={7}
            dudoso={resaltado('placa')}
            error={errores.placa}
            testID="campo-placa"
          />
          {campoRevisable('placa')}
          <CampoTexto
            etiqueta="Código de la infracción"
            ayuda="Una letra y dos números, por ejemplo C02"
            valor={codigo}
            alCambiar={setCodigo}
            maxLength={5}
            dudoso={resaltado('codigoInfraccion')}
            error={errores.codigoInfraccion}
            testID="campo-codigo"
          />
          {campoRevisable('codigoInfraccion')}

          <Texto negrita>¿Cómo te hicieron el comparendo?</Texto>
          <GrupoOpciones<TipoComparendo>
            accessibilityLabel="Cómo te hicieron el comparendo"
            seleccion={tipo}
            alElegir={setTipo}
            opciones={[
              { valor: 'via', etiqueta: 'En la vía', descripcion: 'Un agente te lo entregó' },
              { valor: 'fotodeteccion', etiqueta: 'Por fotodetección', descripcion: 'Fotomulta: te llegó por correo' },
            ]}
          />
          {errores.tipo ? (
            <View
              accessibilityRole="alert"
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: espacio.s,
                backgroundColor: colores.peligroSuave,
                borderRadius: radio.s,
                paddingHorizontal: espacio.ms,
                paddingVertical: espacio.s,
              }}
            >
              <Icono nombre="alerta" color="peligroTexto" />
              <Texto negrita color="peligroTexto" style={{ flex: 1 }}>
                {errores.tipo}
              </Texto>
            </View>
          ) : null}

          {tipo === 'fotodeteccion' ? (
            <View style={{ marginTop: espacio.m }} testID="pregunta-notificacion">
              <CampoTexto
                etiqueta="¿Qué día recibiste la notificación?"
                ayuda="No es el día de la infracción. Es el día en que te llegó el comparendo a tu dirección. Tu plazo se cuenta desde ese día. Día/mes/año."
                valor={notificacion}
                alCambiar={setNotificacion}
                error={errores.fechaNotificacion}
                testID="fecha-notificacion"
              />
              {citaNotificacion ? (
                <>
                  <Texto variante="nota" color="textoSuave" style={{ marginBottom: espacio.s }}>
                    ¿Por qué te lo preguntamos? Lo dice esta norma:
                  </Texto>
                  <TarjetaCita cita={citaNotificacion} />
                </>
              ) : null}
            </View>
          ) : null}

          {errorGeneral ? (
            <Alerta titulo={errorGeneral} tono="peligro" anunciar testID="error-guardar" />
          ) : null}

          <View style={{ gap: espacio.m, marginTop: espacio.m }}>
            <Boton
              etiqueta={guardando ? 'Guardando...' : 'Guardar'}
              accessibilityRole="button"
              accessibilityLabel="Guardar el comparendo"
              icono="check"
              cargando={guardando}
              deshabilitado={guardando}
              onPress={() => void guardar()}
              testID="guardar-comparendo"
            />
          </View>
        </Tarjeta>
      ) : null}
    </Pantalla>
  );
}
