# Base normativa — cómo construirla y verificarla

La base normativa es lo que hace creíble a VozVial. La docente ya señaló estos vacíos en la formulación:
- el objetivo decía "solo el Código Nacional de Tránsito", pero el alcance usaba la Ley 1801;
- el plazo de 11 días para fotodetección sale del art. 8 de la Ley 1843 de 2017, que no estaba en la base;
- faltaba decir cómo se actualizan los valores de las multas.

Este archivo corrige eso.

## Alcance de la base (versión del prototipo)
Código Nacional de Tránsito **y las normas que lo modifican o complementan en lo que la app usa**:

| Norma | Para qué la usa la app | Fuente oficial sugerida |
|---|---|---|
| Ley 769 de 2002 (Código Nacional de Tránsito) | Procedimiento ante comparendo, audiencia, plazos, códigos de infracción, inmovilización, caducidad y prescripción | Secretaría del Senado (secretariasenado.gov.co/senado/basedoc/ley_0769_2002.html) |
| Ley 1383 de 2010 y Decreto 019 de 2012 | Modificaciones al procedimiento (art. 136 y otros) | Secretaría del Senado / Función Pública (funcionpublica.gov.co/eva/gestornormativo) |
| Ley 1843 de 2017 | Fotodetección: notificación y plazo para comparecer (art. 8) | Secretaría del Senado |
| Ley 1801 de 2016, art. 21 | Derecho a grabar procedimientos de policía (modo "Me pararon") | Secretaría del Senado |
| Ley 1581 de 2012 | Autorización de tratamiento de datos (registro) | Secretaría del Senado |
| Unidad de las multas vigente (SMDLV o UVB, según la norma vigente) | Valor de referencia de la multa | Verificar la norma vigente y la resolución o decreto del valor del año |

Cualquier otra norma que se necesite se agrega aquí con la misma justificación.

## Procedimiento obligatorio
1. Descargar el texto **desde la fuente oficial** (WebFetch) y copiar el fragmento **literal** del artículo.
   - Si el artículo fue modificado, usar el texto vigente que publica la fuente e indicar qué norma lo modificó.
2. Guardar cada artículo en `data/normativa/<norma>.json` con este esquema:
```json
{
  "id": "L769-2002-art136",
  "norma": "Ley 769 de 2002",
  "articulo": "136",
  "titulo": "Reducción de la multa / audiencia",
  "texto_literal": "...",
  "modificado_por": ["Ley 1383 de 2010, art. 24"],
  "resumen_sencillo": "...",
  "url_fuente": "https://...",
  "fecha_consulta": "2026-11-08",
  "temas": ["plazos", "audiencia", "descuentos"],
  "verificado": true,
  "verificado_por": "Juan David González Varilla",
  "notas": ""
}
```
3. `resumen_sencillo` lo redacta el equipo a partir del texto literal, en frases cortas y sin agregar nada que el texto no diga.
4. Si la fuente no carga, el texto es ambiguo o hay duda de vigencia, la entrada queda con `verificado: false` y una nota. **La app filtra y no usa entradas no verificadas.**
5. Los parámetros que usa el código salen de la base, no de constantes sueltas:
   - días hábiles en vía;
   - días hábiles en fotodetección;
   - porcentajes de descuento, si aplican;
   - caducidad.

   Van en `data/normativa/parametros.json`, y cada parámetro apunta al `id` del artículo que lo sustenta.
6. El catálogo `data/infracciones.json` (código, descripción literal, descripción sencilla, sanción en la unidad legal, artículo) se construye desde el art. 131 vigente.
   - El valor en pesos se calcula con la unidad del año y se guarda con `vigencia` y `fuente`.
   - **Actualización:** cada enero se actualiza el valor de la unidad en `parametros.json`. La app muestra la vigencia y remite a SIMIT para el valor exacto.

## Festivos
`FestivosColombia` calcula los festivos con la Ley 51 de 1983 (traslado a lunes) y la fecha de Pascua. Se prueba contra esta tabla:

| 2026 | Día |
|---|---|
| 12 oct | lunes, Día de la Raza |
| 2 nov | lunes, Todos los Santos (trasladado) |
| 16 nov | lunes, Independencia de Cartagena (trasladado) |
| 8 dic | martes, Inmaculada Concepción |
| 25 dic | viernes, Navidad |
| 1 ene 2027 | viernes, Año Nuevo |
| 11 ene 2027 | lunes, Reyes Magos (trasladado) |

Casos de prueba de `CalculadoraPlazos`, contando días hábiles desde el día siguiente al evento y sin sábados, domingos ni festivos:

| Evento | Días hábiles | Fecha límite |
|---|---|---|
| vie 6 nov 2026 | 5 | vie 13 nov 2026 |
| vie 13 nov 2026 | 5 | lun 23 nov 2026 |
| vie 13 nov 2026 | 11 | mar 1 dic 2026 |
| vie 4 dic 2026 | 5 | lun 14 dic 2026 |
| vie 18 dic 2026 | 11 | mié 6 ene 2027 |

Si el texto verificado de la norma establece otro punto de partida o una regla distinta, se ajustan la clase, estas pruebas y los criterios CA-11.x, y se registra en `docs/refinamiento-historias.md`.

## Preguntas verificadas y banco de evaluación
- `data/preguntas-verificadas.json`: unas 40 preguntas frecuentes. Cada una tiene variantes de cómo la diría un adulto mayor, una respuesta sencilla y `citas` (ids de la base).
  - Las respuestas las redacta el equipo y las contrasta con el texto literal.
- `data/banco-evaluacion.json`: unas 60 preguntas **distintas** a las anteriores, para no evaluar con lo mismo que se entrenó. Incluye:
  - 40 con artículo esperado;
  - 10 de tránsito sin sustento en la base, donde se espera abstención;
  - 10 fuera de tema.
  - Cada una indica quién la construyó y quién la calificó.
  - Criterio de acierto: la cita es del artículo pertinente, no solo de uno que exista.
- Las interpretaciones dudosas no se resuelven en el prototipo: se marcan como "requiere revisión jurídica" y quedan fuera de las respuestas.
