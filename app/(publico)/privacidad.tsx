import { View } from 'react-native';

import { obtenerBaseNormativa } from '../../src/core/cargarDatos';
import { Pantalla, Tarjeta, TarjetaCita, Texto, useTema } from '../../src/ui';

// Articulos de la Ley 1581 de 2012 que sustentan esta politica. Solo se muestran si estan verificados en data/.
const IDS_LEY_1581 = ['L1581-2012-art9', 'L1581-2012-art12', 'L1581-2012-art8', 'L1581-2012-art4'];

const SECCIONES: { titulo: string; puntos: string[] }[] = [
  {
    titulo: 'Qué datos pide VozVial',
    puntos: [
      'Tu nombre y tu celular, para la solicitud de audiencia.',
      'Un PIN de 6 números. No se guarda el PIN: solo una huella cifrada de él.',
      'Lo que tú agregues a un caso: audios, fotos, notas, el comparendo y, si lo permites, la ubicación.',
    ],
  },
  {
    titulo: 'Dónde quedan',
    puntos: [
      'Solo en este celular, dentro del navegador, cifrados con una clave que sale de tu PIN.',
      'VozVial no tiene un servidor de cuentas. Nadie más puede ver tus casos.',
    ],
  },
  {
    titulo: 'Qué sale de tu celular',
    puntos: [
      'Cuando preguntas al asistente, solo viaja el texto de tu pregunta. Sin tu nombre, sin ubicación y sin audio.',
      'El servidor no guarda el contenido de tus preguntas.',
      'Si dictas por voz en Chrome, el navegador envía el audio a Google para convertirlo en texto. Si no quieres, puedes escribir.',
    ],
  },
  {
    titulo: 'Qué no hacemos',
    puntos: ['No usamos analítica ni publicidad.', 'No vendemos ni compartimos tus datos.'],
  },
  {
    titulo: 'Tu control',
    puntos: [
      'Puedes borrar un caso cuando quieras, desde "Mis casos".',
      'Puedes borrar todos tus datos desde Ajustes.',
      'Al crear la cuenta te pedimos autorización para tratar tus datos, como pide la Ley 1581 de 2012 de protección de datos personales.',
    ],
  },
  {
    titulo: 'Quién responde',
    puntos: [
      'El equipo del proyecto universitario VozVial.',
      'La ley pide publicar la dirección y el teléfono del responsable. Todavía está pendiente: se publicará en la entrega final.',
    ],
  },
];

export default function Privacidad() {
  const { espacio, colores, tipo } = useTema();
  const base = obtenerBaseNormativa();
  const articulos = base.citas(IDS_LEY_1581).map((cita) => ({ cita, resumen: base.porId(cita.id)?.resumenSencillo ?? '' }));
  return (
    <Pantalla titulo="Política de datos" volverA="/bienvenida">
      <Texto style={{ marginBottom: espacio.l }}>Así cuida VozVial tu información, en palabras sencillas.</Texto>
      {SECCIONES.map((s) => (
        <Tarjeta key={s.titulo} titulo={s.titulo}>
          <View accessibilityRole="list" style={{ gap: espacio.s }}>
            {s.puntos.map((p) => (
              <View key={p} accessibilityRole="listitem" style={{ flexDirection: 'row', gap: espacio.s }}>
                <View
                  style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colores.primario, marginTop: tipo.base * 0.55 }}
                />
                <Texto style={{ flex: 1 }}>{p}</Texto>
              </View>
            ))}
          </View>
        </Tarjeta>
      ))}

      {articulos.length > 0 ? (
        <Tarjeta titulo="Lo que dice la ley" testID="ley-1581">
          <Texto style={{ marginBottom: espacio.s }}>
            Esta política sigue la Ley 1581 de 2012. Toca un artículo para leer el texto oficial.
          </Texto>
          {articulos.map(({ cita, resumen }) => (
            <View key={cita.id} style={{ gap: espacio.s }}>
              <Texto>{resumen}</Texto>
              <TarjetaCita cita={cita} testID={`cita-${cita.id}`} />
            </View>
          ))}
        </Tarjeta>
      ) : null}
    </Pantalla>
  );
}
