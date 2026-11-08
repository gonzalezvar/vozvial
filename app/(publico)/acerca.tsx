import { Lista, ListaItem, Pantalla, Seccion } from '../../src/ui';
import { LO_REAL, LO_SIMULADO, type ElementoAcerca } from '../../src/ui/contenidoAcerca';

function ListaAcerca({
  elementos,
  testID,
  conEstado = true,
}: {
  elementos: readonly ElementoAcerca[];
  testID: string;
  conEstado?: boolean;
}) {
  return (
    <Lista testID={testID}>
      {elementos.map((e) => (
        <ListaItem
          key={e.titulo}
          titulo={e.titulo}
          descripcion={e.detalle}
          estado={
            conEstado
              ? { texto: e.estado === 'listo' ? 'Ya funciona' : 'En construcción', tono: e.estado === 'listo' ? 'exito' : 'neutro' }
              : undefined
          }
        />
      ))}
    </Lista>
  );
}

export default function Acerca() {
  return (
    <Pantalla
      titulo="Acerca del prototipo"
      descripcion="VozVial es el prototipo de un proyecto universitario. Aquí ves qué hace de verdad y qué está simulado."
      volverA="/bienvenida"
    >
      <Seccion titulo="Lo que es real" descripcion="Funciona en la app tal como se describe.">
        <ListaAcerca elementos={LO_REAL} testID="lista-real" />
      </Seccion>
      <Seccion titulo="Lo que es simulado o tiene límites" descripcion="Léelo antes de confiar en un resultado.">
        {/* En los limites la etiqueta "Ya funciona" confundiria: solo se listan. */}
        <ListaAcerca elementos={LO_SIMULADO} testID="lista-simulado" conEstado={false} />
      </Seccion>
    </Pantalla>
  );
}
