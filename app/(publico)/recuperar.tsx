import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ValidadorRegistro } from '../../src/core/ValidadorRegistro';
import { servicioLecturaVoz } from '../../src/services/ServicioLecturaVoz';
import { obtenerServicioCuenta } from '../../src/state/servicios';
import { useSesion } from '../../src/state/sesion';
import { Alerta, Boton, CampoTexto, Enlace, Pantalla, Texto, useTema } from '../../src/ui';

interface Errores {
  codigo?: string;
  pin?: string;
  confirmacion?: string;
  general?: string;
}

/** Reglas del PIN nuevo: las mismas del registro (CA-01.4). */
function erroresPin(pin: string, confirmacion: string): Errores {
  const r = ValidadorRegistro.validar({
    nombre: 'xx',
    celular: '3000000000',
    pin,
    confirmacionPin: confirmacion,
    autorizaDatos: true,
  });
  return {
    pin: r.errores.find((e) => e.campo === 'pin')?.mensaje,
    confirmacion: r.errores.find((e) => e.campo === 'confirmacionPin')?.mensaje,
  };
}

// HU-03: con el codigo de recuperacion se abre la clave de datos y se protege con un PIN nuevo.
export default function Recuperar() {
  const { espacio } = useTema();
  const [codigo, setCodigo] = useState('');
  const [pin, setPin] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [errores, setErrores] = useState<Errores>({});
  const [enviando, setEnviando] = useState(false);

  const avisar = (nuevos: Errores) => {
    setErrores(nuevos);
    const mensajes = [nuevos.general, nuevos.codigo, nuevos.pin, nuevos.confirmacion].filter(Boolean);
    if (mensajes.length) servicioLecturaVoz.leer(`No se cambió el PIN. ${mensajes.join(' ')}`);
  };

  const recuperar = async () => {
    const locales: Errores = {
      codigo: codigo.trim() === '' ? 'Escribe tu código de recuperación.' : undefined,
      ...erroresPin(pin, confirmacion),
    };
    if (locales.codigo || locales.pin || locales.confirmacion) {
      avisar(locales);
      return;
    }

    setEnviando(true);
    setErrores({});
    try {
      const r = await obtenerServicioCuenta().recuperar(codigo, pin);
      if (r.ok) {
        useSesion.getState().iniciar(r.claveDatos, r.perfil);
        router.replace('/inicio');
        return;
      }
      if (r.error === 'sin_cuenta') {
        avisar({ general: 'No hay una cuenta en este celular. Crea una para empezar.' });
      } else if (r.error === 'pin_invalido') {
        avisar({ pin: r.mensaje });
      } else {
        // El PIN no se cambia: se borra lo escrito para que no quede en pantalla.
        setPin('');
        setConfirmacion('');
        avisar({ codigo: r.mensaje });
      }
    } catch {
      avisar({ general: 'No pudimos revisar el código. Intenta de nuevo.' });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Pantalla titulo="Recuperar el acceso" volverA="/bienvenida">
      <Texto style={{ marginBottom: espacio.l }}>
        Escribe el código de 12 letras y números que guardaste al crear tu cuenta. Luego elige un PIN nuevo. Tus casos no
        se borran.
      </Texto>

      {errores.general ? (
        <Alerta titulo="No se cambió el PIN" tono="urgente" anunciar testID="error-recuperar">
          {errores.general}
        </Alerta>
      ) : null}

      <CampoTexto
        etiqueta="Código de recuperación"
        ayuda="Puedes escribirlo con o sin guiones."
        valor={codigo}
        alCambiar={setCodigo}
        maxLength={16}
        autoComplete="off"
        error={errores.codigo}
        testID="campo-codigo"
      />
      <CampoTexto
        etiqueta="PIN nuevo"
        ayuda="6 números. No uses secuencias como 123456 ni números repetidos como 111111."
        valor={pin}
        alCambiar={setPin}
        teclado="number-pad"
        maxLength={6}
        secreto
        error={errores.pin}
        testID="campo-pin-nuevo"
      />
      <CampoTexto
        etiqueta="Escribe otra vez el PIN nuevo"
        valor={confirmacion}
        alCambiar={setConfirmacion}
        teclado="number-pad"
        maxLength={6}
        secreto
        error={errores.confirmacion}
        testID="campo-confirmacion-nuevo"
      />
      <View style={{ gap: espacio.m, marginBottom: espacio.l }}>
        <Boton
          etiqueta={enviando ? 'Revisando el código…' : 'Cambiar PIN y entrar'}
          accessibilityRole="button"
          accessibilityLabel={enviando ? 'Revisando el código' : 'Cambiar PIN y entrar'}
          deshabilitado={enviando}
          onPress={() => void recuperar()}
          testID="boton-recuperar"
        />
        <Enlace href="/entrar">Ya me acordé de mi PIN</Enlace>
      </View>
    </Pantalla>
  );
}
