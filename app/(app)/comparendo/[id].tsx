import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import infraccionesJSON from '../../../data/infracciones.json';
import type { Caso } from '../../../src/core/Caso';
import type { Infraccion } from '../../../src/core/CatalogoInfracciones';
import { obtenerBaseNormativa } from '../../../src/core/cargarDatos';
import { FechaCivil } from '../../../src/core/FechaCivil';
import { ACCION_PLAZO, obtenerServicioPlazos, type EstadoPlazo } from '../../../src/services/ServicioPlazos';
import { obtenerRepositorioCasos } from '../../../src/state/servicios';
import { Alerta, Boton, Cargando, EstadoVacio, Pantalla, Tarjeta, TarjetaCita, Texto, useTema } from '../../../src/ui';
import { DatoEnLinea } from '../../../src/ui/caso/DatoEnLinea';
import { ETIQUETA_TIPO, fechaCorta, obtenerCatalogo, sancionLegible, ubicacionEnArticulo } from '../../../src/ui/caso/datosComparendo';
import { AyudaPantalla } from '../../../src/ui/guia/AyudaPantalla';

type Carga = { estado: 'cargando' } | { estado: 'listo'; caso: Caso } | { estado: 'no_existe' } | { estado: 'error' };

const ID_UVB = 'L2294-2023-art313';

function formatoPesos(valor: number): string {
  return `$${Math.round(valor).toLocaleString('es-CO')}`;
}

export default function DetalleComparendo() {
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
          <Cargando texto="Abriendo el comparendo" />
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
  const comparendo = caso.comparendo;
  if (!comparendo) {
    return (
      <Pantalla titulo="Tu comparendo" volverA={`/casos/${caso.id}`}>
        <EstadoVacio
          icono="comparendo"
          titulo="Este caso todavía no tiene comparendo"
          texto="Regístralo para ver qué significa la infracción y cuánto tiempo tienes."
          accion={{
            etiqueta: 'Registrar el comparendo',
            accessibilityLabel: 'Registrar el comparendo de este caso',
            href: { pathname: '/comparendo/nuevo', params: { caso: caso.id } },
            icono: 'comparendo',
          }}
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
    <Pantalla
      titulo="Tu comparendo"
      descripcion="Tu plazo, qué significa la infracción y cuánto cuesta, con la ley de donde sale."
      volverA={`/casos/${caso.id}`}
      testID="detalle-comparendo"
      extraEncabezado={<AyudaPantalla pantalla="comparendo" />}
      pie={
        <>
          <Boton
            etiqueta="Ver el caso"
            accessibilityRole="link"
            accessibilityLabel="Ver el caso completo"
            icono="casos"
            href={`/casos/${caso.id}`}
          />
          <Boton
            etiqueta="Generar solicitud"
            accessibilityRole="link"
            accessibilityLabel="Generar solicitud de audiencia"
            variante="secundaria"
            icono="solicitud"
            href={`/solicitud/${caso.id}`}
          />
          <Boton
            etiqueta="Preguntar sobre esto"
            accessibilityRole="link"
            accessibilityLabel="Preguntar sobre esto al asistente"
            variante="secundaria"
            icono="conversacion"
            href="/asistente"
          />
          <Boton
            etiqueta="Corregir los datos"
            accessibilityRole="link"
            accessibilityLabel="Corregir los datos del comparendo"
            variante="texto"
            icono="nota"
            href={{ pathname: '/comparendo/nuevo', params: { caso: caso.id } }}
          />
        </>
      }
    >
      {plazo ? (
        <PanelPlazo plazo={plazo} fotodeteccion={comparendo.tipo === 'fotodeteccion'} />
      ) : (
        <Alerta titulo="No pudimos calcular tu plazo" tono="aviso">
          Pregunta tu plazo en el organismo de tránsito.
        </Alerta>
      )}

      <Tarjeta titulo="Datos del comparendo" icono="comparendo" testID="datos-comparendo">
        <DatoEnLinea etiqueta="Número">{comparendo.numero}</DatoEnLinea>
        <DatoEnLinea etiqueta="Fecha de la infracción">{fechaCorta(comparendo.fecha)}</DatoEnLinea>
        <DatoEnLinea etiqueta="Placa">{comparendo.placa ?? 'Sin placa'}</DatoEnLinea>
        <DatoEnLinea etiqueta="Código">{comparendo.codigoInfraccion}</DatoEnLinea>
        <DatoEnLinea etiqueta="Cómo fue">{ETIQUETA_TIPO[comparendo.tipo]}</DatoEnLinea>
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
        icono="ley"
        iconoFinal={verFuentes ? 'arriba' : 'abajo'}
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
  const { colores, espacio, radio, tipo, peso } = useTema();
  const [abierto, setAbierto] = useState(false);
  const cita = obtenerBaseNormativa().cita(infraccion.articuloId);
  const articulo = cita ? `Artículo ${cita.articulo} de la ${cita.norma}` : 'Código Nacional de Tránsito';
  return (
    <Tarjeta titulo="Qué significa" icono="ley" testID="significado-infraccion">
      <Texto
        testID="descripcion-sencilla"
        style={{ fontSize: tipo.subtitulo, lineHeight: tipo.alturaLinea(tipo.subtitulo), fontWeight: peso.medio }}
      >
        {infraccion.descripcionSencilla}
      </Texto>
      <Texto testID="articulo-infraccion" color="textoSuave">
        Código {infraccion.codigo}. {articulo}, {ubicacionEnArticulo(infraccion)}.
      </Texto>
      {infraccion.otrasConsecuencias ? <Texto>{infraccion.otrasConsecuencias}</Texto> : null}
      <Boton
        etiqueta={abierto ? 'Ocultar el texto de la ley' : 'Ver el texto de la ley'}
        accessibilityRole="button"
        accessibilityLabel={abierto ? 'Ocultar el texto de la ley' : 'Ver el texto de la ley, tal como está escrito'}
        variante="texto"
        alineacion="inicio"
        iconoFinal={abierto ? 'arriba' : 'abajo'}
        onPress={() => setAbierto((a) => !a)}
        testID="ver-texto-literal"
      />
      {abierto ? (
        <View style={{ gap: espacio.s }}>
          <View
            testID="texto-literal"
            style={{
              borderLeftWidth: espacio.xs,
              borderLeftColor: colores.borde,
              backgroundColor: colores.superficieAlterna,
              padding: espacio.m,
              borderRadius: radio.m,
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
    <Tarjeta titulo="Cuánto cuesta" icono="info" testID="valor-referencia">
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
