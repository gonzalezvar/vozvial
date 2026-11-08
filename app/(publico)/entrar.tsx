import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ValidadorRegistro } from '../../src/core/ValidadorRegistro';
import { servicioLecturaVoz } from '../../src/services/ServicioLecturaVoz';
import { abrirSesion, conectarServidorEnSegundoPlano } from '../../src/state/cuenta';
import { obtenerServicioCuenta } from '../../src/state/servicios';
import { useSesion } from '../../src/state/sesion';
import { Alerta, Boton, CampoTexto, Cargando, Enlace, Pantalla, Texto, useTema } from '../../src/ui';
import { AyudaPantalla } from '../../src/ui/guia/AyudaPantalla';

function minutosSegundos(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** local: la cuenta esta en este dispositivo (solo PIN). celular: dispositivo nuevo (celular y PIN contra el servidor). */
type Modo = 'revisando' | 'local' | 'celular';

// HU-02: entrar con el PIN, intentos restantes, bloqueo temporal con contador y aviso de cierre por inactividad.
// En un dispositivo sin cuenta guardada se entra con celular y PIN, y los casos se bajan del servidor.
export default function Entrar() {
  const { espacio } = useTema();
  const motivoCierre = useSesion((s) => s.motivoCierre);
  const [modo, setModo] = useState<Modo>('revisando');
  const [celular, setCelular] = useState('');
  const [pin, setPin] = useState('');
  const [errorCelular, setErrorCelular] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [falloGeneral, setFalloGeneral] = useState<string | null>(null);
  const [bloqueadoHasta, setBloqueadoHasta] = useState<number | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  const [entrando, setEntrando] = useState(false);
  const [bajandoCasos, setBajandoCasos] = useState(false);
  const [desbloqueado, setDesbloqueado] = useState(false);

  // Al abrir la pantalla: se elige el modo y se recupera un bloqueo que siga vigente.
  useEffect(() => {
    const servicio = obtenerServicioCuenta();
    servicio
      .existeCuenta()
      .then(async (existe) => {
        setModo(existe ? 'local' : 'celular');
        if (!existe) return;
        const estado = await servicio.estadoIntentos();
        if (estado?.bloqueado) setBloqueadoHasta(Date.now() + estado.msRestantes);
      })
      .catch(() => setModo('celular'));
  }, []);

  useEffect(() => {
    if (bloqueadoHasta === null) return;
    const id = setInterval(() => {
      const t = Date.now();
      setAhora(t);
      if (t >= bloqueadoHasta) {
        setBloqueadoHasta(null);
        setDesbloqueado(true);
      }
    }, 250);
    return () => clearInterval(id);
  }, [bloqueadoHasta]);

  const bloqueado = bloqueadoHasta !== null && ahora < bloqueadoHasta;

  const bloquear = (ms: number) => {
    setAhora(Date.now());
    setBloqueadoHasta(Date.now() + ms);
  };

  const entrarLocal = async () => {
    const r = await obtenerServicioCuenta().entrar(pin);
    if (r.ok) {
      await abrirSesion({ claveDatos: r.claveDatos, perfil: r.perfil, sesion: null });
      // La copia del servidor se abre en segundo plano: entrar no depende de internet.
      conectarServidorEnSegundoPlano(pin, r.perfil);
      router.replace('/inicio');
      return;
    }
    setPin('');
    if (r.bloqueado) bloquear(r.msRestantes);
    else setError(`PIN incorrecto. Te quedan ${r.intentosRestantes} intento${r.intentosRestantes === 1 ? '' : 's'}.`);
  };

  const entrarConCelular = async () => {
    const r = await obtenerServicioCuenta().entrarConCelular(celular, pin);
    if (r.ok) {
      setBajandoCasos(true);
      await abrirSesion(r, { esperarCasos: true });
      router.replace('/inicio');
      return;
    }
    setPin('');
    if (r.motivo === 'credenciales') setError(r.mensaje);
    else if (r.motivo === 'bloqueada') bloquear(r.msRestantes);
    else if (r.motivo === 'celular_invalido') setErrorCelular(r.mensaje);
    else {
      setFalloGeneral(r.mensaje);
      servicioLecturaVoz.leer(r.mensaje);
    }
  };

  const entrar = async () => {
    setError(null);
    setErrorCelular(null);
    setFalloGeneral(null);
    setDesbloqueado(false);
    if (modo === 'celular' && !/^3\d{9}$/.test(ValidadorRegistro.normalizarCelular(celular))) {
      setErrorCelular('Escribe tu celular de 10 dígitos, por ejemplo 3001234567');
      return;
    }
    // Un PIN incompleto no gasta intentos: es un error al escribir, no un intento de adivinar.
    if (!/^\d{6}$/.test(pin)) {
      setError('Tu PIN tiene 6 números. Escríbelo completo.');
      return;
    }
    setEntrando(true);
    try {
      if (modo === 'local') await entrarLocal();
      else await entrarConCelular();
    } catch {
      setFalloGeneral('No pudimos entrar ahora. Intenta de nuevo.');
    } finally {
      setEntrando(false);
      setBajandoCasos(false);
    }
  };

  const descripcion =
    modo === 'celular'
      ? 'Escribe el celular con el que creaste tu cuenta y tu PIN. Tus casos se bajan a este dispositivo.'
      : 'Escribe tu PIN de 6 números.';

  return (
    <Pantalla
      titulo="Entrar"
      descripcion={descripcion}
      volverA="/bienvenida"
      extraEncabezado={<AyudaPantalla pantalla="entrar" />}
    >
      {motivoCierre === 'inactividad' ? (
        <Alerta titulo="Cerramos tu sesión" tono="info" anunciar testID="aviso-inactividad">
          Pasó un tiempo sin que usaras la app. Escribe tu PIN para seguir.
        </Alerta>
      ) : null}

      {bloqueado ? (
        <Alerta titulo="Entrada bloqueada" tono="urgente" anunciar testID="bloqueo">
          <Texto>
            Fallaste 5 veces seguidas. Por seguridad, espera para intentar de nuevo. Tiempo restante:{' '}
            <Texto negrita testID="tiempo-bloqueo">
              {minutosSegundos(bloqueadoHasta - ahora)}
            </Texto>
          </Texto>
        </Alerta>
      ) : null}

      {desbloqueado ? (
        <Alerta titulo="Ya puedes intentar de nuevo" tono="exito" anunciar testID="fin-bloqueo">
          Escribe tu PIN de 6 números.
        </Alerta>
      ) : null}

      {falloGeneral ? (
        <Alerta titulo="No pudiste entrar" tono="peligro" anunciar testID="fallo-entrar">
          {falloGeneral}
        </Alerta>
      ) : null}

      {modo === 'revisando' ? (
        <Cargando texto="Revisando tu cuenta" />
      ) : (
        <>
          {modo === 'celular' ? (
            <CampoTexto
              etiqueta="Tu celular"
              ayuda="El número con el que creaste tu cuenta."
              valor={celular}
              alCambiar={setCelular}
              teclado="phone-pad"
              maxLength={14}
              autoComplete="tel"
              error={errorCelular}
              testID="campo-celular-entrar"
            />
          ) : null}
          <CampoTexto
            etiqueta="Tu PIN"
            valor={pin}
            alCambiar={setPin}
            teclado="number-pad"
            maxLength={6}
            secreto
            autoComplete="one-time-code"
            error={error}
            alEnviar={() => void entrar()}
            testID="campo-pin-entrar"
          />

          {bajandoCasos ? <Cargando texto="Bajando tus casos a este dispositivo" testID="bajando-casos" /> : null}

          <View style={{ gap: espacio.ms, marginBottom: espacio.l }}>
            <Boton
              etiqueta="Entrar"
              accessibilityRole="button"
              accessibilityLabel="Entrar"
              icono="llave"
              cargando={entrando}
              onPress={() => void entrar()}
              deshabilitado={bloqueado || entrando}
              testID="boton-entrar"
            />
            <Boton
              etiqueta="Olvidé mi PIN"
              accessibilityRole="link"
              accessibilityLabel="Olvidé mi PIN"
              variante="texto"
              href="/recuperar"
            />
          </View>

          {modo === 'celular' ? (
            <Texto variante="nota" color="textoSuave">
              ¿Todavía no tienes cuenta? <Enlace href="/registro">Crea una aquí</Enlace>
            </Texto>
          ) : null}
        </>
      )}
    </Pantalla>
  );
}
