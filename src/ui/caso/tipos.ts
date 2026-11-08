import type { Caso } from '../../core/Caso';

/** Props comunes de las secciones que se componen en el detalle del caso. */
export interface PropsSeccionCaso {
  caso: Caso;
  /** Se llama con el caso ya guardado para que la pantalla lo muestre actualizado. */
  onCambio: (caso: Caso) => void;
}
