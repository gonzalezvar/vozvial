# Evaluación del asistente

Archivo generado por `npm run eval:asistente` (scripts/eval-asistente.ts). No editar a mano: los cambios se hacen en el script.

- Fecha de ejecución: 2026-11-08
- Modo evaluado: verificado (MiniSearch y puntaje propio sobre data/preguntas-verificadas.json). El modo LLM no se evaluó.
- Umbral: 0.85. Margen frente a la rival con otras citas: 0. Pesos: alfa 0.7, temas 0.8, respuesta 0.6, base 0.6, literal 0.6, información 1.
- Preguntas verificadas indexadas: 49 (descartadas por no tener cita verificada: 0)
- Banco: 60 preguntas (40 con_sustento, 10 sin_sustento, 10 fuera_de_tema).
- Las preguntas del banco las construyó el equipo con asistencia de IA y su calificación humana está pendiente (campo `calificada_por` del banco).

## Metodología del refinamiento (etapa 5 del ciclo de vida)

1. **Resultado ANTES.** Se guardaron los números del informe anterior (tabla ANTES vs DESPUÉS).
2. **Diagnóstico.** Se miraron los errores del banco uno por uno: términos tras normalizar, puntaje, y en qué lugar quedaba la pregunta verificada pertinente. Hallazgos:
   - El puntaje premiaba casi solo las palabras de la formulación (pregunta y variantes). Las preguntas reales usan palabras del texto de la norma ("Ministerio Público", "interrumpe", "contraventor") que no estaban en ninguna formulación y que, por no estar en el corpus del IDF, pesaban lo máximo.
   - Sin raíces, "decidieron" no coincidía con "decisión" ni "notificaron" con "notificación" fuera de los casos del prefijo largo.
   - "inspector" se llevaba a "agente"; el inspector es el funcionario que decide en la audiencia, no el agente de la vía.
   - Varios artículos verificados de la base no tenían ninguna pregunta verificada que los citara: aunque la búsqueda acertara la norma, no había respuesta sencilla que devolver.
   - Las preguntas de una sola palabra útil ("¿audiencia?") empataban con muchas formulaciones y daban puntaje 1.
3. **Cambios generales** (ninguno copia preguntas del banco):
   - `NormalizadorEspanol`: raíz ligera del español (`raizLigera`, quita sufijos verbales y nominales comunes) y coincidencia `terminosAfines` (prefijo largo, misma raíz o una letra de diferencia en palabras de 7 o más letras). Solo la usa el modo verificado; DetectorTema y el modo LLM siguen igual. Sinónimos nuevos: `funcionario` (inspector) y `propietario` (dueño).
   - `ProveedorVerificado`: el puntaje ahora da crédito a las palabras que aparecen en el título, el resumen y los temas de las normas citadas y en el mejor párrafo de su texto literal; el IDF se calcula sobre los párrafos de la base y las respuestas verificadas (no sobre las formulaciones); factor de información mínima para preguntas de muy pocas palabras (no se aplica si la pregunta repite una formulación verificada); margen relativo frente a la mejor rival que no comparte citas, además del umbral absoluto. La respuesta sigue siendo siempre la respuesta_sencilla verificada con sus citas: nunca texto generado.
   - `DetectorTema`: se agregó `funcionario` al vocabulario, porque al separar "inspector" de "agente" la pregunta sobre el inspector dejaba de reconocerse como de tránsito.
   - `data/preguntas-verificadas.json`: 4 preguntas nuevas (PV-046 a PV-049) para entradas verificadas de la base que no tenían ninguna pregunta (ver "Preguntas verificadas nuevas").
4. **Calibración sin el banco.** Umbral, margen y pesos se eligieron con validación cruzada deja-una-fuera sobre las preguntas verificadas y con un control negativo propio (sección "Cómo se eligieron umbral, margen y pesos").
5. **Evaluación.** Durante el trabajo el banco se corrió tres veces: la del diagnóstico, una tras la primera calibración (0 de 40) y la final. Después de la segunda se amplió la grilla de la calibración (crédito más alto para el texto literal y el factor de información) porque el diagnóstico había mostrado que las preguntas reales usan palabras de la norma; los valores se eligieron otra vez solo con la calibración. Ningún peso, umbral ni margen se fijó mirando el banco. La tabla de sensibilidad del banco es posterior y no cambió nada.

### Preguntas verificadas nuevas

Criterio general: cada entrada con `verificado: true` de la base que no tenía ninguna pregunta verificada recibe una, siempre que se pueda responder solo con su texto literal y que la pregunta no sea una paráfrasis de una pregunta del banco. Se revisó cada una contra las 60 preguntas del banco.

| Entrada de la base | Decisión | Razón |
|---|---|---|
| L1581-2012-art4 (principios de datos) | PV-046 | Pregunta general por los principios. No es paráfrasis de BE-038 (que pregunta solo por el deber de cuidar los datos), aunque la respuesta incluye el principio de seguridad. |
| L1581-2012-art17 (deberes del responsable) | PV-047 | Pregunta general por los deberes. Comparte tema con BE-038 y BE-039, pero no las repite: BE-039 espera el art. 8. |
| MT-CONCEPTO-20261340231211 (UVB 2026) | PV-048 | Valor de la UVB 2026 dicho por el concepto; la respuesta aclara que el concepto no es obligatorio. Ninguna pregunta del banco lo pide. |
| MT-CONCEPTO-20241340954691 y L2294-2023-art313 (método UVB) | PV-049 | Cómo se pasa una multa a UVB. Cita también el art. 313 porque de él salen los $10.000 y la aproximación. No es paráfrasis de BE-035 (multa ejecutoriada antes de 2024). |
| L1843-2017-art9 (normas complementarias) | No se agregó | El artículo dice una sola cosa y cualquier pregunta sobre él sería paráfrasis de BE-011. |
| L769-2002-art139 (notificación en estrados) | No se agregó | Igual: una sola regla; cualquier pregunta sería paráfrasis de BE-025. |
| L769-2002-art157 (incapacidad) | No se agregó | Igual: una sola regla; cualquier pregunta sería paráfrasis de BE-030. Además remite al art. 24, que no está en la base. |
| L769-2002-art137 (comparendo por medios técnicos) | No se agregó | Su plazo adicional de 6 días convive con el art. 8 de la Ley 1843 y la Corte condicionó su inciso 3 (C-530-03, en las notas de la base). Una respuesta solo con el texto literal podría confundir; requiere revisión humana. |
| L769-2002-art158 (procedimiento de sanciones especiales) | No se agregó | Sus 10 días para descargos son de las sanciones especiales y no del comparendo ordinario; una respuesta suelta podría confundirse con el plazo del comparendo. |

Criterios de acierto:
- con_sustento: tipo `respuesta` y al menos una cita dentro de `articulos_esperados`. Citar un artículo que existe pero no es el pertinente cuenta como error.
- sin_sustento: tipo `abstencion`.
- fuera_de_tema: tipo `fuera_de_tema`.
- Los tiempos son por pregunta, medidos con `performance.now()` en este computador; en proceso no incluyen red.

## ANTES vs DESPUÉS (en proceso, mismo banco)

ANTES: versión del 2026-11-08 con umbral 0.85, sin margen y 45 preguntas verificadas. DESPUÉS: esta versión, umbral 0.85, margen 0 y 49 preguntas verificadas.

| Métrica | Meta | ANTES | DESPUÉS |
|---|---|---|---|
| Citas pertinentes (con_sustento) | ≥ 95 % | 0.0 % (0/40) | 0.0 % (0/40) |
| Abstenciones correctas (sin_sustento) | ≥ 90 % | 100.0 % (10/10) | 100.0 % (10/10) |
| Fuera de tema correctos | - | 100.0 % (10/10) | 100.0 % (10/10) |
| Falsas abstenciones (con_sustento) | - | 97.5 % (39/40) | 97.5 % (39/40) |
| Respuestas con cita no pertinente (con_sustento) | - | 0.0 % (0/40) | 0.0 % (0/40) |
| Con sustento marcadas fuera de tema | - | 2.5 % (1/40) | 2.5 % (1/40) |
| Sin sustento respondidas (error) | - | 0.0 % (0/10) | 0.0 % (0/10) |
| Diagnóstico: la primera candidata cita un artículo esperado (sin umbral) | - | 21/40 | 24/40 |
| Tiempo p50 por pregunta (local, en proceso) | - | 1.07 ms | 3.71 ms |
| Tiempo p95 por pregunta (local, en proceso) | < 1,5 s desde Vercel | 2.45 ms | 6.31 ms |

## Conclusión frente a RNF-02 y RNF-03

| Requisito | Meta | Resultado | Veredicto |
|---|---|---|---|
| RNF-03 · citas pertinentes | ≥ 95 % | 0.0 % | No cumple |
| RNF-03 · abstenciones correctas | ≥ 90 % | 100.0 % | Cumple |
| RNF-02 · p95 desde Vercel | < 1,5 s | 6.31 ms en local (en proceso, sin red) | Pendiente: falta medir desde Vercel |

- RNF-03 (citas pertinentes) **No cumple**: 0 de 40. Quedan 39 falsas abstenciones, 0 respuestas con cita no pertinente y 1 marcadas fuera de tema. Las causas están en "Errores restantes".
- Cota informativa: aun eligiendo el umbral mirando el banco (lo que no se hizo), el mejor resultado que mantiene las abstenciones correctas en 90 % o más es 8 de 40 (20.0 %) con umbral 0.70. La meta de 95 % no se alcanza con este modo verificado y estas 49 preguntas verificadas: hace falta más cobertura de preguntas verificadas (redactadas y revisadas por una persona) o un recuperador semántico, no un umbral distinto.
- La mejora real de este refinamiento está en el orden de las candidatas (fila "Diagnóstico" de la tabla ANTES vs DESPUÉS), no en las respuestas entregadas: con el umbral calibrado el asistente sigue prefiriendo abstenerse.
- RNF-02: el p95 se midió en local, en proceso y sin red. La medición desde Vercel la hace Juan después de publicar (docs/despliegue.md, sección 5). Hasta entonces RNF-02 no se da por cumplido.
- El banco lo construyó el equipo con asistencia de IA y su calificación humana está pendiente; los porcentajes valen para este banco de 60 preguntas.

## Resultados en proceso (DESPUÉS)

| Métrica | Resultado | Detalle |
|---|---|---|
| Citas pertinentes (con_sustento) | 0.0 % | 0 de 40 respondieron y citaron al menos un artículo esperado |
| Falsas abstenciones (con_sustento) | 97.5 % | 39 de 40 |
| Respuestas con cita no pertinente (con_sustento) | 0.0 % | 0 de 40 |
| Con sustento marcadas fuera de tema | 2.5 % | 1 de 40 |
| Abstenciones correctas (sin_sustento) | 100.0 % | 10 de 10; respondieron sin sustento: 0 |
| Fuera de tema correctos | 100.0 % | 10 de 10 |
| Respuestas tipo "respuesta" con al menos una cita | n/a | 0 de 0 |
| Tiempo por pregunta p50 | 3.71 ms | |
| Tiempo por pregunta p95 | 6.31 ms | |

### Errores (40 de 60)

| Id | Tipo | Pregunta | Esperado | Obtenido | Puntaje | Error |
|---|---|---|---|---|---|---|
| BE-001 | con_sustento | Firmé el comparendo esta mañana, ¿desde cuándo empiezan a correr los días para ir al tránsito? | respuesta citando L769-2002-art136 o L769-2002-art135 | abstención | 0.663 | falsa abstención |
| BE-002 | con_sustento | En la audiencia, ¿el funcionario puede pedir pruebas por su cuenta aunque yo no las pida? | respuesta citando L769-2002-art136 | abstención | 0.594 | falsa abstención |
| BE-003 | con_sustento | ¿Puedo pagar la multa de tránsito en un banco? | respuesta citando L769-2002-art136 | abstención | 0.743 | falsa abstención |
| BE-004 | con_sustento | ¿El Ministerio Público puede intervenir en mi proceso de tránsito? | respuesta citando L769-2002-art138 | abstención | 0.569 | falsa abstención |
| BE-005 | con_sustento | Si en el comparendo está involucrado un menor de edad, ¿tiene que ir acompañado? | respuesta citando L769-2002-art138 | abstención | 0.473 | falsa abstención |
| BE-006 | con_sustento | El carro es mío pero lo manejaba mi hijo cuando lo cogió la cámara, ¿a quién le mandan el comparendo? | respuesta citando L1843-2017-art8 o L769-2002-art137 | abstención | 0.376 | falsa abstención |
| BE-007 | con_sustento | Si no encuentran al dueño en la dirección del RUNT, ¿cómo le notifican la fotomulta? | respuesta citando L1843-2017-art8 | abstención | 0.805 | falsa abstención |
| BE-008 | con_sustento | ¿Qué datos debo tener al día en el RUNT para que me lleguen las notificaciones? | respuesta citando L1843-2017-art8 | abstención | 0.592 | falsa abstención |
| BE-009 | con_sustento | ¿Qué cuenta como sistema de fotodetección según la ley? | respuesta citando L1843-2017-art1 | abstención | 0.672 | falsa abstención |
| BE-010 | con_sustento | En una carretera nacional, ¿a cuántos metros antes del radar debe estar la señal? | respuesta citando L1843-2017-art10 | abstención | 0.511 | falsa abstención |
| BE-011 | con_sustento | ¿Qué normas se aplican a lo que la ley de fotomultas no regula? | respuesta citando L1843-2017-art9 | abstención | 0.405 | falsa abstención |
| BE-012 | con_sustento | Si demuestro que la notificación de la cámara fue a parar a otra parte, ¿desde qué fecha corre la rebaja? | respuesta citando L1843-2017-art7 o L769-2002-art136 | abstención | 0.642 | falsa abstención |
| BE-013 | con_sustento | Si la multa es por cámara, ¿la prueba tiene que venir junto con el comparendo? | respuesta citando L769-2002-art137 | abstención | 0.427 | falsa abstención |
| BE-014 | con_sustento | ¿Los cursos para infractores deben enseñar a respetar a los ciclistas? | respuesta citando L769-2002-art136 | abstención | 0.462 | falsa abstención |
| BE-015 | con_sustento | ¿Hasta cuántos días tengo para pagar solo el setenta y cinco por ciento? | respuesta citando L769-2002-art136 | abstención | 0.725 | falsa abstención |
| BE-016 | con_sustento | Si hago el curso en un municipio distinto al de la multa, ¿a quién le pago? | respuesta citando L769-2002-art136 | abstención | 0.487 | falsa abstención |
| BE-017 | con_sustento | ¿Me pueden sancionar ahí mismo en la calle, sin ir a una oficina? | respuesta citando L769-2002-art136 | abstención | 0.548 | falsa abstención |
| BE-018 | con_sustento | Si en la audiencia me declaran contraventor, ¿pago la multa completa? | respuesta citando L769-2002-art136 | abstención | 0.659 | falsa abstención |
| BE-019 | con_sustento | Tengo una multa de hace cuatro años que nunca me cobraron, ¿sigue vigente? | respuesta citando L769-2002-art159 | abstención | 0.456 | falsa abstención |
| BE-020 | con_sustento | ¿Qué interrumpe la prescripción de una sanción de tránsito? | respuesta citando L769-2002-art159 | abstención | 0.745 | falsa abstención |
| BE-021 | con_sustento | Me pusieron el comparendo hace más de un año y nunca decidieron nada, ¿qué pasa con eso? | respuesta citando L769-2002-art161 o L1843-2017-art11 | abstención | 0.365 | falsa abstención |
| BE-022 | con_sustento | ¿Qué es la revocación directa en un proceso de tránsito? | respuesta citando L769-2002-art161 o L1843-2017-art11 | abstención | 0.571 | falsa abstención |
| BE-023 | con_sustento | ¿Cuándo queda en firme lo que decidió el inspector? | respuesta citando L769-2002-art142 | abstención | 0.575 | falsa abstención |
| BE-024 | con_sustento | ¿En qué momento tengo que sustentar la reposición? | respuesta citando L769-2002-art142 | abstención | 0.636 | falsa abstención |
| BE-025 | con_sustento | ¿Cómo me entero de lo que decidan dentro del proceso? | respuesta citando L769-2002-art139 | fuera de tema | 0.000 | marcada fuera de tema |
| BE-026 | con_sustento | Si el problema del carro se puede arreglar ahí mismo, ¿igual se lo llevan al parqueadero? | respuesta citando L769-2002-art125 | abstención | 0.553 | falsa abstención |
| BE-027 | con_sustento | ¿El parqueadero autorizado puede dejar salir mi carro sin orden de la autoridad? | respuesta citando L769-2002-art125 | abstención | 0.757 | falsa abstención |
| BE-028 | con_sustento | ¿Por cuánto tiempo queda inmovilizado un vehículo? | respuesta citando L769-2002-art125 o L769-2002-art2 | abstención | 0.766 | falsa abstención |
| BE-029 | con_sustento | ¿Qué consecuencia tiene para un policía impedir que uno lo grabe? | respuesta citando L1801-2016-art21 | abstención | 0.604 | falsa abstención |
| BE-030 | con_sustento | Si choco y se comprueba que la causa fue una deficiencia física o de salud que yo tenía, ¿qué sanción me pueden poner? | respuesta citando L769-2002-art157 | abstención | 0.121 | falsa abstención |
| BE-031 | con_sustento | ¿El testigo que firma el comparendo por mí qué datos tiene que dar? | respuesta citando L769-2002-art135 | abstención | 0.789 | falsa abstención |
| BE-032 | con_sustento | Al papel que me dieron le falta el número de placa del agente, ¿debía tenerlo? | respuesta citando L769-2002-art129 | abstención | 0.351 | falsa abstención |
| BE-033 | con_sustento | ¿Cuánto me cobran por dejar el carro estacionado donde no se puede? | respuesta citando L769-2002-art131 | abstención | 0.570 | falsa abstención |
| BE-034 | con_sustento | ¿Cuánto es la multa por llevar a mi nieto de ocho años en la silla de adelante? | respuesta citando L769-2002-art131 | abstención | 0.514 | falsa abstención |
| BE-035 | con_sustento | Mi multa quedó ejecutoriada en 2022 y todavía la debo, ¿me la pasan a la unidad nueva que empezó en 2024? | respuesta citando L2294-2023-art313 | abstención | 0.381 | falsa abstención |
| BE-036 | con_sustento | Iba muy rápido y me pararon, ¿de cuánto es el comparendo por eso? | respuesta citando L769-2002-art131 | abstención | 0.584 | falsa abstención |
| BE-037 | con_sustento | ¿Qué diferencia hay entre una infracción simple y una compleja? | respuesta citando L769-2002-art2 | abstención | 0.411 | falsa abstención |
| BE-038 | con_sustento | ¿Quien guarda mis datos tiene que cuidarlos para que no se pierdan ni los vea cualquiera? | respuesta citando L1581-2012-art17 o L1581-2012-art4 | abstención | 0.336 | falsa abstención |
| BE-039 | con_sustento | ¿Ante qué entidad me puedo quejar si una aplicación usa mal mis datos? | respuesta citando L1581-2012-art8 | abstención | 0.423 | falsa abstención |
| BE-040 | con_sustento | ¿El 12 de octubre se corre para el lunes? | respuesta citando L51-1983-art1 | abstención | 0.814 | falsa abstención |

### Detalle de todas las preguntas

| Id | Tipo | Obtenido | Pregunta verificada usada | Citas | Puntaje | ms | Acierto |
|---|---|---|---|---|---|---|---|
| BE-001 | con_sustento | abstencion | - | - | 0.663 | 7.11 | No |
| BE-002 | con_sustento | abstencion | - | - | 0.594 | 4.74 | No |
| BE-003 | con_sustento | abstencion | - | - | 0.743 | 3.45 | No |
| BE-004 | con_sustento | abstencion | - | - | 0.569 | 5.48 | No |
| BE-005 | con_sustento | abstencion | - | - | 0.473 | 3.96 | No |
| BE-006 | con_sustento | abstencion | - | - | 0.376 | 7.75 | No |
| BE-007 | con_sustento | abstencion | - | - | 0.805 | 4.77 | No |
| BE-008 | con_sustento | abstencion | - | - | 0.592 | 3.07 | No |
| BE-009 | con_sustento | abstencion | - | - | 0.672 | 3.11 | No |
| BE-010 | con_sustento | abstencion | - | - | 0.511 | 5.25 | No |
| BE-011 | con_sustento | abstencion | - | - | 0.405 | 3.71 | No |
| BE-012 | con_sustento | abstencion | - | - | 0.642 | 7.69 | No |
| BE-013 | con_sustento | abstencion | - | - | 0.427 | 3.93 | No |
| BE-014 | con_sustento | abstencion | - | - | 0.462 | 3.09 | No |
| BE-015 | con_sustento | abstencion | - | - | 0.725 | 4.30 | No |
| BE-016 | con_sustento | abstencion | - | - | 0.487 | 5.25 | No |
| BE-017 | con_sustento | abstencion | - | - | 0.548 | 2.29 | No |
| BE-018 | con_sustento | abstencion | - | - | 0.659 | 5.47 | No |
| BE-019 | con_sustento | abstencion | - | - | 0.456 | 4.53 | No |
| BE-020 | con_sustento | abstencion | - | - | 0.745 | 3.99 | No |
| BE-021 | con_sustento | abstencion | - | - | 0.365 | 3.18 | No |
| BE-022 | con_sustento | abstencion | - | - | 0.571 | 3.52 | No |
| BE-023 | con_sustento | abstencion | - | - | 0.575 | 4.66 | No |
| BE-024 | con_sustento | abstencion | - | - | 0.636 | 1.59 | No |
| BE-025 | con_sustento | fuera_de_tema | - | - | 0.000 | 0.09 | No |
| BE-026 | con_sustento | abstencion | - | - | 0.553 | 4.32 | No |
| BE-027 | con_sustento | abstencion | - | - | 0.757 | 5.84 | No |
| BE-028 | con_sustento | abstencion | - | - | 0.766 | 4.22 | No |
| BE-029 | con_sustento | abstencion | - | - | 0.604 | 2.79 | No |
| BE-030 | con_sustento | abstencion | - | - | 0.121 | 5.01 | No |
| BE-031 | con_sustento | abstencion | - | - | 0.789 | 3.79 | No |
| BE-032 | con_sustento | abstencion | - | - | 0.351 | 4.18 | No |
| BE-033 | con_sustento | abstencion | - | - | 0.570 | 4.53 | No |
| BE-034 | con_sustento | abstencion | - | - | 0.514 | 6.16 | No |
| BE-035 | con_sustento | abstencion | - | - | 0.381 | 6.31 | No |
| BE-036 | con_sustento | abstencion | - | - | 0.584 | 3.88 | No |
| BE-037 | con_sustento | abstencion | - | - | 0.411 | 3.72 | No |
| BE-038 | con_sustento | abstencion | - | - | 0.336 | 3.45 | No |
| BE-039 | con_sustento | abstencion | - | - | 0.423 | 3.05 | No |
| BE-040 | con_sustento | abstencion | - | - | 0.814 | 1.38 | No |
| BE-041 | sin_sustento | abstencion | - | - | 0.234 | 1.83 | Sí |
| BE-042 | sin_sustento | abstencion | - | - | 0.817 | 3.70 | Sí |
| BE-043 | sin_sustento | abstencion | - | - | 0.551 | 5.63 | Sí |
| BE-044 | sin_sustento | abstencion | - | - | 0.518 | 3.94 | Sí |
| BE-045 | sin_sustento | abstencion | - | - | 0.363 | 2.87 | Sí |
| BE-046 | sin_sustento | abstencion | - | - | 0.684 | 4.96 | Sí |
| BE-047 | sin_sustento | abstencion | - | - | 0.559 | 3.68 | Sí |
| BE-048 | sin_sustento | abstencion | - | - | 0.649 | 3.60 | Sí |
| BE-049 | sin_sustento | abstencion | - | - | 0.533 | 5.30 | Sí |
| BE-050 | sin_sustento | abstencion | - | - | 0.436 | 3.10 | Sí |
| BE-051 | fuera_de_tema | fuera_de_tema | - | - | 0.000 | 0.02 | Sí |
| BE-052 | fuera_de_tema | fuera_de_tema | - | - | 0.000 | 0.01 | Sí |
| BE-053 | fuera_de_tema | fuera_de_tema | - | - | 0.000 | 0.01 | Sí |
| BE-054 | fuera_de_tema | fuera_de_tema | - | - | 0.000 | 0.01 | Sí |
| BE-055 | fuera_de_tema | fuera_de_tema | - | - | 0.000 | 0.01 | Sí |
| BE-056 | fuera_de_tema | fuera_de_tema | - | - | 0.000 | 0.02 | Sí |
| BE-057 | fuera_de_tema | fuera_de_tema | - | - | 0.000 | 0.01 | Sí |
| BE-058 | fuera_de_tema | fuera_de_tema | - | - | 0.000 | 0.01 | Sí |
| BE-059 | fuera_de_tema | fuera_de_tema | - | - | 0.000 | 0.01 | Sí |
| BE-060 | fuera_de_tema | fuera_de_tema | - | - | 0.000 | 0.01 | Sí |

### Errores restantes: términos y candidatas

Para cada error: términos tras normalizar, la mejor candidata (con umbral y margen en 0), su puntaje y margen, y la primera candidata que sí cita un artículo esperado.

| Id | Términos | Mejor candidata | Puntaje / margen | Primera candidata pertinente |
|---|---|---|---|---|
| BE-001 | firme comparendo manana cuando empiezan correr dia transito | PV-004: ¿Cuánto tiempo tengo para presentarme si me pusieron un comparendo en la calle? | 0.663 / 0.061 | PV-004 en el lugar 1 (0.663) |
| BE-002 | impugnar funcionario pedir prueba cuenta aunque pida | PV-006: ¿Puedo llevar pruebas a la audiencia? | 0.594 / 0.338 | PV-006 en el lugar 1 (0.594) |
| BE-003 | pagar comparendo transito banco | PV-007: ¿Qué pasa si no me presento dentro del plazo? | 0.743 / 0.202 | PV-007 en el lugar 1 (0.743) |
| BE-004 | ministerio publico intervenir proceso transito | PV-007: ¿Qué pasa si no me presento dentro del plazo? | 0.569 / 0.075 | PV-008 en el lugar 2 (0.495) |
| BE-005 | comparendo involucrado menor edad acompanado | PV-039: ¿Cuánto es la multa por no usar el cinturón de seguridad? | 0.473 / 0.316 | PV-008 en el lugar 29 (0.000) |
| BE-006 | vehiculo mio manejaba hijo cuando cogio fotomulta quien mandan comparendo | PV-010: ¿Cuánto tiempo tengo para presentarme por una fotomulta? | 0.376 / 0.061 | PV-010 en el lugar 1 (0.376) |
| BE-007 | encuentran propietario direccion runt notificar fotomulta | PV-012: ¿Cómo me llega una fotomulta? | 0.805 / 0.315 | PV-012 en el lugar 1 (0.805) |
| BE-008 | dato dia runt lleguen notificar | PV-013: ¿Qué pasa si no actualicé mi dirección en el RUNT? | 0.592 / 0.166 | PV-013 en el lugar 1 (0.592) |
| BE-009 | cuenta sistema fotomulta ley | PV-011: ¿Los días de la fotomulta se cuentan desde la infracción o desde que me llega? | 0.672 / 0.139 | PV-014 en el lugar 7 (0.437) |
| BE-010 | carretera nacional cuanto metro fotomulta senal | PV-010: ¿Cuánto tiempo tengo para presentarme por una fotomulta? | 0.511 / 0.038 | PV-015 en el lugar 2 (0.473) |
| BE-011 | norma aplican ley fotomulta regula | PV-012: ¿Cómo me llega una fotomulta? | 0.405 / 0.023 | ninguna pregunta verificada cita esos artículos |
| BE-012 | demuestro notificar fotomulta parar otro comparendo fecha corre descuento | PV-017: No me notificaron la fotomulta, ¿pierdo el descuento? | 0.642 / 0.109 | PV-017 en el lugar 1 (0.642) |
| BE-013 | comparendo fotomulta prueba venir junto | PV-014: ¿Una cámara sirve como prueba de una infracción? | 0.427 / 0.031 | ninguna pregunta verificada cita esos artículos |
| BE-014 | curso infractor ensenar respetar ciclista | PV-025: ¿El curso para la rebaja puede ser virtual? | 0.462 / 0.462 | PV-025 en el lugar 1 (0.462) |
| BE-015 | cuanto dia pagar setenta cinco ciento | PV-004: ¿Cuánto tiempo tengo para presentarme si me pusieron un comparendo en la calle? | 0.725 / 0.115 | PV-004 en el lugar 1 (0.725) |
| BE-016 | curso municipio distinto comparendo quien pagar | PV-024: ¿Hay descuento si pago la multa rápido? | 0.487 / 0.010 | PV-024 en el lugar 1 (0.487) |
| BE-017 | sancionar calle oficina | PV-004: ¿Cuánto tiempo tengo para presentarme si me pusieron un comparendo en la calle? | 0.548 / 0.154 | PV-004 en el lugar 1 (0.548) |
| BE-018 | impugnar declaran contraventor pagar comparendo completa | PV-005: ¿Cómo pido la audiencia para impugnar el comparendo? | 0.659 / 0.183 | PV-005 en el lugar 1 (0.659) |
| BE-019 | comparendo cuatro anos cobraron sigue vigente | PV-034: ¿Las multas se cobran en salarios mínimos o en UVB? | 0.456 / 0.033 | PV-028 en el lugar 5 (0.348) |
| BE-020 | interrumpe prescripcion sancion transito | PV-028: ¿Cuándo prescribe una multa de tránsito? | 0.745 / 0.264 | PV-028 en el lugar 1 (0.745) |
| BE-021 | comparendo ano decidieron nada | PV-029: ¿Qué es la caducidad de un comparendo? | 0.365 / 0.063 | PV-029 en el lugar 1 (0.365) |
| BE-022 | revocacion directa proceso transito | PV-007: ¿Qué pasa si no me presento dentro del plazo? | 0.571 / 0.100 | PV-029 en el lugar 2 (0.470) |
| BE-023 | cuando queda firme decidio funcionario | PV-004: ¿Cuánto tiempo tengo para presentarme si me pusieron un comparendo en la calle? | 0.575 / 0.205 | PV-030 en el lugar 24 (0.000) |
| BE-024 | momento sustentar recurso | PV-030: ¿Puedo apelar la decisión de la audiencia? | 0.636 / 0.185 | PV-030 en el lugar 1 (0.636) |
| BE-025 | entero decidan dentro proceso | PV-012: ¿Cómo me llega una fotomulta? | 0.592 / 0.160 | ninguna pregunta verificada cita esos artículos |
| BE-026 | problema vehiculo arreglar igual llevan inmovilizar | PV-020: ¿Me pueden inmovilizar el carro? | 0.553 / 0.302 | PV-020 en el lugar 1 (0.553) |
| BE-027 | inmovilizar autorizado dejar salir vehiculo orden autoridad | PV-020: ¿Me pueden inmovilizar el carro? | 0.757 / 0.522 | PV-020 en el lugar 1 (0.757) |
| BE-028 | cuanto tiempo queda inmovilizar vehiculo | PV-020: ¿Me pueden inmovilizar el carro? | 0.766 / 0.033 | PV-020 en el lugar 1 (0.766) |
| BE-029 | consecuencia agente impedir uno grabar | PV-003: ¿Me pueden prohibir que grabe el procedimiento? | 0.604 / 0.323 | PV-003 en el lugar 1 (0.604) |
| BE-030 | choco comprueba causa deficiencia fisica salud sancion | PV-029: ¿Qué es la caducidad de un comparendo? | 0.121 / 0.121 | ninguna pregunta verificada cita esos artículos |
| BE-031 | testigo firma comparendo dato | PV-040: ¿Qué pasa si no quiero firmar el comparendo? | 0.789 / 0.319 | PV-040 en el lugar 1 (0.789) |
| BE-032 | papel dieron falta numero placa agente debia tenerlo | PV-001: ¿Qué hago si me para un agente de tránsito y me pone un comparendo? | 0.351 / 0.116 | PV-041 en el lugar 2 (0.235) |
| BE-033 | cuanto cobran dejar vehiculo estacionado donde | PV-033: ¿Cuánto vale una multa de tránsito? | 0.570 / 0.161 | PV-033 en el lugar 1 (0.570) |
| BE-034 | cuanto comparendo llevar nieto ocho anos silla adelante | PV-035: ¿Cuánto es la multa por manejar sin llevar la licencia? | 0.514 / 0.045 | PV-035 en el lugar 1 (0.514) |
| BE-035 | comparendo quedo ejecutoriada 2022 pasan unidad nueva empezo 2024 | PV-034: ¿Las multas se cobran en salarios mínimos o en UVB? | 0.381 / 0.142 | PV-034 en el lugar 1 (0.381) |
| BE-036 | iba rapido parar cuanto comparendo | PV-024: ¿Hay descuento si pago la multa rápido? | 0.584 / 0.131 | PV-033 en el lugar 3 (0.453) |
| BE-037 | diferencia infraccion simple compleja | PV-032: ¿Qué significa el código de mi comparendo? | 0.411 / 0.148 | PV-033 en el lugar 6 (0.000) |
| BE-038 | quien agente dato cuidarlo pierdan vea | PV-041: ¿Qué datos debe tener el comparendo? | 0.336 / 0.010 | PV-047 en el lugar 3 (0.310) |
| BE-039 | entidad quejar aplicacion usa mal dato | PV-046: ¿Qué principios debe cumplir quien usa mis datos personales? | 0.423 / 0.079 | PV-043 en el lugar 4 (0.250) |
| BE-040 | 12 octubre festivo | PV-042: ¿Qué días son festivos en Colombia? | 0.814 / 0.814 | PV-042 en el lugar 1 (0.814) |

### Aciertos con_sustento: pregunta verificada devuelta

El criterio del banco mide el artículo citado, no si la respuesta sencilla contesta todo lo que se preguntó. Esta tabla deja ver qué respuesta recibió cada pregunta, para la revisión humana pendiente.

| Id | Pregunta del banco | Pregunta verificada devuelta | Citas |
|---|---|---|---|

## Cómo se eligieron umbral, margen y pesos

Se eligieron **solo con data/preguntas-verificadas.json y data/calibracion-negativos.json**, sin mirar el banco de evaluación, para no ajustar el resultado a las preguntas con que se mide. El script corre esta calibración en cada ejecución y avisa si lo configurado no coincide con el mínimo.

- Positivos (249): cada formulación (pregunta principal y cada variante) se busca en el índice sin esa formulación (deja una fuera). Acierta si la pregunta ganadora cita al menos un artículo de la pregunta original, el mismo criterio del banco.
- Negativos sin artículo (249): cada formulación se busca en el índice sin ninguna pregunta que cite alguno de sus artículos. Simula una pregunta de tránsito sin sustento: lo correcto es abstenerse.
- Control negativo (45): data/calibracion-negativos.json, preguntas escritas por el equipo, de tránsito sin sustento en la base y fuera de tema, distintas a las del banco. Lo correcto es no responder.
- Costo = 2 por cada respuesta equivocada (positivo con cita no pertinente o negativo respondido) + 1 por cada abstención de un positivo. Responder mal pesa el doble porque engaña; abstenerse remite a otra fuente. En empate se elige el umbral más alto y luego el margen más alto.
- Umbrales probados: 0.20 a 0.95 de 0,05 en 0,05. Márgenes probados: 0, 0.02, 0.05, 0.1, 0.15.
- Como referencia, abstenerse siempre cuesta 249.

### Pesos comparados

| Pesos | Positivos con cita pertinente en primer lugar | Umbral | Margen | Costo |
|---|---|---|---|---|
| alfa 0.5, temas 1, respuesta 1, base 1, literal 1, información 0 | 181 de 249 | 0.95 | 0 | 233 |
| alfa 0.5, temas 0.9, respuesta 0.8, base 0.8, literal 0.8, información 0 | 181 de 249 | 0.95 | 0 | 226 |
| alfa 0.5, temas 0.8, respuesta 0.6, base 0.6, literal 0.6, información 0 | 181 de 249 | 0.85 | 0 | 225 |
| alfa 0.5, temas 0.8, respuesta 0.6, base 0.4, literal 0.3, información 0 | 185 de 249 | 0.80 | 0.1 | 219 |
| alfa 0.5, temas 0.6, respuesta 0.5, base 0.4, literal 0.3, información 0 | 183 de 249 | 0.75 | 0.1 | 219 |
| alfa 0.5, temas 0.5, respuesta 0.3, base 0.2, literal 0.1, información 0 | 184 de 249 | 0.75 | 0.15 | 220 |
| alfa 0.5, temas 0.5, respuesta 0.3, base 0.2, literal 0, información 0 | 185 de 249 | 0.75 | 0 | 219 |
| alfa 0.5, temas 0, respuesta 0, base 0, literal 0, información 0 | 181 de 249 | 0.75 | 0.1 | 221 |
| alfa 0.6, temas 1, respuesta 1, base 1, literal 1, información 0 | 181 de 249 | 0.95 | 0 | 236 |
| alfa 0.6, temas 0.9, respuesta 0.8, base 0.8, literal 0.8, información 0 | 185 de 249 | 0.95 | 0 | 229 |
| alfa 0.6, temas 0.8, respuesta 0.6, base 0.6, literal 0.6, información 0 | 182 de 249 | 0.85 | 0 | 220 |
| alfa 0.6, temas 0.8, respuesta 0.6, base 0.4, literal 0.3, información 0 | 189 de 249 | 0.80 | 0 | 224 |
| alfa 0.6, temas 0.6, respuesta 0.5, base 0.4, literal 0.3, información 0 | 190 de 249 | 0.80 | 0 | 217 |
| alfa 0.6, temas 0.5, respuesta 0.3, base 0.2, literal 0.1, información 0 | 185 de 249 | 0.80 | 0 | 222 |
| alfa 0.6, temas 0.5, respuesta 0.3, base 0.2, literal 0, información 0 | 186 de 249 | 0.80 | 0 | 222 |
| alfa 0.6, temas 0, respuesta 0, base 0, literal 0, información 0 | 177 de 249 | 0.80 | 0.1 | 225 |
| alfa 0.7, temas 1, respuesta 1, base 1, literal 1, información 0 | 186 de 249 | 0.95 | 0 | 235 |
| alfa 0.7, temas 0.9, respuesta 0.8, base 0.8, literal 0.8, información 0 | 187 de 249 | 0.90 | 0 | 227 |
| alfa 0.7, temas 0.8, respuesta 0.6, base 0.6, literal 0.6, información 0 | 187 de 249 | 0.85 | 0 | 209 |
| alfa 0.7, temas 0.8, respuesta 0.6, base 0.4, literal 0.3, información 0 | 191 de 249 | 0.85 | 0 | 214 |
| alfa 0.7, temas 0.6, respuesta 0.5, base 0.4, literal 0.3, información 0 | 190 de 249 | 0.85 | 0 | 220 |
| alfa 0.7, temas 0.5, respuesta 0.3, base 0.2, literal 0.1, información 0 | 187 de 249 | 0.85 | 0 | 225 |
| alfa 0.7, temas 0.5, respuesta 0.3, base 0.2, literal 0, información 0 | 187 de 249 | 0.85 | 0 | 225 |
| alfa 0.7, temas 0, respuesta 0, base 0, literal 0, información 0 | 176 de 249 | 0.85 | 0 | 227 |
| alfa 0.8, temas 1, respuesta 1, base 1, literal 1, información 0 | 184 de 249 | 0.95 | 0 | 242 |
| alfa 0.8, temas 0.9, respuesta 0.8, base 0.8, literal 0.8, información 0 | 188 de 249 | 0.90 | 0 | 213 |
| alfa 0.8, temas 0.8, respuesta 0.6, base 0.6, literal 0.6, información 0 | 190 de 249 | 0.90 | 0 | 222 |
| alfa 0.8, temas 0.8, respuesta 0.6, base 0.4, literal 0.3, información 0 | 190 de 249 | 0.90 | 0 | 218 |
| alfa 0.8, temas 0.6, respuesta 0.5, base 0.4, literal 0.3, información 0 | 188 de 249 | 0.90 | 0 | 224 |
| alfa 0.8, temas 0.5, respuesta 0.3, base 0.2, literal 0.1, información 0 | 184 de 249 | 0.90 | 0 | 225 |
| alfa 0.8, temas 0.5, respuesta 0.3, base 0.2, literal 0, información 0 | 183 de 249 | 0.90 | 0 | 225 |
| alfa 0.8, temas 0, respuesta 0, base 0, literal 0, información 0 | 174 de 249 | 0.90 | 0 | 226 |
| alfa 1, temas 1, respuesta 1, base 1, literal 1, información 0 | 185 de 249 | 0.95 | 0.15 | 282 |
| alfa 1, temas 0.9, respuesta 0.8, base 0.8, literal 0.8, información 0 | 184 de 249 | 0.95 | 0.05 | 250 |
| alfa 1, temas 0.8, respuesta 0.6, base 0.6, literal 0.6, información 0 | 188 de 249 | 0.95 | 0.15 | 244 |
| alfa 1, temas 0.8, respuesta 0.6, base 0.4, literal 0.3, información 0 | 191 de 249 | 0.95 | 0.15 | 240 |
| alfa 1, temas 0.6, respuesta 0.5, base 0.4, literal 0.3, información 0 | 190 de 249 | 0.95 | 0.15 | 240 |
| alfa 1, temas 0.5, respuesta 0.3, base 0.2, literal 0.1, información 0 | 190 de 249 | 0.90 | 0.15 | 241 |
| alfa 1, temas 0.5, respuesta 0.3, base 0.2, literal 0, información 0 | 188 de 249 | 0.90 | 0.15 | 241 |
| alfa 1, temas 0, respuesta 0, base 0, literal 0, información 0 | 186 de 249 | 0.85 | 0.15 | 240 |
| alfa 0.5, temas 1, respuesta 1, base 1, literal 1, información 1 | 181 de 249 | 0.95 | 0 | 233 |
| alfa 0.5, temas 0.9, respuesta 0.8, base 0.8, literal 0.8, información 1 | 181 de 249 | 0.95 | 0 | 222 |
| alfa 0.5, temas 0.8, respuesta 0.6, base 0.6, literal 0.6, información 1 | 181 de 249 | 0.85 | 0 | 217 |
| alfa 0.5, temas 0.8, respuesta 0.6, base 0.4, literal 0.3, información 1 | 185 de 249 | 0.80 | 0 | 217 |
| alfa 0.5, temas 0.6, respuesta 0.5, base 0.4, literal 0.3, información 1 | 183 de 249 | 0.80 | 0 | 216 |
| alfa 0.5, temas 0.5, respuesta 0.3, base 0.2, literal 0.1, información 1 | 184 de 249 | 0.80 | 0 | 223 |
| alfa 0.5, temas 0.5, respuesta 0.3, base 0.2, literal 0, información 1 | 185 de 249 | 0.80 | 0 | 224 |
| alfa 0.5, temas 0, respuesta 0, base 0, literal 0, información 1 | 181 de 249 | 0.75 | 0.1 | 224 |
| alfa 0.6, temas 1, respuesta 1, base 1, literal 1, información 1 | 181 de 249 | 0.95 | 0 | 236 |
| alfa 0.6, temas 0.9, respuesta 0.8, base 0.8, literal 0.8, información 1 | 185 de 249 | 0.90 | 0 | 216 |
| alfa 0.6, temas 0.8, respuesta 0.6, base 0.6, literal 0.6, información 1 | 182 de 249 | 0.85 | 0 | 221 |
| alfa 0.6, temas 0.8, respuesta 0.6, base 0.4, literal 0.3, información 1 | 189 de 249 | 0.80 | 0 | 221 |
| alfa 0.6, temas 0.6, respuesta 0.5, base 0.4, literal 0.3, información 1 | 190 de 249 | 0.80 | 0 | 217 |
| alfa 0.6, temas 0.5, respuesta 0.3, base 0.2, literal 0.1, información 1 | 185 de 249 | 0.80 | 0 | 225 |
| alfa 0.6, temas 0.5, respuesta 0.3, base 0.2, literal 0, información 1 | 186 de 249 | 0.80 | 0 | 225 |
| alfa 0.6, temas 0, respuesta 0, base 0, literal 0, información 1 | 177 de 249 | 0.75 | 0.1 | 230 |
| alfa 0.7, temas 1, respuesta 1, base 1, literal 1, información 1 | 186 de 249 | 0.95 | 0 | 235 |
| alfa 0.7, temas 0.9, respuesta 0.8, base 0.8, literal 0.8, información 1 | 187 de 249 | 0.90 | 0 | 216 |
| alfa 0.7, temas 0.8, respuesta 0.6, base 0.6, literal 0.6, información 1 (elegidos) | 187 de 249 | 0.85 | 0 | 208 |
| alfa 0.7, temas 0.8, respuesta 0.6, base 0.4, literal 0.3, información 1 | 191 de 249 | 0.85 | 0 | 217 |
| alfa 0.7, temas 0.6, respuesta 0.5, base 0.4, literal 0.3, información 1 | 190 de 249 | 0.85 | 0 | 225 |
| alfa 0.7, temas 0.5, respuesta 0.3, base 0.2, literal 0.1, información 1 | 187 de 249 | 0.85 | 0 | 230 |
| alfa 0.7, temas 0.5, respuesta 0.3, base 0.2, literal 0, información 1 | 187 de 249 | 0.85 | 0 | 230 |
| alfa 0.7, temas 0, respuesta 0, base 0, literal 0, información 1 | 176 de 249 | 0.85 | 0 | 232 |
| alfa 0.8, temas 1, respuesta 1, base 1, literal 1, información 1 | 184 de 249 | 0.95 | 0 | 243 |
| alfa 0.8, temas 0.9, respuesta 0.8, base 0.8, literal 0.8, información 1 | 188 de 249 | 0.90 | 0 | 213 |
| alfa 0.8, temas 0.8, respuesta 0.6, base 0.6, literal 0.6, información 1 | 190 de 249 | 0.90 | 0 | 229 |
| alfa 0.8, temas 0.8, respuesta 0.6, base 0.4, literal 0.3, información 1 | 190 de 249 | 0.90 | 0 | 225 |
| alfa 0.8, temas 0.6, respuesta 0.5, base 0.4, literal 0.3, información 1 | 188 de 249 | 0.90 | 0 | 230 |
| alfa 0.8, temas 0.5, respuesta 0.3, base 0.2, literal 0.1, información 1 | 184 de 249 | 0.90 | 0 | 231 |
| alfa 0.8, temas 0.5, respuesta 0.3, base 0.2, literal 0, información 1 | 183 de 249 | 0.90 | 0 | 231 |
| alfa 0.8, temas 0, respuesta 0, base 0, literal 0, información 1 | 174 de 249 | 0.90 | 0 | 232 |
| alfa 1, temas 1, respuesta 1, base 1, literal 1, información 1 | 181 de 249 | 0.90 | 0.15 | 286 |
| alfa 1, temas 0.9, respuesta 0.8, base 0.8, literal 0.8, información 1 | 183 de 249 | 0.95 | 0 | 247 |
| alfa 1, temas 0.8, respuesta 0.6, base 0.6, literal 0.6, información 1 | 187 de 249 | 0.95 | 0 | 246 |
| alfa 1, temas 0.8, respuesta 0.6, base 0.4, literal 0.3, información 1 | 190 de 249 | 0.85 | 0 | 240 |
| alfa 1, temas 0.6, respuesta 0.5, base 0.4, literal 0.3, información 1 | 189 de 249 | 0.95 | 0 | 241 |
| alfa 1, temas 0.5, respuesta 0.3, base 0.2, literal 0.1, información 1 | 189 de 249 | 0.95 | 0 | 242 |
| alfa 1, temas 0.5, respuesta 0.3, base 0.2, literal 0, información 1 | 187 de 249 | 0.95 | 0 | 242 |
| alfa 1, temas 0, respuesta 0, base 0, literal 0, información 1 | 185 de 249 | 0.95 | 0 | 242 |
| alfa 0.5, temas 1, respuesta 1, base 1, literal 1, información 1.5 | 181 de 249 | 0.95 | 0 | 234 |
| alfa 0.5, temas 0.9, respuesta 0.8, base 0.8, literal 0.8, información 1.5 | 181 de 249 | 0.90 | 0 | 225 |
| alfa 0.5, temas 0.8, respuesta 0.6, base 0.6, literal 0.6, información 1.5 | 181 de 249 | 0.85 | 0.05 | 221 |
| alfa 0.5, temas 0.8, respuesta 0.6, base 0.4, literal 0.3, información 1.5 | 185 de 249 | 0.80 | 0 | 223 |
| alfa 0.5, temas 0.6, respuesta 0.5, base 0.4, literal 0.3, información 1.5 | 183 de 249 | 0.75 | 0.1 | 224 |
| alfa 0.5, temas 0.5, respuesta 0.3, base 0.2, literal 0.1, información 1.5 | 184 de 249 | 0.75 | 0 | 222 |
| alfa 0.5, temas 0.5, respuesta 0.3, base 0.2, literal 0, información 1.5 | 185 de 249 | 0.75 | 0 | 220 |
| alfa 0.5, temas 0, respuesta 0, base 0, literal 0, información 1.5 | 181 de 249 | 0.75 | 0.1 | 231 |
| alfa 0.6, temas 1, respuesta 1, base 1, literal 1, información 1.5 | 181 de 249 | 0.95 | 0 | 237 |
| alfa 0.6, temas 0.9, respuesta 0.8, base 0.8, literal 0.8, información 1.5 | 185 de 249 | 0.90 | 0 | 220 |
| alfa 0.6, temas 0.8, respuesta 0.6, base 0.6, literal 0.6, información 1.5 | 182 de 249 | 0.80 | 0 | 222 |
| alfa 0.6, temas 0.8, respuesta 0.6, base 0.4, literal 0.3, información 1.5 | 189 de 249 | 0.80 | 0 | 224 |
| alfa 0.6, temas 0.6, respuesta 0.5, base 0.4, literal 0.3, información 1.5 | 190 de 249 | 0.80 | 0 | 222 |
| alfa 0.6, temas 0.5, respuesta 0.3, base 0.2, literal 0.1, información 1.5 | 185 de 249 | 0.75 | 0 | 230 |
| alfa 0.6, temas 0.5, respuesta 0.3, base 0.2, literal 0, información 1.5 | 186 de 249 | 0.75 | 0 | 231 |
| alfa 0.6, temas 0, respuesta 0, base 0, literal 0, información 1.5 | 177 de 249 | 0.85 | 0 | 235 |
| alfa 0.7, temas 1, respuesta 1, base 1, literal 1, información 1.5 | 186 de 249 | 0.95 | 0 | 236 |
| alfa 0.7, temas 0.9, respuesta 0.8, base 0.8, literal 0.8, información 1.5 | 187 de 249 | 0.90 | 0 | 224 |
| alfa 0.7, temas 0.8, respuesta 0.6, base 0.6, literal 0.6, información 1.5 | 187 de 249 | 0.85 | 0 | 221 |
| alfa 0.7, temas 0.8, respuesta 0.6, base 0.4, literal 0.3, información 1.5 | 191 de 249 | 0.80 | 0 | 225 |
| alfa 0.7, temas 0.6, respuesta 0.5, base 0.4, literal 0.3, información 1.5 | 190 de 249 | 0.80 | 0 | 226 |
| alfa 0.7, temas 0.5, respuesta 0.3, base 0.2, literal 0.1, información 1.5 | 187 de 249 | 0.80 | 0 | 232 |
| alfa 0.7, temas 0.5, respuesta 0.3, base 0.2, literal 0, información 1.5 | 187 de 249 | 0.80 | 0 | 233 |
| alfa 0.7, temas 0, respuesta 0, base 0, literal 0, información 1.5 | 176 de 249 | 0.75 | 0 | 235 |
| alfa 0.8, temas 1, respuesta 1, base 1, literal 1, información 1.5 | 184 de 249 | 0.95 | 0 | 241 |
| alfa 0.8, temas 0.9, respuesta 0.8, base 0.8, literal 0.8, información 1.5 | 188 de 249 | 0.90 | 0 | 218 |
| alfa 0.8, temas 0.8, respuesta 0.6, base 0.6, literal 0.6, información 1.5 | 190 de 249 | 0.85 | 0 | 229 |
| alfa 0.8, temas 0.8, respuesta 0.6, base 0.4, literal 0.3, información 1.5 | 190 de 249 | 0.90 | 0 | 230 |
| alfa 0.8, temas 0.6, respuesta 0.5, base 0.4, literal 0.3, información 1.5 | 188 de 249 | 0.90 | 0 | 234 |
| alfa 0.8, temas 0.5, respuesta 0.3, base 0.2, literal 0.1, información 1.5 | 184 de 249 | 0.85 | 0.15 | 232 |
| alfa 0.8, temas 0.5, respuesta 0.3, base 0.2, literal 0, información 1.5 | 183 de 249 | 0.85 | 0.15 | 232 |
| alfa 0.8, temas 0, respuesta 0, base 0, literal 0, información 1.5 | 174 de 249 | 0.90 | 0 | 235 |
| alfa 1, temas 1, respuesta 1, base 1, literal 1, información 1.5 | 182 de 249 | 0.90 | 0.15 | 274 |
| alfa 1, temas 0.9, respuesta 0.8, base 0.8, literal 0.8, información 1.5 | 183 de 249 | 0.95 | 0 | 237 |
| alfa 1, temas 0.8, respuesta 0.6, base 0.6, literal 0.6, información 1.5 | 187 de 249 | 0.85 | 0 | 233 |
| alfa 1, temas 0.8, respuesta 0.6, base 0.4, literal 0.3, información 1.5 | 190 de 249 | 0.85 | 0 | 231 |
| alfa 1, temas 0.6, respuesta 0.5, base 0.4, literal 0.3, información 1.5 | 189 de 249 | 0.95 | 0 | 234 |
| alfa 1, temas 0.5, respuesta 0.3, base 0.2, literal 0.1, información 1.5 | 189 de 249 | 0.80 | 0 | 234 |
| alfa 1, temas 0.5, respuesta 0.3, base 0.2, literal 0, información 1.5 | 187 de 249 | 0.80 | 0 | 234 |
| alfa 1, temas 0, respuesta 0, base 0, literal 0, información 1.5 | 185 de 249 | 0.90 | 0 | 233 |

### Curva del umbral con los pesos elegidos y margen 0

| Umbral | Positivos con cita pertinente | Positivos con cita no pertinente | Positivos abstenidos | Negativos sin artículo respondidos | Control respondidos | Costo |
|---|---|---|---|---|---|---|
| 0.20 | 187 | 58 | 4 | 229 | 30 | 638 |
| 0.25 | 186 | 58 | 5 | 225 | 29 | 629 |
| 0.30 | 184 | 58 | 7 | 222 | 28 | 623 |
| 0.35 | 183 | 58 | 8 | 216 | 23 | 602 |
| 0.40 | 180 | 56 | 13 | 188 | 20 | 541 |
| 0.45 | 177 | 53 | 19 | 170 | 17 | 499 |
| 0.50 | 176 | 52 | 21 | 156 | 13 | 463 |
| 0.55 | 165 | 47 | 37 | 125 | 7 | 395 |
| 0.60 | 155 | 37 | 57 | 96 | 5 | 333 |
| 0.65 | 139 | 32 | 78 | 69 | 2 | 284 |
| 0.70 | 127 | 27 | 95 | 57 | 1 | 265 |
| 0.75 | 112 | 23 | 114 | 49 | 0 | 258 |
| 0.80 | 94 | 13 | 142 | 30 | 0 | 228 |
| 0.85 (mínimo) | 73 | 6 | 170 | 13 | 0 | 208 |
| 0.90 | 45 | 6 | 198 | 13 | 0 | 236 |
| 0.95 | 28 | 3 | 218 | 6 | 0 | 236 |

Mínimo de la calibración: umbral **0.85**, margen **0**. Configurado en src/core/ProveedorVerificado.ts: umbral **0.85**, margen **0**.

Limitaciones de la calibración:
- Las variantes de las preguntas verificadas son cortas y coloquiales; las preguntas reales suelen ser más largas y usar palabras del texto de la norma. Por eso un umbral alto en la calibración deja sin responder muchas preguntas largas del banco.
- Los negativos sin artículo son difíciles a propósito: quitan la pregunta correcta pero dejan otras muy parecidas del mismo tema (por ejemplo, plazos del comparendo frente a plazos de la fotomulta). Empujan el umbral hacia arriba, y ese es el costo de no responder con una norma equivocada.
- El mínimo de costo queda poco por debajo del de abstenerse siempre: con búsqueda por palabras, la separación entre preguntas con y sin sustento es débil. Es la razón principal de que RNF-03 no se cumpla.
- En la calibración cada formulación se busca sin ella misma. En la app están todas, así que una pregunta dicha igual que una formulación conocida obtiene puntaje alto.

## Sensibilidad al umbral en el banco (solo informativa)

Esta tabla se generó **después** de fijar umbral, margen y pesos con la calibración, y no se usó para cambiarlos. Muestra qué habría pasado en el banco con otros umbrales (margen 0).

| Umbral | Con sustento: cita pertinente | Con sustento: cita no pertinente | Sin sustento: respondidas (error) |
|---|---|---|---|
| 0.20 | 24 | 14 | 10 |
| 0.25 | 24 | 14 | 9 |
| 0.30 | 24 | 14 | 9 |
| 0.35 | 24 | 13 | 9 |
| 0.40 | 21 | 12 | 8 |
| 0.45 | 21 | 8 | 7 |
| 0.50 | 19 | 6 | 7 |
| 0.55 | 17 | 5 | 5 |
| 0.60 | 13 | 1 | 3 |
| 0.65 | 10 | 1 | 2 |
| 0.70 | 8 | 0 | 1 |
| 0.75 | 5 | 0 | 1 |
| 0.80 | 2 | 0 | 1 |
| 0.85 (configurado) | 0 | 0 | 0 |
| 0.90 | 0 | 0 | 0 |
| 0.95 | 0 | 0 | 0 |

