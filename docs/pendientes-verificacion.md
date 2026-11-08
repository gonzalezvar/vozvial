# Pendientes de verificación de la base normativa

Fecha de corte: 8 de noviembre de 2026.

> **Nota importante.** Todas las entradas de `data/normativa/`, el catálogo `data/infracciones.json`, `data/normativa/parametros.json`, `data/preguntas-verificadas.json` y `data/banco-evaluacion.json` los construyeron y verificaron **agentes automatizados**:
> - descargaron las páginas oficiales con curl;
> - extrajeron el texto con scripts;
> - un segundo agente hizo una verificación adversarial con un extractor independiente.
>
> Eso **no reemplaza la revisión humana**. Antes de la entrega, Juan David González Varilla debe revisar cada entrada contra su URL oficial. Cuando la apruebe, cambia `verificado_por` por su nombre. Mientras tanto, `verificado_por` dice "Pendiente de revision humana de Juan David Gonzalez Varilla".

## 1. Lo que quedó con `verificado: false` (la app no lo usa)

| Id / elemento | Qué es | Por qué quedó en false | Qué debe hacer Juan para verificarlo | URL |
|---|---|---|---|---|
| `L1843-2017-art2` | Ley 1843 de 2017, art. 2: criterios para instalar cámaras y autorización de la ANSV | Duda de vigencia. Su parágrafo 2 lo agregó la Ley 2294 de 2023 (Plan de Desarrollo, vigencia de 4 años), y el parágrafo transitorio habla del "presente decreto ley" | Revisión jurídica de la vigencia del parágrafo 2. Si se confirma, pasar a `true`. La app no lo necesita para los plazos | http://www.secretariasenado.gov.co/senado/basedoc/ley_1843_2017.html#2 |
| `MH-R3488-2025-art1` | Resolución 3488 de 2025 de MinHacienda: valor de la UVB para 2026 | El sitio de MinHacienda respondió con un control anti-bots y no se intentó saltarlo. `texto_literal` está vacío | Abrir el PDF en un navegador y guardarlo en `data/fuentes/` con su sha256. Copiar el artículo literal en la entrada y confirmar $12.110 | https://www.minhacienda.gov.co/documents/d/portal/resolucion_3488_diciembre_31_2025?download=true |
| `unidad-multa.json` → `conclusion` | Unidad y valor de la multa en 2026: UVB a $12.110 | El valor depende de `MH-R3488-2025-art1`, que no está verificada | Cerrar la fila anterior y cambiar `conclusion.verificado` a `true` | (misma) |
| `unidad-multa.json` → `tabla_mintransporte_2026` | Tabla de equivalencias de SMDLV a UVB y a pesos en 2026 (14 filas) | Se transcribió de una imagen. Viene de un concepto no vinculante. La circular que la contiene no se descargó. Además, el rótulo de la columna dice "Resolución 3914 de 2024" | Cotejar las páginas 6 y 7 del PDF. Conseguir la Circular Externa 20264000000037 de 2026 en una fuente aceptada | https://mintransporte.gov.co/info/mintransporte/media/anexos/MEXQ3BQm.pdf |
| `D-SMMLV-2026-art1` | Decreto 0159 de 2026: salario mínimo 2026, fijado de forma transitoria | La fuente (dapre.presidencia.gov.co) no está en la lista aceptada. Además, el decreto rige mientras dura un proceso de nulidad en el Consejo de Estado | Decidir si se acepta dapre como fuente oficial, o conseguir el decreto en otra fuente. Es solo contexto: no se usa para las multas | https://dapre.presidencia.gov.co/normativa/normativa/DECRETO%20No.%200159%20DEL%2019%20DE%20FEBRERO%20DE%202026.pdf |
| `D1469-2025-art1` | Decreto 1469 de 2025: salario mínimo 2026, decreto original | Misma fuente no aceptada. Además, fue suspendido provisionalmente | Igual que la fila anterior | https://dapre.presidencia.gov.co/normativa/normativa/DECRETO%201469%20DEL%2029%20DE%20DICIEMBRE%20DE%202025.pdf |
| `unidad-multa.json` → `smmlv_2026_contexto` | Salario mínimo 2026 ($1.750.905), como contexto | Depende de las dos filas anteriores | Igual que las dos filas anteriores | (mismas) |
| `infracciones.json` → código `F` | Art. 131, literal F: alcohol y sustancias psicoactivas | El texto está verificado, pero la multa no está en el art. 131: el literal remite al art. 152, que no está en la base | Descargar el art. 152 de la Ley 769 (con la Ley 1696 de 2013) y crear `L769-2002-art152` con sus grados y multas | http://www.secretariasenado.gov.co/senado/basedoc/ley_0769_2002_pr003.html#152 |
| `parametros.json` → `plazo_pago_reducido_50` | Plazo para pagar el 50 % de la multa con curso: "cinco (5) días siguientes a la orden de comparendo" | El texto no dice si son días hábiles o calendario. En el mismo artículo, el inciso de la audiencia sí dice "hábiles". La unidad quedó como `dias_sin_precisar` | Revisión jurídica sobre cómo se cuentan. Luego fijar la unidad, el punto de partida y pasar a `true` | http://www.secretariasenado.gov.co/senado/basedoc/ley_0769_2002_pr003.html#136 |
| `parametros.json` → `plazo_pago_reducido_75` | Plazo para pagar el 75 % con curso: "veinte días siguientes a la orden de comparendo" | Igual que la fila anterior | Igual que la fila anterior | (misma) |
| `parametros.json` → `unidad_multa` | UVB 2026 para calcular el valor de referencia | Viene de `conclusion`, que está en false. `valor_pesos` quedó en `null` y el número reportado está en `valor_pesos_sin_verificar` | Cerrar `MH-R3488-2025-art1`. Luego copiar 12110 a `valor_pesos` y pasar a `true` | https://mintransporte.gov.co/info/mintransporte/media/anexos/MEXQ3BQm.pdf |
| `infracciones.json` → `valor_referencia` (108 infracciones) | Valor en pesos de cada multa | Queda en `null` por dos razones: `unidad_multa` no está verificada, y las sanciones están en SMDLV mientras la unidad vigente es la UVB. Falta verificar la equivalencia de SMDLV 2023 a UVB: salario mínimo 2023 / 30 / 10.000, con el redondeo del parágrafo 1 del art. 313, o la tabla de la circular | Verificar la unidad y la equivalencia. Después calcular pesos = UVB de la multa × valor UVB del año, y guardar `vigencia` y `fuente` | — |

Consecuencia para la evaluación: mientras `valor_referencia` siga en `null`, **CA-10.2** no puede mostrar "Valor de referencia para AAAA según [fuente]". Hoy la app solo puede mostrar la sanción en SMDLV y remitir a SIMIT. En la matriz de criterios esto debe quedar como "No cumple" o "Cumple parcialmente", con esta explicación.

## 2. Decisiones que requieren revisión jurídica

Hasta que se decidan, estas interpretaciones no se usan en las respuestas del asistente.

1. **Conteo de los plazos de descuento del art. 136.** Los numerales 1 y 2 dicen "días siguientes a la orden de comparendo", sin "hábiles". Hay que decidir si se cuentan en días hábiles o calendario y desde qué día. El asistente repite la frase literal y no calcula fechas de descuento.
2. **Punto de partida en fotodetección (art. 8 de la Ley 1843).** El artículo dice "dentro de los once (11) días hábiles siguientes a la entrega del comparendo, contados a partir del recibo del comparendo". La app lo lee así: el día 1 es el día hábil siguiente al recibo (CA-11.2 da martes 1 dic 2026). Si el día del recibo contara como día 1, la fecha sería lunes 30 nov 2026.
3. **Casos de fotodetección que el art. 8 no resuelve:** envío solo por correo electrónico y notificación por aviso. Mientras se decide, la app no debería calcular plazos para esos casos.
4. **Punto de partida en vía.** Se toma el día hábil siguiente a la entrega del comparendo, porque el art. 2 define el comparendo como "orden formal de notificación". Coincide con CA-11.1, pero falta confirmarlo.
5. **Qué es un "día hábil".** La base no tiene una norma que lo defina, porque el art. 2 de la Ley 769 no lo hace. Excluir sábados, domingos y festivos es una decisión de diseño. Conviene agregar la norma que lo sustente, por ejemplo el Código de Régimen Político y Municipal (Ley 4 de 1913, art. 62), si se verifica en una fuente oficial.
6. **Grabar a agentes de tránsito civiles.** El art. 21 de la Ley 1801 habla de "procedimiento policivo" y "autoridad de Policía". Hay que decidir si basta para el modo "Me pararon" (CA-07.3). PV-002 lo dice en su respuesta.
7. **Festivo del 9 de julio (Ley 2578 de 2026, art. 6).** La ley remite a la Ley 51, pero el 9 de julio no está en la lista de traslado del numeral 2. Falta decidir si se pasa al lunes. No afecta los casos de prueba de noviembre de 2026 a enero de 2027.
8. **11 de noviembre en la lista de traslado.** Tres fuentes oficiales lo incluyen, pero la compilación del Código Sustantivo del Trabajo en el Senado lo omite. El caso de prueba del 16 nov 2026 depende de esto.
9. **Conceptos de MinTransporte como sustento citable.** `MT-CONCEPTO-20261340231211` y `MT-CONCEPTO-20241340954691` están en `true` sobre su texto, pero no son vinculantes. Por eso **ninguna pregunta verificada los cita**. Si se decide no aceptarlos, hay que pasarlos a `false`.
10. **Vigencia del art. 313 de la Ley 2294 de 2023 (UVB).** Los planes de desarrollo duran cuatro años. Hay que revisarla cuando se expida el próximo Plan Nacional de Desarrollo y repetir cada enero la consulta del valor de la UVB.
11. **Remisión del art. 137 al "artículo precedente".** Entre el 136 y el 137, la fuente publica hoy el art. 136A. Además, la suma 5 + 6 = 11 días hábiles cuadra con el art. 8 de la Ley 1843, pero es una lectura del equipo. No se usa como sustento del parámetro.
12. **Infracción A12** (servicio público en vehículos no automotores). Tiene exequibilidad condicionada (C-981-10). Hay que revisarla antes de usarla en respuestas.
13. **Art. 8 literal e) de la Ley 1581** (revocar la autorización o pedir que borren los datos). Está condicionado por la C-748 de 2011. Por eso no se incluyó una pregunta verificada sobre ese derecho.
14. **Aclaraciones de términos en `resumen_sencillo` que no están literalmente en el texto:**
    - art. 139: "en estrados, es decir, en la misma audiencia";
    - art. 129: "descargos (explicar su versión)";
    - art. 138: "apoderado (alguien que te representa)".

    PV-008 usa la aclaración de "apoderado".
15. **Porcentajes del art. 136.** El texto dice "Cancelar el cincuenta por ciento (50%)" y "Cancelar el setenta y cinco por ciento (75%)": son porcentajes **a pagar**, no de descuento. La interfaz no debe decir "descuento del 75 %".
16. **Normas citadas por los editores que no están en la base:**
    - Ley 1310 de 2009, art. 2;
    - Decreto 19 de 2012, art. 209;
    - Ley 962 de 2005, arts. 65 a 67;
    - art. 136A (Ley 2251 de 2022);
    - arts. 24 y 152 de la Ley 769;
    - arts. 5 y 6 de la Ley 1581 (datos sensibles: audio y fotos).

    Solo se agregan si la app las usa.
17. **Datos personales de terceros en `data/fuentes/`.** El PDF `mintransporte-concepto-20241340906911.pdf` puede traer el nombre de un ciudadano. Revisarlo antes de publicar el repositorio.
18. **Datos de contacto del responsable (Ley 1581, art. 12 literal d).** Hay que definir qué identificación, dirección y teléfono del equipo publica la política de datos (CA-01.5).

## 3. Entradas en `verificado: true` que esperan revisión humana

Cada una pasó la verificación automática y la adversarial, pero ninguna tiene todavía la firma de Juan.

| Archivo | Ids | URL para revisar |
|---|---|---|
| `data/normativa/ley-769-2002.json` | `L769-2002-art2`, `art125`, `art129`, `art135`, `art136`, `art137`, `art138`, `art139`, `art142`, `art157`, `art158`, `art159`, `art161` | http://www.secretariasenado.gov.co/senado/basedoc/ley_0769_2002.html y `_pr003.html`, `_pr004.html` |
| `data/normativa/ley-769-2002-art131.json` | `L769-2002-art131` | http://www.secretariasenado.gov.co/senado/basedoc/ley_0769_2002_pr003.html#131 |
| `data/infracciones.json` | 107 infracciones en `true`. Hay que revisar en especial las 108 `descripcion_sencilla`, que redactó un agente | (misma) |
| `data/normativa/ley-1843-2017.json` | `L1843-2017-art1`, `art4`, `art7`, `art8`, `art9`, `art10`, `art11`, `art12` | http://www.secretariasenado.gov.co/senado/basedoc/ley_1843_2017.html |
| `data/normativa/ley-1801-2016.json` | `L1801-2016-art21` | http://www.secretariasenado.gov.co/senado/basedoc/ley_1801_2016.html#21 |
| `data/normativa/ley-51-1983.json` | `L51-1983-art1`, `L2578-2026-art6` | https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=4954 y http://www.secretariasenado.gov.co/senado/basedoc/ley_2578_2026.html |
| `data/normativa/ley-1581-2012.json` | `L1581-2012-art3`, `art4`, `art8`, `art9`, `art12`, `art17` | http://www.secretariasenado.gov.co/senado/basedoc/ley_1581_2012.html |
| `data/normativa/unidad-multa.json` | `L2294-2023-art313`, `L2294-2023-art372`, `MT-CONCEPTO-20261340231211`, `MT-CONCEPTO-20241340954691` | Senado (`ley_2294_2023_pr008.html#313`, `_pr009.html#372`) y los PDF de mintransporte.gov.co |
| `data/normativa/parametros.json` | `dias_habiles_via`, `dias_habiles_fotodeteccion`, `dias_habiles_envio_fotodeteccion`, los porcentajes (50, 75 y 100), `caducidad_accion_contravencional`, `plazo_decision_recursos`, `prescripcion_sanciones` | Ver el campo `sustento` de cada uno |
| `data/preguntas-verificadas.json` | PV-001 a PV-045. Hay que revisar que cada `respuesta_sencilla` no diga más que el texto literal citado | — |
| `data/banco-evaluacion.json` | BE-001 a BE-060. Hay que calificarlas: `calificada_por` dice "Pendiente de calificacion por Juan David Gonzalez Varilla" | — |

En la fuente de la Ley 51 de 1983 (Función Pública), el servidor manda una cadena de certificados TLS incompleta. El verificador usó la copia local, que tiene el mismo sha256.

## 4. Discrepancias con las historias

No se cambiaron las historias. Estas diferencias deben registrarse en `docs/refinamiento-historias.md`.

| Criterio | Lo que supone la historia | Lo que dice el texto verificado | Efecto |
|---|---|---|---|
| CA-11.2 y CA-11.3 | "11 días hábiles desde la notificación"; la app pregunta la fecha en que "recibí la notificación" | Art. 8 de la Ley 1843: "dentro de los once (11) días hábiles siguientes a la entrega del comparendo, contados a partir del recibo del comparendo en la última dirección registrada por el propietario del vehículo en el Registro Único Nacional de Tránsito" | El número (11) y el resultado del caso (1 dic 2026) coinciden. Cambia la palabra: el texto habla de **entrega o recibo del comparendo**, no de "notificación". El plazo es del **propietario**. CA-11.3 debería preguntar "la fecha en que recibiste el comparendo en tu dirección del RUNT" y explicar que ese día no cuenta. Hay duda sobre si el día del recibo cuenta (ver decisión 2) |
| CA-11.2 y CA-11.3 | Toda fotomulta llega con una fecha de recibo | El art. 8 prevé el envío "por correo y/o correo electrónico" y la "notificación por aviso" cuando no se identifica al propietario en la dirección del RUNT, pero no dice cómo se cuenta el recibo en esos casos | Falta un criterio o una advertencia para esos casos (decisión 3) |
| CA-11.1 | "5 días hábiles desde el día siguiente" | Art. 135: "presentarse ante la autoridad de tránsito competente dentro de los cinco (5) días hábiles siguientes". Art. 136: "dentro de los cinco (5) días hábiles siguientes a Ia notificación del comparendo" | Coincide. No hay discrepancia |
| HU-11 (nota final) | El plazo de 5 días es para "impugnar" | Los arts. 135 y 136 hablan de **presentarse** o **comparecer**. Si el conductor rechaza la infracción, debe comparecer en audiencia pública. Si la acepta, tiene los plazos de pago reducido (art. 136, numerales 1 y 2), que no dicen "hábiles" | Aclarar en la interfaz que el plazo es para presentarse. No mostrar fechas de descuento hasta resolver la decisión 1 |
| CA-10.2 | "Valor de referencia para AAAA según [fuente]" | La unidad vigente es la UVB (Ley 2294 de 2023, art. 313), pero el valor 2026 no está verificado y la equivalencia con el SMDLV tampoco | Hoy no se puede cumplir con datos verificados (sección 1) |
| CA-07.3 | "Derechos a la vista", entre ellos grabar | El art. 21 de la Ley 1801 habla de "procedimiento policivo" y "autoridad de Policía" | Se puede mostrar con su cita, pero con la advertencia de que la norma no menciona a los agentes de tránsito civiles (decisión 6) |
| Tabla "Alcance de la base" de `docs/base-normativa.md` | Lista la Ley 769, la Ley 1383/2010 con el Decreto 019/2012, la Ley 1843, la Ley 1801 y la Ley 1581 | La base además usa: Ley 2294 de 2023, arts. 313 y 372 (UVB); Ley 51 de 1983 (tomada de Función Pública); Ley 2578 de 2026 (9 de julio); Decreto Ley 2106 de 2019 (modificó los numerales 1 y 2 del art. 136); conceptos de MinTransporte | Actualizar esa tabla (no era archivo de esta tarea) |
| Tabla de pruebas de `docs/base-normativa.md` | 5 y 11 días hábiles, contados desde el día siguiente | Coincide con la lectura adoptada en `parametros.json`. Las cinco fechas de la tabla salen con esa regla y con los festivos de la Ley 51 | Sin cambio, salvo que la decisión 2 cambie la lectura |

## 5. Preguntas típicas que no entraron a `preguntas-verificadas.json`

No tienen sustento verificado en la base, y varias quedaron en el banco como `sin_sustento`:

- pico y placa;
- valor del SOAT;
- cada cuánto se hace la revisión técnico-mecánica;
- renovación de la licencia por edad;
- exámenes médicos;
- tarifas de grúa y patios;
- límites de velocidad;
- acuerdos de pago;
- multas por grado de alcoholemia (art. 152);
- traspaso de un vehículo;
- valor exacto en pesos de una multa;
- borrar los datos o revocar la autorización (decisión 13).

## 6. Revisión adversarial de la síntesis (fase 2, 8 de noviembre de 2026)

Un agente revisó, contra el `texto_literal` de cada entrada citada, los parámetros, las preguntas verificadas, el banco de evaluación y el valor de referencia de las infracciones. Esta revisión también es automática: no reemplaza la de Juan.

### Conteos

| Archivo | Revisado | Corregido |
|---|---|---|
| `data/normativa/parametros.json` | 11 parámetros y `unidad_multa` | 1 parámetro (sustento) y 1 nota de `unidad_multa` |
| `data/preguntas-verificadas.json` | 45 preguntas y 60 citas (58 antes de la revisión) | 8 respuestas reescritas, 1 con citas nuevas. Ninguna eliminada |
| `data/banco-evaluacion.json` | 60 preguntas (40 con sustento, 10 sin sustento, 10 fuera de tema) | 14 preguntas reemplazadas por casi duplicados, 1 respuesta esperada aclarada, 1 pregunta sin sustento precisada. El reparto sigue en 40/10/10 |
| `data/infracciones.json` | 108 `valor_referencia` | 0 valores. 1 nota corregida |

### Parámetros

- Los 11 valores y sus puntos de partida salen del texto literal de su sustento. Ninguno cambió de valor ni de estado.
- `dias_habiles_via`: se agregó `L769-2002-art2` al `sustento`. El punto de partida (`dia_siguiente_evento`) se apoya en la definición de comparendo como "Orden formal de notificación", y esa entrada no estaba listada.
- `unidad_multa.notas`: la fórmula decía "salario mínimo de 2023 / 10.000". Quedó así: UVB de la multa = cantidad de SMDLV × salario mínimo **diario** de 2023 / 10.000. El salario mínimo de 2023 no está en la base, así que la fórmula sigue sin poder aplicarse.
- Unidad `dias_sin_precisar` (en `plazo_pago_reducido_50` y `plazo_pago_reducido_75`): no está entre las unidades del contrato. No rompe nada, porque esos parámetros están en `false` y `ParametrosPlazos` no los lee. Se dejó a propósito.

### Preguntas verificadas

Las 60 citas existen y apuntan a entradas en `verificado: true`. Ninguna pregunta cita los conceptos de MinTransporte. Cambios:

| Id | Problema encontrado | Corrección |
|---|---|---|
| PV-003 | Decía "La ley prohíbe a cualquier persona impedir esas grabaciones" sin decir que el art. 21 habla de procedimientos **policivos** | Ahora lo dice, y repite la advertencia de PV-002 sobre los agentes de tránsito que no son policías |
| PV-005 | No daba el plazo para comparecer | Agrega "dentro de los cinco (5) días hábiles siguientes a la notificación del comparendo" (art. 136, literal) |
| PV-007 | "cinco (5) días hábiles" sin decir desde cuándo | Agrega "siguientes a la notificación del comparendo" |
| PV-020 | "El artículo 131 dice en qué infracciones procede" (la inmovilización). El art. 125 dice "en los casos a que se refiere este código", no solo el 131 | Ahora dice "Varias infracciones del artículo 131 traen además la inmovilización", con el ejemplo D.2 |
| PV-030 | Generalizaba los dos recursos. El art. 142 limita la apelación a las resoluciones que ponen fin a la primera instancia y exige presentarla de forma oral | Corregido |
| PV-033 | Remitía a SIMIT, que no está en la base. Omitía el literal F y la UVB | Quita SIMIT. Dice que el literal F remite al art. 152 y que desde 2024 la multa se calcula en UVB. Agrega las citas `L2294-2023-art313` y `L2294-2023-art372`. Aclara que la app no muestra el valor en pesos porque no está verificado |
| PV-037 | Decía "Usar teléfonos [...] al conducir". El literal C.38 dice "teléfonos instalados en los vehículos" | Corregido para seguir el texto |
| PV-042 | "Desde 2026 también es festivo nacional el 9 de julio": el texto no fija la fecha desde la que rige | Ahora dice "La Ley 2578 de 2026 declaró festivo nacional el 9 de julio". Sigue abierta la decisión 7 (traslado al lunes) |

Se revisaron y se dejaron igual:
- **PV-011.** Dice "no desde el día de la infracción", que se desprende de "contados a partir del recibo".
- **PV-016.** Cita literal del parágrafo 1 del art. 129. Ojo: el art. 135 dice que el propietario "estará obligado al pago de la multa" en la detección por medios técnicos. Ese aparte es condicionalmente exequible (C-980-10), y la solidaridad del parágrafo 1 del art. 8 de la Ley 1843 fue declarada inexequible (C-038-20). Juan debe confirmar que la respuesta no confunde a un propietario con fotomulta.
- **PV-021.** Las notas del editor de la fuente remiten al art. 209 del Decreto 19 de 2012, que no está en la base. Puede haber requisitos adicionales para retirar el vehículo.

### Banco de evaluación

Se comparó cada pregunta del banco con las 45 preguntas verificadas y sus 184 variantes. Se usaron dos medidas: similitud de palabras sin tildes ni palabras vacías, y una lectura de la intención. Ninguna era idéntica, pero 14 preguntaban lo mismo que una variante con otras palabras. Se reemplazaron por preguntas sobre otro fragmento verificado:

| Id | Antes (casi igual a) | Ahora | Artículos esperados |
|---|---|---|---|
| BE-001 | PV-004, "hasta cuando puedo ir al transito despues del comparendo" | Desde cuándo corren los días tras firmar el comparendo | art. 136, art. 135 |
| BE-002 | PV-005, "yo no cometi esa infraccion como reclamo" | Si el funcionario puede decretar pruebas de oficio | art. 136 |
| BE-003 | PV-007, "si no voy a la audiencia que me pasa" | Pagar la multa en un banco (convenios de recaudo) | art. 136 |
| BE-004 | PV-008, "puede ir otra persona por mi a la audiencia" | Intervención del Ministerio Público | art. 138 |
| BE-006 | PV-010, "me llego una fotomulta cuanto tiempo tengo" | A quién se envía la fotomulta si manejaba otra persona | L1843 art. 8, art. 137 |
| BE-007 | PV-012, "cuanto se demoran en mandarme la fotomulta" | Notificación por aviso si no ubican al propietario | L1843 art. 8 |
| BE-011 | PV-019, "la empresa de las camaras puede multarme" | Normas que se aplican a lo no regulado por la Ley 1843 | L1843 art. 9 |
| BE-013 | PV-018, "tengo que ir en persona por la fotomulta" | La prueba como anexo necesario del comparendo | art. 137 |
| BE-014 | PV-024, "cuanto me descuentan si pago rapido" | Contenido de seguridad vial sobre ciclistas en los cursos | art. 136 |
| BE-016 | PV-025, "donde hago el curso para el descuento" | Reparto del 25 % y el excedente si el curso es en otra jurisdicción | art. 136 |
| BE-017 | PV-026, "acepte el comparendo y no pague" | Inspecciones ambulantes: sanción en el sitio | art. 136 |
| BE-023 | PV-030, "no estoy de acuerdo con el fallo de transito" | Cuándo queda en firme una providencia | art. 142 |
| BE-030 | PV-002, "puedo filmar cuando me paran" | Sanción por accidente causado por una deficiencia orgánica o funcional | art. 157 |
| BE-035 | PV-034, "¿Las multas se cobran en salarios mínimos o en UVB?" | Multa ejecutoriada antes de 2024 (parágrafo 3 del art. 313) | L2294 art. 313 |

Otros cambios:
- **BE-026.** La respuesta esperada tenía una doble negación confusa. Quedó: "No: el vehículo no se lleva al parqueadero si la causa es subsanable en el sitio".
- **BE-047** (sin sustento). Ahora pregunta por el límite de velocidad "para un carro". El literal G.6 del art. 131 sí trae límites (25 y 40 km/h), pero solo para vehículos eléctricos livianos de movilidad personal. La respuesta esperada lo explica.

Las 10 preguntas sin sustento se buscaron en todos los textos literales de la base:
- pico y placa, SOAT, renovación de la licencia por edad, exámenes médicos y traspaso: no aparecen;
- revisión técnico-mecánica: solo el C.35, con "plazo legal establecido";
- grúa: solo la solidaridad del art. 125, parágrafo 4;
- cobro coactivo: solo el art. 159;
- alcohol: solo la remisión del literal F al art. 152.

Siguen sin sustento.

Las preguntas nuevas las redactó un agente. `construida_por` y `calificada_por` no cambiaron: siguen pendientes de la calificación de Juan.

### Infracciones: valor de referencia

- Los 108 `valor_referencia` están en `null`. No hay ningún cálculo que revisar, y es lo correcto mientras `unidad_multa` esté en `false` y la equivalencia de SMDLV a UVB no esté verificada.
- Las cantidades de SMDLV de cada infracción coinciden con el encabezado de su literal: A = 4, B = 8, C = 15, D = 30, E = 45, G = 6, y F sin multa propia.
- Se corrigió la nota general, que decía "unidad vigente (UVT/UVB)". La unidad vigente para las multas de tránsito es la UVB. La UVT queda excluida por el parágrafo 2 del art. 313 solo para lo tributario.
- Para calcularlo después hace falta el salario mínimo de 2023, que no está en la base. La regla de dividir el salario mensual entre 30 para obtener el diario tampoco tiene sustento en la base.
