import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { View } from 'react-native';

import { obtenerServicioPlazos, ACCION_PLAZO, type AlertaPlazo } from '../../services/ServicioPlazos';
import { useCasos } from '../../state/casos';
import { Alerta } from '../Alerta';
import { Texto } from '../Texto';

/** Alertas del inicio para plazos que vencen hoy o en 2 días hábiles o menos (CA-12.1 y CA-12.2). */
export function AlertasPlazo() {
  const casos = useCasos((s) => s.casos);
  const recargar = useCasos((s) => s.recargar);

  useFocusEffect(
    useCallback(() => {
      void recargar();
    }, [recargar]),
  );

  const alertas = useMemo<AlertaPlazo[]>(() => {
    try {
      return obtenerServicioPlazos().alertas(casos);
    } catch {
      return [];
    }
  }, [casos]);

  if (alertas.length === 0) return null;
  return (
    <View testID="alertas-plazo">
      {alertas.map(({ casoId, numeroComparendo, estado }) => {
        const fecha = estado.resultado.fechaLimite.formatoLargo();
        const hoy = estado.nivel === 'hoy';
        return (
          <Alerta
            key={casoId}
            titulo={hoy ? estado.mensaje.replace(/\.$/, '') : 'Tu plazo vence pronto'}
            tono="urgente"
            anunciar
            testID={`alerta-plazo-${casoId}`}
            accion={{
              etiqueta: 'Ver el caso',
              accessibilityLabel: `Ver el caso del comparendo ${numeroComparendo}`,
              href: `/casos/${casoId}`,
            }}
          >
            <Texto>
              {hoy
                ? `Comparendo ${numeroComparendo}. Hoy, ${fecha}, es el último día.`
                : `${estado.mensaje} Tienes hasta el ${fecha} para ${ACCION_PLAZO}. Comparendo ${numeroComparendo}.`}
            </Texto>
          </Alerta>
        );
      })}
    </View>
  );
}
