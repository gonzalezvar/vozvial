import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ValidadorRegistro } from '../../src/core/ValidadorRegistro';
import { servicioLecturaVoz } from '../../src/services/ServicioLecturaVoz';
import { abrirSesion } from '../../src/state/cuenta';
import { obtenerServicioCuenta } from '../../src/state/servicios';
import { Alerta, Boton, CampoTexto, Cargando, Pantalla, useTema } from '../../src/ui';
import { AyudaPantalla } from '../../src/ui/guia/AyudaPantalla';

interface Errores {
  celular?: string;
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
// Si la cuenta no esta en este dispositivo, tambien se pide el celular y la recuperacion es en el servidor.
export default function Recuperar() {
  const { espacio } = useTema();
  // null mientras se revisa si hay cuenta en este dispositivo.
  const [hayCuentaLocal, setHayCuentaLocal] = useState<boolean | null>(null);
  const [celular, setCelular] = useState('');
  const [codigo, setCodigo] = useState('');
  const [pin, setPin] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [errores, setErrores] = useState<Errores>({});
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    obtenerServicioCuenta()
      .existeCuenta()
      .then(setHayCuentaLocal)
      .catch(() => setHayCuentaLocal(false));
  }, []);

  const avisar = (nuevos: Errores) => {
    setErrores(nuevos);
    const mensajes = [nuevos.general, nuevos.celular, nuevos.codigo, nuevos.pin, nuevos.confirmacion].filter(Boolean);
    if (mensajes.length) servicioLecturaVoz.leer(`No se cambió el PIN. ${mensajes.join(' ')}`);
  };

  const recuperar = async () => {
    const pideCelular = hayCuentaLocal === false;
    const locales: Errores = {
      celular:
        pideCelular && !/^3\d{9}$/.test(ValidadorRegistro.normalizarCelular(celular))
          ? 'Escribe tu celular de 10 dígitos, por ejemplo 3001234567'
          : undefined,
      codigo: codigo.trim() === '' ? 'Escribe tu código de recuperación.' : undefined,
      ...erroresPin(pin, confirmacion),
    };
    if (locales.celular || locales.codigo || locales.pin || locales.confirmacion) {
      avisar(locales);
      return;
    }

    setEnviando(true);
    setErrores({});
    setAviso(null);
    try {
      const r = await obtenerServicioCuenta().recuperar(codigo, pin, pideCelular ? celular : undefined);
      if (r.ok) {
        await abrirSesion(r, { esperarCasos: pideCelular });
        if (r.aviso) {
          // Se queda en la pantalla para que la persona lea el aviso; el boton del aviso lleva al inicio.
          setAviso(r.aviso);
          servicioLecturaVoz.leer(r.aviso);
          return;
        }
        router.replace('/inicio');
        return;
      }
      if (r.error === 'sin_cuenta') {
        avisar({ general: 'No hay una cuenta en este celular. Crea una para empezar.' });
      } else if (r.error === 'pin_invalido') {
        avisar({ pin: r.mensaje });
      } else if (r.error === 'celular_invalido') {
        avisar({ celular: r.mensaje });
      } else if (r.error === 'sin_conexion' || r.error === 'bloqueada' || r.error === 'servidor') {
        avisar({ general: r.mensaje });
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
    <Pantalla
      titulo="Recuperar el acceso"
      descripcion="Escribe el código de 12 letras y números que guardaste al crear tu cuenta y elige un PIN nuevo. Tus casos no se borran."
      volverA="/bienvenida"
      extraEncabezado={<AyudaPantalla pantalla="recuperar" />}
    >
      {errores.general ? (
        <Alerta titulo="No se cambió el PIN" tono="peligro" anunciar testID="error-recuperar">
          {errores.general}
        </Alerta>
      ) : null}
      {aviso ? (
        <Alerta
          titulo="PIN cambiado en este celular"
          tono="aviso"
          anunciar
          testID="aviso-recuperar"
          accion={{ etiqueta: 'Ir al inicio', accessibilityLabel: 'Ir al inicio', onPress: () => router.replace('/inicio'), icono: 'inicio' }}
        >
          {aviso}
        </Alerta>
      ) : null}

      {hayCuentaLocal === null ? <Cargando texto="Revisando tu cuenta" /> : null}
      {hayCuentaLocal === false ? (
        <CampoTexto
          etiqueta="Tu celular"
          ayuda="El número con el que creaste tu cuenta."
          valor={celular}
          alCambiar={setCelular}
          teclado="phone-pad"
          maxLength={14}
          autoComplete="tel"
          error={errores.celular}
          testID="campo-celular-recuperar"
        />
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
      <View style={{ gap: espacio.ms, marginBottom: espacio.l }}>
        <Boton
          etiqueta={enviando ? 'Revisando el código…' : 'Cambiar PIN y entrar'}
          accessibilityRole="button"
          accessibilityLabel={enviando ? 'Revisando el código' : 'Cambiar PIN y entrar'}
          icono="llave"
          cargando={enviando}
          deshabilitado={enviando || hayCuentaLocal === null}
          onPress={() => void recuperar()}
          testID="boton-recuperar"
        />
        <Boton
          etiqueta="Ya me acordé de mi PIN"
          accessibilityRole="link"
          accessibilityLabel="Ya me acordé de mi PIN"
          variante="texto"
          href="/entrar"
        />
      </View>
    </Pantalla>
  );
}
