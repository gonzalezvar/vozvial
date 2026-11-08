# Evaluación del asistente

Archivo generado por `npm run eval:asistente` (scripts/eval-asistente.ts). No editar a mano.

- Fecha de ejecución: 2026-11-08
- Modo evaluado: verificado (MiniSearch sobre data/preguntas-verificadas.json). El modo LLM no se evaluó.
- Umbral usado: 0.85
- Preguntas verificadas indexadas: 45 (descartadas por no tener cita verificada: 0)
- Banco: 60 preguntas (40 con_sustento, 10 sin_sustento, 10 fuera_de_tema).
- Las preguntas del banco las construyó el equipo con asistencia de IA y su calificación humana está pendiente (campo `calificada_por` del banco).

Criterios de acierto:
- con_sustento: tipo `respuesta` y al menos una cita dentro de `articulos_esperados`. Citar un artículo que existe pero no es el pertinente cuenta como error.
- sin_sustento: tipo `abstencion`.
- fuera_de_tema: tipo `fuera_de_tema`.
- Los tiempos son por pregunta, medidos con `performance.now()`; en proceso no incluyen red.

## Resultados en proceso

| Métrica | Resultado | Detalle |
|---|---|---|
| Citas pertinentes (con_sustento) | 0.0 % | 0 de 40 respondieron y citaron al menos un artículo esperado |
| Falsas abstenciones (con_sustento) | 97.5 % | 39 de 40 |
| Respuestas con cita no pertinente (con_sustento) | 0.0 % | 0 de 40 |
| Con sustento marcadas fuera de tema | 2.5 % | 1 de 40 |
| Abstenciones correctas (sin_sustento) | 100.0 % | 10 de 10; respondieron sin sustento: 0 |
| Fuera de tema correctos | 100.0 % | 10 de 10 |
| Respuestas tipo "respuesta" con al menos una cita | n/a | 0 de 0 |
| Tiempo por pregunta p50 | 1.07 ms | |
| Tiempo por pregunta p95 | 2.45 ms | |

### Errores (40 de 60)

| Id | Tipo | Pregunta | Esperado | Obtenido | Puntaje | Error |
|---|---|---|---|---|---|---|
| BE-001 | con_sustento | Firmé el comparendo esta mañana, ¿desde cuándo empiezan a correr los días para ir al tránsito? | respuesta citando L769-2002-art136 o L769-2002-art135 | abstención | 0.521 | falsa abstención |
| BE-002 | con_sustento | En la audiencia, ¿el funcionario puede pedir pruebas por su cuenta aunque yo no las pida? | respuesta citando L769-2002-art136 | abstención | 0.444 | falsa abstención |
| BE-003 | con_sustento | ¿Puedo pagar la multa de tránsito en un banco? | respuesta citando L769-2002-art136 | abstención | 0.453 | falsa abstención |
| BE-004 | con_sustento | ¿El Ministerio Público puede intervenir en mi proceso de tránsito? | respuesta citando L769-2002-art138 | abstención | 0.329 | falsa abstención |
| BE-005 | con_sustento | Si en el comparendo está involucrado un menor de edad, ¿tiene que ir acompañado? | respuesta citando L769-2002-art138 | abstención | 0.319 | falsa abstención |
| BE-006 | con_sustento | El carro es mío pero lo manejaba mi hijo cuando lo cogió la cámara, ¿a quién le mandan el comparendo? | respuesta citando L1843-2017-art8 o L769-2002-art137 | abstención | 0.311 | falsa abstención |
| BE-007 | con_sustento | Si no encuentran al dueño en la dirección del RUNT, ¿cómo le notifican la fotomulta? | respuesta citando L1843-2017-art8 | abstención | 0.481 | falsa abstención |
| BE-008 | con_sustento | ¿Qué datos debo tener al día en el RUNT para que me lleguen las notificaciones? | respuesta citando L1843-2017-art8 | abstención | 0.514 | falsa abstención |
| BE-009 | con_sustento | ¿Qué cuenta como sistema de fotodetección según la ley? | respuesta citando L1843-2017-art1 | abstención | 0.543 | falsa abstención |
| BE-010 | con_sustento | En una carretera nacional, ¿a cuántos metros antes del radar debe estar la señal? | respuesta citando L1843-2017-art10 | abstención | 0.412 | falsa abstención |
| BE-011 | con_sustento | ¿Qué normas se aplican a lo que la ley de fotomultas no regula? | respuesta citando L1843-2017-art9 | abstención | 0.225 | falsa abstención |
| BE-012 | con_sustento | Si demuestro que la notificación de la cámara fue a parar a otra parte, ¿desde qué fecha corre la rebaja? | respuesta citando L1843-2017-art7 o L769-2002-art136 | abstención | 0.514 | falsa abstención |
| BE-013 | con_sustento | Si la multa es por cámara, ¿la prueba tiene que venir junto con el comparendo? | respuesta citando L769-2002-art137 | abstención | 0.391 | falsa abstención |
| BE-014 | con_sustento | ¿Los cursos para infractores deben enseñar a respetar a los ciclistas? | respuesta citando L769-2002-art136 | abstención | 0.278 | falsa abstención |
| BE-015 | con_sustento | ¿Hasta cuántos días tengo para pagar solo el setenta y cinco por ciento? | respuesta citando L769-2002-art136 | abstención | 0.457 | falsa abstención |
| BE-016 | con_sustento | Si hago el curso en un municipio distinto al de la multa, ¿a quién le pago? | respuesta citando L769-2002-art136 | abstención | 0.337 | falsa abstención |
| BE-017 | con_sustento | ¿Me pueden sancionar ahí mismo en la calle, sin ir a una oficina? | respuesta citando L769-2002-art136 | abstención | 0.383 | falsa abstención |
| BE-018 | con_sustento | Si en la audiencia me declaran contraventor, ¿pago la multa completa? | respuesta citando L769-2002-art136 | abstención | 0.415 | falsa abstención |
| BE-019 | con_sustento | Tengo una multa de hace cuatro años que nunca me cobraron, ¿sigue vigente? | respuesta citando L769-2002-art159 | abstención | 0.352 | falsa abstención |
| BE-020 | con_sustento | ¿Qué interrumpe la prescripción de una sanción de tránsito? | respuesta citando L769-2002-art159 | abstención | 0.613 | falsa abstención |
| BE-021 | con_sustento | Me pusieron el comparendo hace más de un año y nunca decidieron nada, ¿qué pasa con eso? | respuesta citando L769-2002-art161 o L1843-2017-art11 | abstención | 0.246 | falsa abstención |
| BE-022 | con_sustento | ¿Qué es la revocación directa en un proceso de tránsito? | respuesta citando L769-2002-art161 o L1843-2017-art11 | abstención | 0.394 | falsa abstención |
| BE-023 | con_sustento | ¿Cuándo queda en firme lo que decidió el inspector? | respuesta citando L769-2002-art142 | abstención | 0.377 | falsa abstención |
| BE-024 | con_sustento | ¿En qué momento tengo que sustentar la reposición? | respuesta citando L769-2002-art142 | abstención | 0.504 | falsa abstención |
| BE-025 | con_sustento | ¿Cómo me entero de lo que decidan dentro del proceso? | respuesta citando L769-2002-art139 | fuera de tema | 0.000 | marcada fuera de tema |
| BE-026 | con_sustento | Si el problema del carro se puede arreglar ahí mismo, ¿igual se lo llevan al parqueadero? | respuesta citando L769-2002-art125 | abstención | 0.507 | falsa abstención |
| BE-027 | con_sustento | ¿El parqueadero autorizado puede dejar salir mi carro sin orden de la autoridad? | respuesta citando L769-2002-art125 | abstención | 0.489 | falsa abstención |
| BE-028 | con_sustento | ¿Por cuánto tiempo queda inmovilizado un vehículo? | respuesta citando L769-2002-art125 o L769-2002-art2 | abstención | 0.625 | falsa abstención |
| BE-029 | con_sustento | ¿Qué consecuencia tiene para un policía impedir que uno lo grabe? | respuesta citando L1801-2016-art21 | abstención | 0.526 | falsa abstención |
| BE-030 | con_sustento | Si choco y se comprueba que la causa fue una deficiencia física o de salud que yo tenía, ¿qué sanción me pueden poner? | respuesta citando L769-2002-art157 | abstención | 0.150 | falsa abstención |
| BE-031 | con_sustento | ¿El testigo que firma el comparendo por mí qué datos tiene que dar? | respuesta citando L769-2002-art135 | abstención | 0.704 | falsa abstención |
| BE-032 | con_sustento | Al papel que me dieron le falta el número de placa del agente, ¿debía tenerlo? | respuesta citando L769-2002-art129 | abstención | 0.267 | falsa abstención |
| BE-033 | con_sustento | ¿Cuánto me cobran por dejar el carro estacionado donde no se puede? | respuesta citando L769-2002-art131 | abstención | 0.304 | falsa abstención |
| BE-034 | con_sustento | ¿Cuánto es la multa por llevar a mi nieto de ocho años en la silla de adelante? | respuesta citando L769-2002-art131 | abstención | 0.329 | falsa abstención |
| BE-035 | con_sustento | Mi multa quedó ejecutoriada en 2022 y todavía la debo, ¿me la pasan a la unidad nueva que empezó en 2024? | respuesta citando L2294-2023-art313 | abstención | 0.196 | falsa abstención |
| BE-036 | con_sustento | Iba muy rápido y me pararon, ¿de cuánto es el comparendo por eso? | respuesta citando L769-2002-art131 | abstención | 0.449 | falsa abstención |
| BE-037 | con_sustento | ¿Qué diferencia hay entre una infracción simple y una compleja? | respuesta citando L769-2002-art2 | abstención | 0.223 | falsa abstención |
| BE-038 | con_sustento | ¿Quien guarda mis datos tiene que cuidarlos para que no se pierdan ni los vea cualquiera? | respuesta citando L1581-2012-art17 o L1581-2012-art4 | abstención | 0.297 | falsa abstención |
| BE-039 | con_sustento | ¿Ante qué entidad me puedo quejar si una aplicación usa mal mis datos? | respuesta citando L1581-2012-art8 | abstención | 0.227 | falsa abstención |
| BE-040 | con_sustento | ¿El 12 de octubre se corre para el lunes? | respuesta citando L51-1983-art1 | abstención | 0.644 | falsa abstención |

### Detalle de todas las preguntas

| Id | Tipo | Obtenido | Pregunta verificada usada | Citas | Puntaje | ms | Acierto |
|---|---|---|---|---|---|---|---|
| BE-001 | con_sustento | abstencion | - | - | 0.521 | 3.15 | No |
| BE-002 | con_sustento | abstencion | - | - | 0.444 | 1.77 | No |
| BE-003 | con_sustento | abstencion | - | - | 0.453 | 1.03 | No |
| BE-004 | con_sustento | abstencion | - | - | 0.329 | 1.43 | No |
| BE-005 | con_sustento | abstencion | - | - | 0.319 | 1.22 | No |
| BE-006 | con_sustento | abstencion | - | - | 0.311 | 3.05 | No |
| BE-007 | con_sustento | abstencion | - | - | 0.481 | 1.24 | No |
| BE-008 | con_sustento | abstencion | - | - | 0.514 | 0.89 | No |
| BE-009 | con_sustento | abstencion | - | - | 0.543 | 1.15 | No |
| BE-010 | con_sustento | abstencion | - | - | 0.412 | 1.22 | No |
| BE-011 | con_sustento | abstencion | - | - | 0.225 | 2.26 | No |
| BE-012 | con_sustento | abstencion | - | - | 0.514 | 2.45 | No |
| BE-013 | con_sustento | abstencion | - | - | 0.391 | 1.29 | No |
| BE-014 | con_sustento | abstencion | - | - | 0.278 | 0.73 | No |
| BE-015 | con_sustento | abstencion | - | - | 0.457 | 1.37 | No |
| BE-016 | con_sustento | abstencion | - | - | 0.337 | 1.55 | No |
| BE-017 | con_sustento | abstencion | - | - | 0.383 | 0.66 | No |
| BE-018 | con_sustento | abstencion | - | - | 0.415 | 1.70 | No |
| BE-019 | con_sustento | abstencion | - | - | 0.352 | 1.52 | No |
| BE-020 | con_sustento | abstencion | - | - | 0.613 | 1.18 | No |
| BE-021 | con_sustento | abstencion | - | - | 0.246 | 0.88 | No |
| BE-022 | con_sustento | abstencion | - | - | 0.394 | 1.09 | No |
| BE-023 | con_sustento | abstencion | - | - | 0.377 | 1.56 | No |
| BE-024 | con_sustento | abstencion | - | - | 0.504 | 0.20 | No |
| BE-025 | con_sustento | fuera_de_tema | - | - | 0.000 | 0.33 | No |
| BE-026 | con_sustento | abstencion | - | - | 0.507 | 1.81 | No |
| BE-027 | con_sustento | abstencion | - | - | 0.489 | 2.71 | No |
| BE-028 | con_sustento | abstencion | - | - | 0.625 | 1.46 | No |
| BE-029 | con_sustento | abstencion | - | - | 0.526 | 0.57 | No |
| BE-030 | con_sustento | abstencion | - | - | 0.150 | 1.33 | No |
| BE-031 | con_sustento | abstencion | - | - | 0.704 | 1.07 | No |
| BE-032 | con_sustento | abstencion | - | - | 0.267 | 0.95 | No |
| BE-033 | con_sustento | abstencion | - | - | 0.304 | 1.32 | No |
| BE-034 | con_sustento | abstencion | - | - | 0.329 | 2.02 | No |
| BE-035 | con_sustento | abstencion | - | - | 0.196 | 2.04 | No |
| BE-036 | con_sustento | abstencion | - | - | 0.449 | 1.31 | No |
| BE-037 | con_sustento | abstencion | - | - | 0.223 | 1.11 | No |
| BE-038 | con_sustento | abstencion | - | - | 0.297 | 0.84 | No |
| BE-039 | con_sustento | abstencion | - | - | 0.227 | 0.80 | No |
| BE-040 | con_sustento | abstencion | - | - | 0.644 | 0.08 | No |
| BE-041 | sin_sustento | abstencion | - | - | 0.250 | 0.49 | Sí |
| BE-042 | sin_sustento | abstencion | - | - | 0.516 | 0.98 | Sí |
| BE-043 | sin_sustento | abstencion | - | - | 0.189 | 1.76 | Sí |
| BE-044 | sin_sustento | abstencion | - | - | 0.359 | 1.00 | Sí |
| BE-045 | sin_sustento | abstencion | - | - | 0.235 | 1.02 | Sí |
| BE-046 | sin_sustento | abstencion | - | - | 0.379 | 1.54 | Sí |
| BE-047 | sin_sustento | abstencion | - | - | 0.308 | 1.00 | Sí |
| BE-048 | sin_sustento | abstencion | - | - | 0.553 | 1.06 | Sí |
| BE-049 | sin_sustento | abstencion | - | - | 0.300 | 1.87 | Sí |
| BE-050 | sin_sustento | abstencion | - | - | 0.441 | 0.85 | Sí |
| BE-051 | fuera_de_tema | fuera_de_tema | - | - | 0.000 | 0.02 | Sí |
| BE-052 | fuera_de_tema | fuera_de_tema | - | - | 0.000 | 0.01 | Sí |
| BE-053 | fuera_de_tema | fuera_de_tema | - | - | 0.000 | 0.01 | Sí |
| BE-054 | fuera_de_tema | fuera_de_tema | - | - | 0.000 | 0.01 | Sí |
| BE-055 | fuera_de_tema | fuera_de_tema | - | - | 0.000 | 0.01 | Sí |
| BE-056 | fuera_de_tema | fuera_de_tema | - | - | 0.000 | 0.02 | Sí |
| BE-057 | fuera_de_tema | fuera_de_tema | - | - | 0.000 | 0.01 | Sí |
| BE-058 | fuera_de_tema | fuera_de_tema | - | - | 0.000 | 0.02 | Sí |
| BE-059 | fuera_de_tema | fuera_de_tema | - | - | 0.000 | 0.01 | Sí |
| BE-060 | fuera_de_tema | fuera_de_tema | - | - | 0.000 | 0.01 | Sí |

## Lectura de los resultados

- El modo verificado solo responde cuando la pregunta se parece mucho a una pregunta verificada o a una de sus variantes; en los demás casos se abstiene. Por diseño nunca devuelve un texto que no sea una respuesta sencilla verificada.
- Las preguntas con_sustento del banco se escribieron distintas a propósito a las preguntas verificadas y a sus variantes, y varias tratan fragmentos de la base que ninguna pregunta verificada responde. El puntaje más alto que obtuvo una de ellas fue 0.704, frente al umbral de 0.85.
- Por eso las falsas abstenciones son el error dominante. Es el error menos dañino (remite a otra fuente), pero es un incumplimiento real de la meta de respuesta y así se reporta.

## Sensibilidad al umbral (solo informativa)

Esta tabla **no** se usó para elegir el umbral. Muestra qué habría pasado en el banco con otros umbrales, para que se vea el costo de la prudencia.

| Umbral | Con sustento: cita pertinente | Con sustento: cita no pertinente | Sin sustento: respondidas (error) |
|---|---|---|---|
| 0.30 | 18 | 12 | 6 |
| 0.35 | 15 | 9 | 5 |
| 0.40 | 15 | 4 | 3 |
| 0.45 | 12 | 3 | 2 |
| 0.50 | 9 | 2 | 2 |
| 0.55 | 4 | 0 | 1 |
| 0.60 | 4 | 0 | 0 |
| 0.65 | 1 | 0 | 0 |
| 0.70 | 1 | 0 | 0 |
| 0.75 | 0 | 0 | 0 |
| 0.80 | 0 | 0 | 0 |
| 0.85 (configurado) | 0 | 0 | 0 |
| 0.90 | 0 | 0 | 0 |
| 0.95 | 0 | 0 | 0 |

## Resultados contra http://localhost:3011/api/asistente

| Métrica | Resultado | Detalle |
|---|---|---|
| Citas pertinentes (con_sustento) | 0.0 % | 0 de 40 respondieron y citaron al menos un artículo esperado |
| Falsas abstenciones (con_sustento) | 97.5 % | 39 de 40 |
| Respuestas con cita no pertinente (con_sustento) | 0.0 % | 0 de 40 |
| Con sustento marcadas fuera de tema | 2.5 % | 1 de 40 |
| Abstenciones correctas (sin_sustento) | 100.0 % | 10 de 10; respondieron sin sustento: 0 |
| Fuera de tema correctos | 100.0 % | 10 de 10 |
| Respuestas tipo "respuesta" con al menos una cita | n/a | 0 de 0 |
| Tiempo por pregunta p50 | 1.52 ms | |
| Tiempo por pregunta p95 | 5.21 ms | |

### Errores (40 de 60)

| Id | Tipo | Pregunta | Esperado | Obtenido | Puntaje | Error |
|---|---|---|---|---|---|---|
| BE-001 | con_sustento | Firmé el comparendo esta mañana, ¿desde cuándo empiezan a correr los días para ir al tránsito? | respuesta citando L769-2002-art136 o L769-2002-art135 | abstención | 0.521 | falsa abstención |
| BE-002 | con_sustento | En la audiencia, ¿el funcionario puede pedir pruebas por su cuenta aunque yo no las pida? | respuesta citando L769-2002-art136 | abstención | 0.444 | falsa abstención |
| BE-003 | con_sustento | ¿Puedo pagar la multa de tránsito en un banco? | respuesta citando L769-2002-art136 | abstención | 0.453 | falsa abstención |
| BE-004 | con_sustento | ¿El Ministerio Público puede intervenir en mi proceso de tránsito? | respuesta citando L769-2002-art138 | abstención | 0.329 | falsa abstención |
| BE-005 | con_sustento | Si en el comparendo está involucrado un menor de edad, ¿tiene que ir acompañado? | respuesta citando L769-2002-art138 | abstención | 0.319 | falsa abstención |
| BE-006 | con_sustento | El carro es mío pero lo manejaba mi hijo cuando lo cogió la cámara, ¿a quién le mandan el comparendo? | respuesta citando L1843-2017-art8 o L769-2002-art137 | abstención | 0.311 | falsa abstención |
| BE-007 | con_sustento | Si no encuentran al dueño en la dirección del RUNT, ¿cómo le notifican la fotomulta? | respuesta citando L1843-2017-art8 | abstención | 0.481 | falsa abstención |
| BE-008 | con_sustento | ¿Qué datos debo tener al día en el RUNT para que me lleguen las notificaciones? | respuesta citando L1843-2017-art8 | abstención | 0.514 | falsa abstención |
| BE-009 | con_sustento | ¿Qué cuenta como sistema de fotodetección según la ley? | respuesta citando L1843-2017-art1 | abstención | 0.543 | falsa abstención |
| BE-010 | con_sustento | En una carretera nacional, ¿a cuántos metros antes del radar debe estar la señal? | respuesta citando L1843-2017-art10 | abstención | 0.412 | falsa abstención |
| BE-011 | con_sustento | ¿Qué normas se aplican a lo que la ley de fotomultas no regula? | respuesta citando L1843-2017-art9 | abstención | 0.225 | falsa abstención |
| BE-012 | con_sustento | Si demuestro que la notificación de la cámara fue a parar a otra parte, ¿desde qué fecha corre la rebaja? | respuesta citando L1843-2017-art7 o L769-2002-art136 | abstención | 0.514 | falsa abstención |
| BE-013 | con_sustento | Si la multa es por cámara, ¿la prueba tiene que venir junto con el comparendo? | respuesta citando L769-2002-art137 | abstención | 0.391 | falsa abstención |
| BE-014 | con_sustento | ¿Los cursos para infractores deben enseñar a respetar a los ciclistas? | respuesta citando L769-2002-art136 | abstención | 0.278 | falsa abstención |
| BE-015 | con_sustento | ¿Hasta cuántos días tengo para pagar solo el setenta y cinco por ciento? | respuesta citando L769-2002-art136 | abstención | 0.457 | falsa abstención |
| BE-016 | con_sustento | Si hago el curso en un municipio distinto al de la multa, ¿a quién le pago? | respuesta citando L769-2002-art136 | abstención | 0.337 | falsa abstención |
| BE-017 | con_sustento | ¿Me pueden sancionar ahí mismo en la calle, sin ir a una oficina? | respuesta citando L769-2002-art136 | abstención | 0.383 | falsa abstención |
| BE-018 | con_sustento | Si en la audiencia me declaran contraventor, ¿pago la multa completa? | respuesta citando L769-2002-art136 | abstención | 0.415 | falsa abstención |
| BE-019 | con_sustento | Tengo una multa de hace cuatro años que nunca me cobraron, ¿sigue vigente? | respuesta citando L769-2002-art159 | abstención | 0.352 | falsa abstención |
| BE-020 | con_sustento | ¿Qué interrumpe la prescripción de una sanción de tránsito? | respuesta citando L769-2002-art159 | abstención | 0.613 | falsa abstención |
| BE-021 | con_sustento | Me pusieron el comparendo hace más de un año y nunca decidieron nada, ¿qué pasa con eso? | respuesta citando L769-2002-art161 o L1843-2017-art11 | abstención | 0.246 | falsa abstención |
| BE-022 | con_sustento | ¿Qué es la revocación directa en un proceso de tránsito? | respuesta citando L769-2002-art161 o L1843-2017-art11 | abstención | 0.394 | falsa abstención |
| BE-023 | con_sustento | ¿Cuándo queda en firme lo que decidió el inspector? | respuesta citando L769-2002-art142 | abstención | 0.377 | falsa abstención |
| BE-024 | con_sustento | ¿En qué momento tengo que sustentar la reposición? | respuesta citando L769-2002-art142 | abstención | 0.504 | falsa abstención |
| BE-025 | con_sustento | ¿Cómo me entero de lo que decidan dentro del proceso? | respuesta citando L769-2002-art139 | fuera de tema | 0.000 | marcada fuera de tema |
| BE-026 | con_sustento | Si el problema del carro se puede arreglar ahí mismo, ¿igual se lo llevan al parqueadero? | respuesta citando L769-2002-art125 | abstención | 0.507 | falsa abstención |
| BE-027 | con_sustento | ¿El parqueadero autorizado puede dejar salir mi carro sin orden de la autoridad? | respuesta citando L769-2002-art125 | abstención | 0.489 | falsa abstención |
| BE-028 | con_sustento | ¿Por cuánto tiempo queda inmovilizado un vehículo? | respuesta citando L769-2002-art125 o L769-2002-art2 | abstención | 0.625 | falsa abstención |
| BE-029 | con_sustento | ¿Qué consecuencia tiene para un policía impedir que uno lo grabe? | respuesta citando L1801-2016-art21 | abstención | 0.526 | falsa abstención |
| BE-030 | con_sustento | Si choco y se comprueba que la causa fue una deficiencia física o de salud que yo tenía, ¿qué sanción me pueden poner? | respuesta citando L769-2002-art157 | abstención | 0.150 | falsa abstención |
| BE-031 | con_sustento | ¿El testigo que firma el comparendo por mí qué datos tiene que dar? | respuesta citando L769-2002-art135 | abstención | 0.704 | falsa abstención |
| BE-032 | con_sustento | Al papel que me dieron le falta el número de placa del agente, ¿debía tenerlo? | respuesta citando L769-2002-art129 | abstención | 0.267 | falsa abstención |
| BE-033 | con_sustento | ¿Cuánto me cobran por dejar el carro estacionado donde no se puede? | respuesta citando L769-2002-art131 | abstención | 0.304 | falsa abstención |
| BE-034 | con_sustento | ¿Cuánto es la multa por llevar a mi nieto de ocho años en la silla de adelante? | respuesta citando L769-2002-art131 | abstención | 0.329 | falsa abstención |
| BE-035 | con_sustento | Mi multa quedó ejecutoriada en 2022 y todavía la debo, ¿me la pasan a la unidad nueva que empezó en 2024? | respuesta citando L2294-2023-art313 | abstención | 0.196 | falsa abstención |
| BE-036 | con_sustento | Iba muy rápido y me pararon, ¿de cuánto es el comparendo por eso? | respuesta citando L769-2002-art131 | abstención | 0.449 | falsa abstención |
| BE-037 | con_sustento | ¿Qué diferencia hay entre una infracción simple y una compleja? | respuesta citando L769-2002-art2 | abstención | 0.223 | falsa abstención |
| BE-038 | con_sustento | ¿Quien guarda mis datos tiene que cuidarlos para que no se pierdan ni los vea cualquiera? | respuesta citando L1581-2012-art17 o L1581-2012-art4 | abstención | 0.297 | falsa abstención |
| BE-039 | con_sustento | ¿Ante qué entidad me puedo quejar si una aplicación usa mal mis datos? | respuesta citando L1581-2012-art8 | abstención | 0.227 | falsa abstención |
| BE-040 | con_sustento | ¿El 12 de octubre se corre para el lunes? | respuesta citando L51-1983-art1 | abstención | 0.644 | falsa abstención |

### Detalle de todas las preguntas

| Id | Tipo | Obtenido | Pregunta verificada usada | Citas | Puntaje | ms | Acierto |
|---|---|---|---|---|---|---|---|
| BE-001 | con_sustento | abstencion | - | - | 0.521 | 37 | No |
| BE-002 | con_sustento | abstencion | - | - | 0.444 | 3.97 | No |
| BE-003 | con_sustento | abstencion | - | - | 0.453 | 3.43 | No |
| BE-004 | con_sustento | abstencion | - | - | 0.329 | 2.80 | No |
| BE-005 | con_sustento | abstencion | - | - | 0.319 | 2.35 | No |
| BE-006 | con_sustento | abstencion | - | - | 0.311 | 5.21 | No |
| BE-007 | con_sustento | abstencion | - | - | 0.481 | 4.67 | No |
| BE-008 | con_sustento | abstencion | - | - | 0.514 | 2.17 | No |
| BE-009 | con_sustento | abstencion | - | - | 0.543 | 3.38 | No |
| BE-010 | con_sustento | abstencion | - | - | 0.412 | 1.92 | No |
| BE-011 | con_sustento | abstencion | - | - | 0.225 | 2.11 | No |
| BE-012 | con_sustento | abstencion | - | - | 0.514 | 5.66 | No |
| BE-013 | con_sustento | abstencion | - | - | 0.391 | 3.77 | No |
| BE-014 | con_sustento | abstencion | - | - | 0.278 | 2.02 | No |
| BE-015 | con_sustento | abstencion | - | - | 0.457 | 1.69 | No |
| BE-016 | con_sustento | abstencion | - | - | 0.337 | 2.17 | No |
| BE-017 | con_sustento | abstencion | - | - | 0.383 | 1.70 | No |
| BE-018 | con_sustento | abstencion | - | - | 0.415 | 2.31 | No |
| BE-019 | con_sustento | abstencion | - | - | 0.352 | 1.74 | No |
| BE-020 | con_sustento | abstencion | - | - | 0.613 | 1.78 | No |
| BE-021 | con_sustento | abstencion | - | - | 0.246 | 1.27 | No |
| BE-022 | con_sustento | abstencion | - | - | 0.394 | 4.03 | No |
| BE-023 | con_sustento | abstencion | - | - | 0.377 | 5.61 | No |
| BE-024 | con_sustento | abstencion | - | - | 0.504 | 1.27 | No |
| BE-025 | con_sustento | fuera_de_tema | - | - | 0.000 | 0.72 | No |
| BE-026 | con_sustento | abstencion | - | - | 0.507 | 1.87 | No |
| BE-027 | con_sustento | abstencion | - | - | 0.489 | 2.15 | No |
| BE-028 | con_sustento | abstencion | - | - | 0.625 | 1.71 | No |
| BE-029 | con_sustento | abstencion | - | - | 0.526 | 1.03 | No |
| BE-030 | con_sustento | abstencion | - | - | 0.150 | 1.45 | No |
| BE-031 | con_sustento | abstencion | - | - | 0.704 | 1.45 | No |
| BE-032 | con_sustento | abstencion | - | - | 0.267 | 1.35 | No |
| BE-033 | con_sustento | abstencion | - | - | 0.304 | 1.52 | No |
| BE-034 | con_sustento | abstencion | - | - | 0.329 | 1.96 | No |
| BE-035 | con_sustento | abstencion | - | - | 0.196 | 2.03 | No |
| BE-036 | con_sustento | abstencion | - | - | 0.449 | 1.40 | No |
| BE-037 | con_sustento | abstencion | - | - | 0.223 | 1.27 | No |
| BE-038 | con_sustento | abstencion | - | - | 0.297 | 1.06 | No |
| BE-039 | con_sustento | abstencion | - | - | 0.227 | 0.97 | No |
| BE-040 | con_sustento | abstencion | - | - | 0.644 | 0.65 | No |
| BE-041 | sin_sustento | abstencion | - | - | 0.250 | 0.91 | Sí |
| BE-042 | sin_sustento | abstencion | - | - | 0.516 | 1.09 | Sí |
| BE-043 | sin_sustento | abstencion | - | - | 0.189 | 1.56 | Sí |
| BE-044 | sin_sustento | abstencion | - | - | 0.359 | 1.06 | Sí |
| BE-045 | sin_sustento | abstencion | - | - | 0.235 | 1.05 | Sí |
| BE-046 | sin_sustento | abstencion | - | - | 0.379 | 1.32 | Sí |
| BE-047 | sin_sustento | abstencion | - | - | 0.308 | 1.10 | Sí |
| BE-048 | sin_sustento | abstencion | - | - | 0.553 | 2.75 | Sí |
| BE-049 | sin_sustento | abstencion | - | - | 0.300 | 2.57 | Sí |
| BE-050 | sin_sustento | abstencion | - | - | 0.441 | 1.31 | Sí |
| BE-051 | fuera_de_tema | fuera_de_tema | - | - | 0.000 | 0.59 | Sí |
| BE-052 | fuera_de_tema | fuera_de_tema | - | - | 0.000 | 0.49 | Sí |
| BE-053 | fuera_de_tema | fuera_de_tema | - | - | 0.000 | 0.47 | Sí |
| BE-054 | fuera_de_tema | fuera_de_tema | - | - | 0.000 | 0.48 | Sí |
| BE-055 | fuera_de_tema | fuera_de_tema | - | - | 0.000 | 0.48 | Sí |
| BE-056 | fuera_de_tema | fuera_de_tema | - | - | 0.000 | 0.46 | Sí |
| BE-057 | fuera_de_tema | fuera_de_tema | - | - | 0.000 | 0.45 | Sí |
| BE-058 | fuera_de_tema | fuera_de_tema | - | - | 0.000 | 0.45 | Sí |
| BE-059 | fuera_de_tema | fuera_de_tema | - | - | 0.000 | 0.45 | Sí |
| BE-060 | fuera_de_tema | fuera_de_tema | - | - | 0.000 | 0.46 | Sí |

## Cómo se eligió el umbral

El umbral y los pesos se eligieron **solo con data/preguntas-verificadas.json**, sin mirar el banco de evaluación, para no ajustar el resultado a las preguntas con que se mide.

Puntaje de una pregunta verificada: el mejor entre su pregunta y sus variantes. Para cada formulación se mide, con pesos IDF, qué parte de las palabras del usuario aparece en ella (con crédito parcial si solo aparece en los temas, la respuesta sencilla o el título y resumen de las normas citadas) y qué parte de las palabras de la formulación dijo el usuario. Puntaje = cobertura_usuario^alfa × cobertura_formulación^(1 − alfa). Va de 0 a 1.

- Positivos (184): cada variante se busca en un índice sin esa variante. Acierta si la pregunta ganadora cita al menos un artículo de la pregunta original (el mismo criterio del banco).
- Negativos (184): cada variante se busca en un índice sin ninguna pregunta que cite sus artículos. Simula una pregunta de tránsito sin sustento: lo correcto es abstenerse.
- Costo = 2 por cada respuesta equivocada (negativo respondido o positivo con cita no pertinente) + 1 por cada abstención de un positivo. Responder mal pesa el doble porque engaña; abstenerse remite a otra fuente. Si dos umbrales empatan, se elige el más alto.
- Como referencia, abstenerse siempre cuesta 184.

### Pesos comparados

| Pesos | Positivos con cita pertinente en primer lugar | Umbral de menor costo | Costo |
|---|---|---|---|
| alfa 0.5, temas 0.8, respuesta 0.6, base 0.4 | 135 de 184 | 0.85 | 168 |
| alfa 0.5, temas 0.5, respuesta 0.3, base 0.2 | 135 de 184 | 0.70 | 168 |
| alfa 0.5, temas 0, respuesta 0, base 0 | 130 de 184 | 0.85 | 168 |
| alfa 0.6, temas 0.8, respuesta 0.6, base 0.4 | 138 de 184 | 0.85 | 170 |
| alfa 0.6, temas 0.5, respuesta 0.3, base 0.2 | 136 de 184 | 0.85 | 167 |
| alfa 0.6, temas 0, respuesta 0, base 0 | 130 de 184 | 0.85 | 167 |
| alfa 0.7, temas 0.8, respuesta 0.6, base 0.4 | 139 de 184 | 0.90 | 169 |
| alfa 0.7, temas 0.5, respuesta 0.3, base 0.2 (elegidos) | 137 de 184 | 0.85 | 162 |
| alfa 0.7, temas 0, respuesta 0, base 0 | 131 de 184 | 0.85 | 161 |
| alfa 0.8, temas 0.8, respuesta 0.6, base 0.4 | 139 de 184 | 0.90 | 164 |
| alfa 0.8, temas 0.5, respuesta 0.3, base 0.2 | 138 de 184 | 0.90 | 163 |
| alfa 0.8, temas 0, respuesta 0, base 0 | 131 de 184 | 0.90 | 164 |
| alfa 1, temas 0.8, respuesta 0.6, base 0.4 | 140 de 184 | 0.95 | 180 |
| alfa 1, temas 0.5, respuesta 0.3, base 0.2 | 139 de 184 | 0.95 | 179 |
| alfa 1, temas 0, respuesta 0, base 0 | 138 de 184 | 0.95 | 179 |

Nota: los pesos de menor costo en la grilla son alfa 0.7, temas 0, respuesta 0, base 0 (costo 161). Se conservaron los elegidos porque la diferencia es de 1 y con ellos la base normativa sí aporta al puntaje.

### Curva del umbral con los pesos elegidos (alfa 0.7, temas 0.5, respuesta 0.3, base 0.2)

| Umbral | Positivos con cita pertinente | Positivos con cita no pertinente | Positivos abstenidos | Negativos respondidos | Costo |
|---|---|---|---|---|---|
| 0.30 | 136 | 47 | 1 | 154 | 403 |
| 0.35 | 134 | 47 | 3 | 129 | 355 |
| 0.40 | 129 | 42 | 13 | 107 | 311 |
| 0.45 | 124 | 40 | 20 | 90 | 280 |
| 0.50 | 120 | 35 | 29 | 73 | 245 |
| 0.55 | 110 | 30 | 44 | 57 | 218 |
| 0.60 | 97 | 22 | 65 | 45 | 199 |
| 0.65 | 85 | 18 | 81 | 33 | 183 |
| 0.70 | 70 | 15 | 99 | 24 | 177 |
| 0.75 | 54 | 13 | 117 | 22 | 187 |
| 0.80 | 43 | 10 | 131 | 16 | 183 |
| 0.85 (mínimo) | 37 | 3 | 144 | 6 | 162 |
| 0.90 | 26 | 3 | 155 | 5 | 171 |
| 0.95 | 19 | 3 | 162 | 5 | 178 |

Umbral de menor costo: **0.85**. Umbral configurado en src/core/ProveedorVerificado.ts (UMBRAL_PREDETERMINADO): **0.85**.

Limitaciones:
- El costo mínimo queda poco por debajo del de abstenerse siempre: con búsqueda por palabras, muchas variantes de una misma pregunta comparten pocas palabras entre sí. El umbral alto hace que el asistente prefiera abstenerse a responder con un artículo que no es el pertinente.
- En la calibración cada variante se busca sin ella misma. En la app están todas, así que una pregunta dicha igual que una variante conocida obtiene puntaje 1.

