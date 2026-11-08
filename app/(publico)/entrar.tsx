import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { obtenerServicioCuenta } from '../../src/state/servicios';
import { useSesion } from '../../src/state/sesion';
import { Alerta, Boton, CampoTexto, Enlace, Pantalla, Texto, useTema } from '../../src/ui';

function minutosSegundos(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

// HU-02: entrar con el PIN, intentos restantes, bloqueo temporal con contador y aviso de cierre por inactividad.
export default function Entrar() {
  const { espacio } = useTema();
  const motivoCierre = useSesion((s) => s.motivoCierre);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [bloqueadoHasta, setBloqueadoHasta] = useState<number | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  const [entrando, setEntrando] = useState(false);
  const [desbloqueado, setDesbloqueado] = useState(false);

  // Al abrir la pantalla se recupera un bloqueo que siga vigente.
  useEffect(() => {
    obtenerServicioCuenta()
      .estadoIntentos()
      .then((estado) => {
        if (estado?.bloqueado) setBloqueadoHasta(Date.now() + estado.msRestantes);
      })
      .catch(() => undefined);
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

  const entrar = async () => {
    setError(null);
    setDesbloqueado(false);
    // Un PIN incompleto no gasta intentos: es un error al escribir, no un intento de adivinar.
    if (!/^\d{6}$/.test(pin)) {
      setError('Tu PIN tiene 6 números. Escríbelo completo.');
      return;
    }
    setEntrando(true);
    try {
      const r = await obtenerServicioCuenta().entrar(pin);
      if (r.ok) {
        useSesion.getState().iniciar(r.claveDatos, r.perfil);
        router.replace('/inicio');
        return;
      }
      setPin('');
      if (r.bloqueado) {
        setAhora(Date.now());
        setBloqueadoHasta(Date.now() + r.msRestantes);
      } else {
        setError(`PIN incorrecto. Te quedan ${r.intentosRestantes} intento${r.intentosRestantes === 1 ? '' : 's'}.`);
      }
    } catch {
      setError('No encontramos una cuenta en este celular. Crea una para empezar.');
    } finally {
      setEntrando(false);
    }
  };

  return (
    <Pantalla titulo="Entrar" volverA="/bienvenida">
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

      <Texto style={{ marginBottom: espacio.l }}>Escribe tu PIN de 6 números.</Texto>

      <CampoTexto
        etiqueta="Tu PIN"
        valor={pin}
        alCambiar={setPin}
        teclado="number-pad"
        maxLength={6}
        secreto
        autoComplete="one-time-code"
        error={error}
        testID="campo-pin-entrar"
      />

      <View style={{ gap: espacio.m, marginBottom: espacio.l }}>
        <Boton
          etiqueta="Entrar"
          accessibilityRole="button"
          accessibilityLabel="Entrar"
          onPress={() => void entrar()}
          deshabilitado={bloqueado || entrando}
          testID="boton-entrar"
        />
        <Enlace href="/recuperar">Olvidé mi PIN</Enlace>
      </View>
    </Pantalla>
  );
}
