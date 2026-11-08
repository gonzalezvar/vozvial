import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ErrorCuenta } from '../../src/services/ServicioCuenta';
import { servicioLecturaVoz } from '../../src/services/ServicioLecturaVoz';
import type { EstadoSincronizacion } from '../../src/services/SincronizadorCasos';
import { borrarTodosMisDatos, cerrarSesion } from '../../src/state/cuenta';
import { obtenerSincronizador } from '../../src/state/servicios';
import { useSesion } from '../../src/state/sesion';
import { useSincronizacion } from '../../src/state/sincronizacion';
import {
  Alerta,
  Boton,
  CampoTexto,
  EtiquetaEstado,
  GrupoOpciones,
  Lista,
  ListaItem,
  Pantalla,
  Seccion,
  TAMANOS_LETRA,
  Tarjeta,
  Texto,
  useAjustes,
  useTema,
  type TamanoLetra,
  type TonoEstado,
} from '../../src/ui';
import { AyudaPantalla } from '../../src/ui/guia/AyudaPantalla';

const ESTADOS_COPIA: Record<EstadoSincronizacion, { texto: string; tono: TonoEstado }> = {
  sincronizando: { texto: 'Copiando', tono: 'neutro' },
  al_dia: { texto: 'Al día', tono: 'exito' },
  pendiente: { texto: 'Pendiente', tono: 'aviso' },
  sin_conexion: { texto: 'Sin internet', tono: 'aviso' },
  error: { texto: 'Detenida', tono: 'vencido' },
};

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' });
}

/** Estado de la copia cifrada en el servidor y boton para copiar ahora. */
function TarjetaCopia() {
  const { espacio } = useTema();
  const conToken = useSesion((s) => s.tokenServidor !== null);
  const estado = useSincronizacion((s) => s.estado);
  const mensaje = useSincronizacion((s) => s.mensaje);
  const ultimaVez = useSincronizacion((s) => s.ultimaVez);
  const etiqueta = conToken && estado ? ESTADOS_COPIA[estado] : { texto: 'Solo en este celular', tono: 'neutro' as const };

  return (
    <Tarjeta
      titulo="Copia en el servidor"
      icono="candado"
      descripcion="Tus casos se guardan cifrados en este celular y en el servidor. El servidor no puede leerlos."
      testID="estado-copia"
    >
      <View style={{ gap: espacio.s }}>
        <EtiquetaEstado texto={etiqueta.texto} tono={etiqueta.tono} testID="estado-copia-etiqueta" />
        {mensaje ? <Texto>{mensaje}</Texto> : null}
        {estado === 'al_dia' && ultimaVez && conToken ? (
          <Texto variante="nota" color="textoSuave">
            Última copia: {hora(ultimaVez)}
          </Texto>
        ) : null}
        {!conToken && !mensaje ? (
          <Texto variante="nota" color="textoSuave">
            Cuando entres con internet, tus casos se copian solos.
          </Texto>
        ) : null}
      </View>
      {conToken ? (
        <Boton
          etiqueta="Copiar ahora"
          accessibilityRole="button"
          accessibilityLabel="Copiar mis casos al servidor ahora"
          variante="secundaria"
          icono="candado"
          cargando={estado === 'sincronizando'}
          onPress={() => void obtenerSincronizador()?.sincronizarTodo()}
          testID="copiar-ahora"
        />
      ) : null}
    </Tarjeta>
  );
}

/** CA-14.4: confirma con el PIN y borra la cuenta, los casos y las evidencias del servidor y del celular. */
function SeccionBorrarTodo() {
  const { espacio } = useTema();
  const [confirmando, setConfirmando] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [falla, setFalla] = useState<string | null>(null);
  const [borrando, setBorrando] = useState(false);

  const cancelar = () => {
    setConfirmando(false);
    setPin('');
    setError(null);
    setFalla(null);
  };

  const borrar = async () => {
    setError(null);
    setFalla(null);
    if (!/^\d{6}$/.test(pin)) {
      setError('Escribe tu PIN de 6 números para confirmar.');
      return;
    }
    setBorrando(true);
    try {
      await borrarTodosMisDatos(pin);
      router.replace('/bienvenida');
    } catch (e) {
      setPin('');
      if (e instanceof ErrorCuenta && e.motivo === 'pin_incorrecto') {
        setError('El PIN no es correcto. No se borró nada.');
      } else {
        const mensaje = e instanceof ErrorCuenta ? e.message : 'No pudimos borrar tus datos. Intenta de nuevo. No se borró nada.';
        setFalla(mensaje);
        servicioLecturaVoz.leer(mensaje);
      }
      setBorrando(false);
    }
  };

  return (
    <Seccion
      titulo="Borrar todos mis datos"
      descripcion="Borra tu cuenta, tus casos y tus evidencias de este celular y del servidor."
      testID="seccion-borrar-todo"
    >
      {confirmando ? (
        <View style={{ gap: espacio.ms }}>
          <Alerta titulo="¿Borrar todos tus datos?" tono="peligro" anunciar testID="confirmar-borrado">
            No se puede deshacer. Escribe tu PIN para confirmar.
          </Alerta>
          {falla ? (
            <Alerta titulo="No se borró nada" tono="peligro" anunciar testID="fallo-borrado">
              {falla}
            </Alerta>
          ) : null}
          <CampoTexto
            etiqueta="Tu PIN para confirmar"
            valor={pin}
            alCambiar={setPin}
            teclado="number-pad"
            maxLength={6}
            secreto
            autoComplete="off"
            error={error}
            testID="campo-pin-borrar"
          />
          <Boton
            etiqueta={borrando ? 'Borrando…' : 'Sí, borrar todo'}
            accessibilityRole="button"
            accessibilityLabel="Sí, borrar todos mis datos"
            variante="peligro"
            icono="borrar"
            cargando={borrando}
            onPress={() => void borrar()}
            testID="confirmar-borrar-todo"
          />
          <Boton
            etiqueta="No, cancelar"
            accessibilityRole="button"
            accessibilityLabel="No, cancelar el borrado"
            variante="secundaria"
            deshabilitado={borrando}
            onPress={cancelar}
          />
        </View>
      ) : (
        <Boton
          etiqueta="Borrar todos mis datos"
          accessibilityRole="button"
          accessibilityLabel="Borrar todos mis datos"
          variante="peligroSecundaria"
          icono="borrar"
          onPress={() => setConfirmando(true)}
          testID="borrar-todo"
        />
      )}
    </Seccion>
  );
}

export default function Ajustes() {
  const { espacio, tipo } = useTema();
  const tamano = useAjustes((e) => e.tamanoLetra);
  const cambiar = useAjustes((e) => e.cambiarTamanoLetra);

  const salir = () => {
    cerrarSesion('usuario');
    router.replace('/entrar');
  };

  return (
    <Pantalla
      titulo="Ajustes"
      descripcion="Elige el tamaño de la letra, revisa la copia de tus casos y controla tus datos."
      extraEncabezado={<AyudaPantalla pantalla="ajustes" />}
    >
      <View style={{ gap: espacio.s }}>
        <Tarjeta titulo="Tamaño de letra" icono="letra">
          <GrupoOpciones<TamanoLetra>
            accessibilityLabel="Tamaño de letra"
            seleccion={tamano}
            alElegir={cambiar}
            testID="tamano-letra"
            opciones={TAMANOS_LETRA.map((t) => ({ valor: t.id, etiqueta: t.nombre, descripcion: `Letra de ${t.base} puntos` }))}
          />
          <Texto testID="muestra-letra" style={{ marginTop: espacio.s }}>
            Así se ve el texto ({tipo.base} px).
          </Texto>
        </Tarjeta>

        <TarjetaCopia />

        <Seccion titulo="Tu información">
          <Lista accessibilityLabel="Tu información">
            <ListaItem titulo="Política de datos" descripcion="Qué guardamos y dónde" icono="escudo" href="/privacidad" />
            <ListaItem titulo="Acerca del prototipo" descripcion="Qué es real y qué es simulado" icono="info" href="/acerca" />
            <ListaItem
              titulo="Cerrar sesión"
              descripcion="Para volver a entrar necesitas tu PIN"
              icono="salir"
              peligro
              accessibilityRole="button"
              accessibilityLabel="Cerrar sesión"
              onPress={salir}
              testID="cerrar-sesion"
            />
          </Lista>
        </Seccion>

        <SeccionBorrarTodo />
      </View>
    </Pantalla>
  );
}
