import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import infraccionesJSON from '../../../data/infracciones.json';
import type { Caso } from '../../../src/core/Caso';
import type { Infraccion } from '../../../src/core/CatalogoInfracciones';
import { obtenerBaseNormativa } from '../../../src/core/cargarDatos';
import { FechaCivil } from '../../../src/core/FechaCivil';
import { ACCION_PLAZO, obtenerServicioPlazos, type EstadoPlazo } from '../../../src/services/ServicioPlazos';
import { obtenerRepositorioCasos } from '../../../src/state/servicios';
import { Alerta, Boton, Pantalla, Tarjeta, TarjetaCita, Texto, useTema } from '../../../src/ui';
import { ETIQUETA_TIPO, fechaCorta, obtenerCatalogo, sancionLegible, ubicacionEnArticulo } from '../../../src/ui/caso/datosComparendo';

type Carga = { estado: 'cargando' } | { estado: 'listo'; caso: Caso } | { estado: 'no_existe' } | { estado: 'error' };

const ID_UVB = 'L2294-2023-art313';

function formatoPesos(valor: number): string {
  return `$${Math.round(valor).toLocaleString('es-CO')}`;
}

export default function DetalleComparendo() {
  const { colores } = useTema();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [carga, setCarga] = useState<Carga>({ estado: 'cargando' });

  useEffect(() => {
    let vigente = true;
    obtenerRepositorioCasos()
      .obtener(String(id))
      .then((caso) => vigente && setCarga(caso ? { estado: 'listo', caso } : { estado: 'no_existe' }))
      .catch(() => vigente && setCarga({ estado: 'error' }));
    return () => {
      vigente = false;
    };
  }, [id]);

  if (carga.estado !== 'listo') {
    return (
      <Pantalla titulo={carga.estado === 'cargando' ? 'Abriendo el comparendo' : 'Comparendo no disponible'} volverA="/casos">
        {carga.estado === 'cargando' ? (
          <ActivityIndicator size="large" color={colores.primario} accessibilityLabel="Abriendo el comparendo" />
        ) : (
          <Alerta titulo={carga.estado === 'no_existe' ? 'Este caso no existe' : 'No pudimos abrir el caso'} tono="aviso" anunciar>
            {carga.estado === 'no_existe' ? 'Puede que lo hayas borrado.' : 'Intenta de nuevo.'}
          </Alerta>
        )}
      </Pantalla>
    );
  }

  const { caso } = carga;
  const comparendo = caso.comparendo;
  if (!comparendo) {
    return (
      <Pantalla titulo="Tu comparendo" volverA={`/casos/${caso.id}`}>
        <Texto>Este caso todavía no tiene comparendo.</Texto>
        <Boton
          etiqueta="Registrar el comparendo"
          accessibilityRole="link"
          accessibilityLabel="Registrar el comparendo de este caso"
          href={{ pathname: '/comparendo/nuevo', params: { caso: caso.id } }}
        />
      </Pantalla>
    );
  }

  let plazo: EstadoPlazo | null = null;
  try {
    plazo = obtenerServicioPlazos().estado(comparendo);
  } catch {
    plazo = null;
  }
  const infraccion = obtenerCatalogo().buscar(comparendo.codigoInfraccion);

  return (
    <Pantalla titulo="Tu comparendo" volverA={`/casos/${caso.id}`} testID="detalle-comparendo">
      {plazo ? (
        <PanelPlazo plazo={plazo} fotodeteccion={comparendo.tipo === 'fotodeteccion'} />
      ) : (
        <Alerta titulo="No pudimos calcular tu plazo" tono="aviso">
          Pregunta tu plazo en el organismo de tránsito.
        </Alerta>
      )}

      <Tarjeta titulo="Datos del comparendo" testID="datos-comparendo">
        <Texto>Número: {comparendo.numero}</Texto>
        <Texto>Fecha de la infracción: {fechaCorta(comparendo.fecha)}</Texto>
        <Texto>Placa: {comparendo.placa ?? 'Sin placa'}</Texto>
        <Texto>Código: {comparendo.codigoInfraccion}</Texto>
        <Texto>Cómo fue: {ETIQUETA_TIPO[comparendo.tipo]}</Texto>
        {comparendo.fechaNotificacion ? (
          <Texto>Recibiste la notificación el {fechaCorta(comparendo.fechaNotificacion)}</Texto>
        ) : null}
      </Tarjeta>

      {infraccion ? (
        <>
          <SignificadoInfraccion infraccion={infraccion} />
          <ValorInfraccion infraccion={infraccion} anio={plazo?.hoy.anio ?? comparendo.fecha.anio} />
        </>
      ) : (
        <Alerta titulo="No tenemos información verificada de este código" tono="aviso">
          Revisa el código o pregunta en el organismo de tránsito.
        </Alerta>
      )}

      <View style={{ gap: 16 }}>
        <Boton etiqueta="Ver el caso" accessibilityRole="link" accessibilityLabel="Ver el caso completo" href={`/casos/${caso.id}`} />
        <Boton
          etiqueta="Generar solicitud"
          accessibilityRole="link"
          accessibilityLabel="Generar solicitud de audiencia"
          variante="secundaria"
          href={`/solicitud/${caso.id}`}
        />
        <Boton
          etiqueta="Preguntar sobre esto"
          accessibilityRole="link"
          accessibilityLabel="Preguntar sobre esto al asistente"
          variante="secundaria"
          href="/asistente"
        />
        <Boton
          etiqueta="Corregir los datos"
          accessibilityRole="link"
          accessibilityLabel="Corregir los datos del comparendo"
          variante="secundaria"
          href={{ pathname: '/comparendo/nuevo', params: { caso: caso.id } }}
        />
      </View>
    </Pantalla>
  );
}

/** CA-11.1 a CA-11.4: fecha límite, días restantes, qué fecha se usó y de dónde sale. */
function PanelPlazo({ plazo, fotodeteccion }: { plazo: EstadoPlazo; fotodeteccion: boolean }) {
  const { espacio } = useTema();
  const [verFuentes, setVerFuentes] = useState(false);
  const { resultado, nivel } = plazo;
  const citas = obtenerBaseNormativa().citas(resultado.sustento);
  const tono = nivel === 'en_tiempo' ? 'info' : nivel === 'vencido' ? 'aviso' : 'urgente';
  return (
    <Alerta titulo={plazo.mensaje.replace(/\.$/, '')} tono={tono} testID="dias-restantes">
      <Texto negrita testID="fecha-limite">
        {nivel === 'vencido' ? 'La fecha límite era el' : 'Tu fecha límite es el'} {resultado.fechaLimite.formatoLargo()}.
      </Texto>
      <Texto>
        Es el plazo para {ACCION_PLAZO}: {resultado.diasHabiles} días hábiles.
      </Texto>
      <Texto variante="nota" testID="explicacion-plazo">
        {resultado.explicacion}
      </Texto>
      {fotodeteccion ? (
        <Texto variante="nota">
          Si el comparendo te llegó solo por correo electrónico o por aviso, este cálculo puede no aplicar. Confírmalo en el
          organismo de tránsito.
        </Texto>
      ) : null}
      <Boton
        etiqueta={verFuentes ? 'Ocultar de dónde sale' : '¿De dónde sale este plazo?'}
        accessibilityRole="button"
        accessibilityLabel={
          verFuentes ? 'Ocultar de dónde sale el plazo' : '¿De dónde sale este plazo? Ver las normas de las que sale'
        }
        variante="secundaria"
        onPress={() => setVerFuentes((v) => !v)}
      />
      {verFuentes ? (
        <View style={{ gap: espacio.s }}>
          {citas.map((c) => (
            <TarjetaCita key={c.id} cita={c} />
          ))}
        </View>
      ) : null}
    </Alerta>
  );
}

/** CA-10.1: descripción sencilla, artículo y texto literal desplegable. */
function SignificadoInfraccion({ infraccion }: { infraccion: Infraccion }) {
  const { colores, espacio, radio } = useTema();
  const [abierto, setAbierto] = useState(false);
  const cita = obtenerBaseNormativa().cita(infraccion.articuloId);
  const articulo = cita ? `Artículo ${cita.articulo} de la ${cita.norma}` : 'Código Nacional de Tránsito';
  return (
    <Tarjeta titulo="Qué significa" testID="significado-infraccion">
      <Texto variante="destacado" testID="descripcion-sencilla">
        {infraccion.descripcionSencilla}
      </Texto>
      <Texto testID="articulo-infraccion" style={{ marginVertical: espacio.s }}>
        Código {infraccion.codigo}. {articulo}, {ubicacionEnArticulo(infraccion)}.
      </Texto>
      {infraccion.otrasConsecuencias ? <Texto>{infraccion.otrasConsecuencias}</Texto> : null}
      <Boton
        etiqueta={abierto ? 'Ocultar el texto de la ley' : 'Ver el texto de la ley'}
        accessibilityRole="button"
        accessibilityLabel={abierto ? 'Ocultar el texto de la ley' : 'Ver el texto de la ley, tal como está escrito'}
        variante="secundaria"
        onPress={() => setAbierto((a) => !a)}
        testID="ver-texto-literal"
      />
      {abierto ? (
        <View style={{ gap: espacio.s, marginTop: espacio.m }}>
          <View
            testID="texto-literal"
            style={{
              borderLeftWidth: 4,
              borderLeftColor: colores.bordeSuave,
              backgroundColor: colores.superficieAlterna,
              padding: espacio.m,
              borderRadius: radio.s,
            }}
          >
            <Texto>“{infraccion.descripcionLiteral}”</Texto>
          </View>
          {cita ? (
            <>
              <Texto variante="nota" color="textoSuave">
                Artículo completo, con su fuente oficial:
              </Texto>
              <TarjetaCita cita={cita} />
            </>
          ) : null}
        </View>
      ) : null}
    </Tarjeta>
  );
}

/** CA-10.2: valor con unidad, vigencia y fuente. Sin valor en pesos verificado, se dice así. */
function ValorInfraccion({ infraccion, anio }: { infraccion: Infraccion; anio: number }) {
  const { espacio } = useTema();
  const base = obtenerBaseNormativa();
  const citaArticulo = base.cita(infraccion.articuloId);
  const citaUvb = base.cita(ID_UVB);
  const consulta = FechaCivil.desdeISO(infraccionesJSON.fecha_consulta).formatoLargo();
  const fuente = citaArticulo ? `el artículo ${citaArticulo.articulo} de la ${citaArticulo.norma}` : 'el Código Nacional de Tránsito';
  const valor = infraccion.valorReferencia;
  const sancion = sancionLegible(infraccion);

  return (
    <Tarjeta titulo="Cuánto cuesta" testID="valor-referencia">
      {valor ? (
        <Texto negrita>
          Valor de referencia para {valor.vigencia} según {valor.fuente}: {formatoPesos(valor.pesos)}. Confirma en SIMIT.
        </Texto>
      ) : (
        <View style={{ gap: espacio.s }}>
          {sancion ? (
            <Texto negrita testID="sancion-unidad">
              Multa en el Código de Tránsito: {sancion}.
            </Texto>
          ) : (
            <Texto negrita>Esta infracción no tiene una multa fija en el catálogo verificado.</Texto>
          )}
          <Texto variante="nota" testID="fuente-valor">
            Fuente: {fuente}, texto vigente consultado el {consulta}.
          </Texto>
          <Texto testID="sin-valor-pesos">
            Desde 2024 las multas que estaban en salarios mínimos se calculan en UVB (Unidad de Valor Básico). VozVial todavía
            no tiene verificado el valor en pesos para {anio}.
          </Texto>
          <Texto negrita>Confirma el valor en SIMIT.</Texto>
          {citaUvb ? <TarjetaCita cita={citaUvb} /> : null}
        </View>
      )}
    </Tarjeta>
  );
}
