import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';

import { ValidadorRegistro, type CampoRegistro } from '../../src/core/ValidadorRegistro';
import { ErrorCuenta } from '../../src/services/ServicioCuenta';
import { servicioLecturaVoz } from '../../src/services/ServicioLecturaVoz';
import { abrirSesion } from '../../src/state/cuenta';
import { useRegistro } from '../../src/state/registro';
import { obtenerServicioCuenta } from '../../src/state/servicios';
import { Alerta, Boton, CampoTexto, Casilla, Enlace, Pantalla, Texto, useTema } from '../../src/ui';
import { AyudaPantalla } from '../../src/ui/guia/AyudaPantalla';

type Errores = Partial<Record<CampoRegistro, string>>;

// Orden en que aparecen los campos en pantalla: define cual es "el primer error".
const ORDEN_CAMPOS: CampoRegistro[] = ['nombre', 'celular', 'pin', 'confirmacionPin', 'autorizaDatos'];
const TEST_ID: Record<CampoRegistro, string> = {
  nombre: 'campo-nombre',
  celular: 'campo-celular',
  pin: 'campo-pin',
  confirmacionPin: 'campo-confirmacion',
  autorizaDatos: 'casilla-autorizacion',
};

/** CA-01.2: lleva el foco al primer campo con error para que el lector de pantalla lo anuncie. */
function enfocarCampo(campo: CampoRegistro): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const elemento = document.querySelector<HTMLElement>(`[data-testid="${TEST_ID[campo]}"]`);
  elemento?.focus();
}

export default function Registro() {
  const { espacio } = useTema();
  const [nombre, setNombre] = useState('');
  const [celular, setCelular] = useState('');
  const [pin, setPin] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [autoriza, setAutoriza] = useState(false);
  const [errores, setErrores] = useState<Errores>({});
  // Cambia en cada intento fallido para volver a enfocar aunque el primer error sea el mismo.
  const [intentoFallido, setIntentoFallido] = useState(0);
  const [creando, setCreando] = useState(false);
  const [fallo, setFallo] = useState<{ mensaje: string; celularEnUso: boolean } | null>(null);

  useEffect(() => {
    if (intentoFallido === 0) return;
    const primero = ORDEN_CAMPOS.find((c) => errores[c]);
    if (primero) enfocarCampo(primero);
  }, [intentoFallido, errores]);

  const crear = async () => {
    setFallo(null);
    const resultado = ValidadorRegistro.validar({ nombre, celular, pin, confirmacionPin: confirmacion, autorizaDatos: autoriza });
    const nuevos: Errores = {};
    for (const e of resultado.errores) nuevos[e.campo] ??= e.mensaje;
    setErrores(nuevos);
    if (!resultado.valido) {
      const mensajes = ORDEN_CAMPOS.map((c) => nuevos[c]).filter(Boolean);
      servicioLecturaVoz.leer(`No se creó la cuenta. Revisa esto: ${mensajes.join(' ')}`);
      setIntentoFallido((n) => n + 1);
      return;
    }

    setCreando(true);
    try {
      const creada = await obtenerServicioCuenta().crearCuenta({ nombre, celular, pin });
      useRegistro.getState().fijarCodigo(creada.codigoRecuperacion, creada.respaldo);
      await abrirSesion(creada);
      router.replace('/codigo-recuperacion');
    } catch (error) {
      const motivo = error instanceof ErrorCuenta ? error.motivo : null;
      const mensaje =
        motivo === 'celular_en_uso'
          ? 'Ya hay una cuenta con ese celular. Entra con tu celular y tu PIN.'
          : motivo === 'ya_existe'
            ? 'Ya hay una cuenta en este celular. Entra con tu PIN.'
            : 'No pudimos crear la cuenta. Intenta de nuevo.';
      setFallo({ mensaje, celularEnUso: motivo === 'celular_en_uso' || motivo === 'ya_existe' });
      servicioLecturaVoz.leer(mensaje);
      setCreando(false);
    }
  };

  return (
    <Pantalla
      titulo="Crear mi cuenta"
      descripcion="Llena tus datos. Solo tú podrás ver tus casos, en este celular o en otro."
      volverA="/bienvenida"
      extraEncabezado={<AyudaPantalla pantalla="registro" />}
    >

      <CampoTexto
        etiqueta="Tu nombre"
        valor={nombre}
        alCambiar={setNombre}
        autoComplete="name"
        error={errores.nombre}
        testID={TEST_ID.nombre}
      />
      <CampoTexto
        etiqueta="Tu celular"
        ayuda="10 dígitos, empieza por 3. Con tu celular y tu PIN entras desde otro dispositivo."
        valor={celular}
        alCambiar={setCelular}
        teclado="phone-pad"
        // Deja escribir "300 123 4567": el validador quita espacios y guiones antes de contar los 10 digitos.
        maxLength={14}
        autoComplete="tel"
        error={errores.celular}
        testID={TEST_ID.celular}
      />
      <CampoTexto
        etiqueta="Tu PIN"
        ayuda="6 números. No uses secuencias como 123456 ni números repetidos como 111111."
        valor={pin}
        alCambiar={setPin}
        teclado="number-pad"
        maxLength={6}
        secreto
        error={errores.pin}
        testID={TEST_ID.pin}
      />
      <CampoTexto
        etiqueta="Escribe otra vez tu PIN"
        valor={confirmacion}
        alCambiar={setConfirmacion}
        teclado="number-pad"
        maxLength={6}
        secreto
        error={errores.confirmacionPin}
        testID={TEST_ID.confirmacionPin}
      />

      <Casilla
        marcada={autoriza}
        alCambiar={setAutoriza}
        accessibilityLabel="Autorizo el tratamiento de mis datos según la política de datos"
        error={errores.autorizaDatos}
        testID={TEST_ID.autorizaDatos}
      >
        <Texto>Autorizo el tratamiento de mis datos (Ley 1581 de 2012).</Texto>
      </Casilla>
      {errores.autorizaDatos ? (
        <Alerta
          titulo="Por qué te pedimos permiso"
          tono="aviso"
          testID="aviso-autorizacion"
          accion={{
            etiqueta: 'Leer la política de datos',
            accessibilityLabel: 'Leer la política de datos en palabras sencillas',
            href: '/privacidad',
          }}
        >
          La Ley 1581 de 2012 pide tu permiso antes de guardar tus datos. Lee qué hacemos con ellos y luego marca la casilla.
        </Alerta>
      ) : null}
      <View style={{ marginBottom: espacio.l }}>
        <Enlace href="/privacidad" testID="enlace-privacidad">
          Lee la política de datos en palabras sencillas
        </Enlace>
      </View>

      {fallo ? (
        <Alerta
          titulo="No se creó la cuenta"
          tono="peligro"
          anunciar
          testID="fallo-registro"
          accion={
            fallo.celularEnUso
              ? { etiqueta: 'Entrar con mi celular', accessibilityLabel: 'Entrar con mi celular y mi PIN', href: '/entrar', icono: 'llave' }
              : undefined
          }
        >
          {fallo.mensaje}
        </Alerta>
      ) : null}

      <Boton
        etiqueta={creando ? 'Creando tu cuenta…' : 'Crear cuenta'}
        accessibilityRole="button"
        accessibilityLabel={creando ? 'Creando tu cuenta' : 'Crear cuenta'}
        icono="usuario"
        cargando={creando}
        deshabilitado={creando}
        onPress={() => void crear()}
        testID="crear-cuenta"
      />
      <Texto variante="nota" color="textoSuave" centrado style={{ marginTop: espacio.m }}>
        Tus casos se guardan cifrados en este celular y en el servidor. El servidor no los puede leer.
      </Texto>
    </Pantalla>
  );
}
