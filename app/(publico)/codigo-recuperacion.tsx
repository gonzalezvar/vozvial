import { router } from 'expo-router';
import { View } from 'react-native';

import { useRegistro } from '../../src/state/registro';
import { useSesion } from '../../src/state/sesion';
import { Alerta, Boton, BotonEscuchar, Icono, Pantalla, Texto, useTema } from '../../src/ui';

export default function CodigoRecuperacion() {
  const { colores, espacio, radio, tipo, peso, medidas } = useTema();
  const codigo = useRegistro((s) => s.codigoRecuperacion);
  const respaldo = useRegistro((s) => s.respaldo);
  const conSesion = useSesion((s) => s.claveDatos !== null);

  const continuar = () => {
    // El codigo se muestra una sola vez: al seguir se borra de la memoria.
    useRegistro.getState().olvidarCodigo();
    router.replace(conSesion ? '/inicio' : '/entrar');
  };

  if (!codigo) {
    return (
      <Pantalla
        titulo="Tu código de recuperación"
        descripcion="Por seguridad, el código solo se muestra una vez."
        volverA={false}
        pie={
          <Boton etiqueta="Continuar" accessibilityRole="link" accessibilityLabel="Continuar" iconoFinal="siguiente" onPress={continuar} />
        }
      >
        <Alerta titulo="El código ya no se puede mostrar" tono="aviso">
          El código solo aparece al crear la cuenta. Si lo perdiste, sigue usando tu PIN para entrar.
        </Alerta>
      </Pantalla>
    );
  }

  // Se lee caracter por caracter, en tres grupos de 4, para que se pueda copiar a mano.
  const deletreado = codigo
    .split('-')
    .map((grupo, i) => `Grupo ${i + 1}: ${grupo.split('').join(', ')}.`)
    .join(' ');
  return (
    <Pantalla
      titulo="Tu código de recuperación"
      descripcion="Tu cuenta quedó creada. Si olvidas tu PIN, con este código vuelves a entrar sin perder tus casos."
      volverA={false}
      pie={
        <Boton
          etiqueta="Ya lo guardé"
          accessibilityRole="link"
          accessibilityLabel="Ya lo guardé. Ir al inicio"
          iconoFinal="siguiente"
          onPress={continuar}
        />
      }
    >
      <View
        style={{
          backgroundColor: colores.superficie,
          borderColor: colores.primario,
          borderWidth: medidas.grosorFoco,
          borderRadius: radio.l,
          padding: espacio.l,
          marginBottom: espacio.m,
          alignItems: 'center',
          gap: espacio.s,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}>
          <Icono nombre="llave" color="primario" />
          <Texto negrita color="primario">
            12 letras y números
          </Texto>
        </View>
        <Texto
          testID="codigo-recuperacion"
          centrado
          color="texto"
          // Tamano de h1 para que los 14 caracteres quepan en una linea con letra normal.
          style={{ fontSize: tipo.tituloPantalla, lineHeight: tipo.alturaLinea(tipo.tituloPantalla), fontWeight: peso.fuerte, letterSpacing: 1 }}
        >
          {codigo}
        </Texto>
      </View>
      <View style={{ marginBottom: espacio.l }}>
        <BotonEscuchar
          texto={`Tu código tiene 12 caracteres. ${deletreado}`}
          etiqueta="Escuchar el código"
          que="el código de recuperación"
          variante="tonal"
        />
      </View>
      <Alerta titulo="Guárdalo en un lugar seguro" tono="aviso" testID="aviso-guardar-codigo">
        Escríbelo en un papel y guárdalo. Solo se muestra esta vez y VozVial no lo puede recuperar por ti.
      </Alerta>
      {respaldo === 'pendiente' ? (
        <Alerta titulo="Falta la copia en el servidor" tono="info" testID="aviso-respaldo-pendiente">
          No había conexión. Tu cuenta quedó en este celular y la copia cifrada se hace sola la próxima vez que entres
          con internet.
        </Alerta>
      ) : respaldo === 'servidor' ? (
        <Alerta titulo="Puedes entrar desde otro celular" tono="exito" testID="aviso-respaldo-servidor">
          Tu cuenta tiene una copia cifrada en el servidor. En otro celular entras con tu número y tu PIN.
        </Alerta>
      ) : null}
    </Pantalla>
  );
}
