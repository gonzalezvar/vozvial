# Evaluación del asistente con Claude

Archivo generado por `npm run eval:asistente -- --claude` (scripts/eval-asistente.ts). No editar a mano.

- Fecha de ejecución: 2026-11-08
- Modelo pedido: claude-opus-5-5. Modelos que respondieron: claude-opus-5-5.
- Esfuerzo: low. Tiempo máximo: 12000 ms.
- Sin prefiltro de tema: Claude clasifica "fuera_de_tema". Si Claude falla, responde el modo verificado (con su detector de tema).
- Banco: 60 preguntas. Mismos criterios de acierto que `docs/evaluacion/asistente.md`.
- Los tiempos incluyen la red hasta la API de Anthropic, medidos desde este computador.

## Resultados con Claude

| Métrica | Resultado | Detalle |
|---|---|---|
| Citas pertinentes (con_sustento) | 100.0 % | 40 de 40 respondieron y citaron al menos un artículo esperado |
| Falsas abstenciones (con_sustento) | 0.0 % | 0 de 40 |
| Respuestas con cita no pertinente (con_sustento) | 0.0 % | 0 de 40 |
| Con sustento marcadas fuera de tema | 0.0 % | 0 de 40 |
| Abstenciones correctas (sin_sustento) | 100.0 % | 10 de 10; respondieron sin sustento: 0 |
| Fuera de tema correctos | 100.0 % | 10 de 10 |
| Respuestas tipo "respuesta" con al menos una cita | 100.0 % | 40 de 40 |
| Tiempo por pregunta p50 | 2203 ms | |
| Tiempo por pregunta p95 | 7789 ms | |

### Errores (0 de 60)

No hubo errores.

### Detalle de todas las preguntas

| Id | Tipo | Obtenido | Pregunta verificada usada | Citas | Puntaje | ms | Acierto |
|---|---|---|---|---|---|---|---|
| BE-001 | con_sustento | respuesta | - | L769-2002-art135, L769-2002-art136 | 0.000 | 3030 | Sí |
| BE-002 | con_sustento | respuesta | - | L769-2002-art136 | 0.000 | 2089 | Sí |
| BE-003 | con_sustento | respuesta | - | L769-2002-art136 | 0.000 | 7224 | Sí |
| BE-004 | con_sustento | respuesta | - | L769-2002-art138 | 0.000 | 7116 | Sí |
| BE-005 | con_sustento | respuesta | - | L769-2002-art138 | 0.000 | 2078 | Sí |
| BE-006 | con_sustento | respuesta | - | L1843-2017-art8, L769-2002-art137, L769-2002-art129 | 0.000 | 3987 | Sí |
| BE-007 | con_sustento | respuesta | - | L1843-2017-art8 | 0.000 | 3065 | Sí |
| BE-008 | con_sustento | respuesta | - | L1843-2017-art8 | 0.000 | 2481 | Sí |
| BE-009 | con_sustento | respuesta | - | L1843-2017-art1, L769-2002-art129 | 0.000 | 2086 | Sí |
| BE-010 | con_sustento | respuesta | - | L1843-2017-art10 | 0.000 | 2864 | Sí |
| BE-011 | con_sustento | respuesta | - | L1843-2017-art9 | 0.000 | 2976 | Sí |
| BE-012 | con_sustento | respuesta | - | L1843-2017-art7, L769-2002-art136, L1843-2017-art8 | 0.000 | 2654 | Sí |
| BE-013 | con_sustento | respuesta | - | L769-2002-art137, L1843-2017-art8, L769-2002-art135 | 0.000 | 2538 | Sí |
| BE-014 | con_sustento | respuesta | - | L769-2002-art136 | 0.000 | 1925 | Sí |
| BE-015 | con_sustento | respuesta | - | L769-2002-art136, L1843-2017-art7 | 0.000 | 2359 | Sí |
| BE-016 | con_sustento | respuesta | - | L769-2002-art136 | 0.000 | 2166 | Sí |
| BE-017 | con_sustento | respuesta | - | L769-2002-art135, L769-2002-art136 | 0.000 | 2821 | Sí |
| BE-018 | con_sustento | respuesta | - | L769-2002-art136, L769-2002-art142 | 0.000 | 2952 | Sí |
| BE-019 | con_sustento | respuesta | - | L769-2002-art159 | 0.000 | 8077 | Sí |
| BE-020 | con_sustento | respuesta | - | L769-2002-art159 | 0.000 | 7789 | Sí |
| BE-021 | con_sustento | respuesta | - | L769-2002-art161, L1843-2017-art11 | 0.000 | 2667 | Sí |
| BE-022 | con_sustento | respuesta | - | L1843-2017-art11, L769-2002-art161 | 0.000 | 7999 | Sí |
| BE-023 | con_sustento | respuesta | - | L769-2002-art142 | 0.000 | 2790 | Sí |
| BE-024 | con_sustento | respuesta | - | L769-2002-art142 | 0.000 | 2112 | Sí |
| BE-025 | con_sustento | respuesta | - | L769-2002-art139, L769-2002-art136, L1843-2017-art8 | 0.000 | 2342 | Sí |
| BE-026 | con_sustento | respuesta | - | L769-2002-art125 | 0.000 | 2160 | Sí |
| BE-027 | con_sustento | respuesta | - | L769-2002-art125 | 0.000 | 3077 | Sí |
| BE-028 | con_sustento | respuesta | - | L769-2002-art125, L769-2002-art131 | 0.000 | 3247 | Sí |
| BE-029 | con_sustento | respuesta | - | L1801-2016-art21 | 0.000 | 2552 | Sí |
| BE-030 | con_sustento | respuesta | - | L769-2002-art157 | 0.000 | 2089 | Sí |
| BE-031 | con_sustento | respuesta | - | L769-2002-art135 | 0.000 | 1870 | Sí |
| BE-032 | con_sustento | respuesta | - | L769-2002-art129 | 0.000 | 1809 | Sí |
| BE-033 | con_sustento | respuesta | - | L769-2002-art131, L2294-2023-art313, L2294-2023-art372, MT-CONCEPTO-20261340231211, MT-CONCEPTO-20241340954691 | 0.000 | 5364 | Sí |
| BE-034 | con_sustento | respuesta | - | L769-2002-art131, L2294-2023-art313, MT-CONCEPTO-20261340231211, MT-CONCEPTO-20241340954691 | 0.000 | 2475 | Sí |
| BE-035 | con_sustento | respuesta | - | L2294-2023-art313, L2294-2023-art372, MT-CONCEPTO-20241340954691 | 0.000 | 2254 | Sí |
| BE-036 | con_sustento | respuesta | - | L769-2002-art131, L2294-2023-art313, L2294-2023-art372, MT-CONCEPTO-20261340231211, MT-CONCEPTO-20241340954691 | 0.000 | 2633 | Sí |
| BE-037 | con_sustento | respuesta | - | L769-2002-art2 | 0.000 | 1621 | Sí |
| BE-038 | con_sustento | respuesta | - | L1581-2012-art4, L1581-2012-art17 | 0.000 | 2197 | Sí |
| BE-039 | con_sustento | respuesta | - | L1581-2012-art8 | 0.000 | 1671 | Sí |
| BE-040 | con_sustento | respuesta | - | L51-1983-art1 | 0.000 | 2203 | Sí |
| BE-041 | sin_sustento | abstencion | - | - | 0.000 | 6286 | Sí |
| BE-042 | sin_sustento | abstencion | - | - | 0.000 | 1198 | Sí |
| BE-043 | sin_sustento | abstencion | - | - | 0.000 | 1285 | Sí |
| BE-044 | sin_sustento | abstencion | - | - | 0.000 | 1079 | Sí |
| BE-045 | sin_sustento | abstencion | - | - | 0.000 | 1665 | Sí |
| BE-046 | sin_sustento | abstencion | - | - | 0.000 | 1109 | Sí |
| BE-047 | sin_sustento | abstencion | - | - | 0.000 | 1609 | Sí |
| BE-048 | sin_sustento | abstencion | - | - | 0.000 | 1048 | Sí |
| BE-049 | sin_sustento | abstencion | - | - | 0.000 | 1092 | Sí |
| BE-050 | sin_sustento | abstencion | - | - | 0.000 | 1090 | Sí |
| BE-051 | fuera_de_tema | fuera_de_tema | - | - | 0.000 | 11952 | Sí |
| BE-052 | fuera_de_tema | fuera_de_tema | - | - | 0.000 | 1241 | Sí |
| BE-053 | fuera_de_tema | fuera_de_tema | - | - | 0.000 | 1205 | Sí |
| BE-054 | fuera_de_tema | fuera_de_tema | - | - | 0.000 | 1539 | Sí |
| BE-055 | fuera_de_tema | fuera_de_tema | - | - | 0.000 | 1202 | Sí |
| BE-056 | fuera_de_tema | fuera_de_tema | - | - | 0.000 | 6595 | Sí |
| BE-057 | fuera_de_tema | fuera_de_tema | - | - | 0.000 | 1386 | Sí |
| BE-058 | fuera_de_tema | fuera_de_tema | - | - | 0.000 | 1514 | Sí |
| BE-059 | fuera_de_tema | fuera_de_tema | - | - | 0.000 | 1456 | Sí |
| BE-060 | fuera_de_tema | fuera_de_tema | - | - | 0.000 | 3196 | Sí |

## Respaldo y caché

| Métrica | Valor |
|---|---|
| Respuestas que cayeron al modo verificado | 0 de 60 (ninguna) |
| Respuestas servidas por el fallback del servidor (otro modelo) | 0 de 60 |
| Textos de Claude descartados por la revisión (abstención) | 0 (ninguno) |
| Tiempo de la llamada a Claude p50 | 2204 ms |
| Tiempo de la llamada a Claude p95 | 7789 ms |
| Tokens leídos del caché | 2219993 |
| Tokens escritos en el caché | 37627 |
| Tokens de entrada sin caché | 2125 |
| Tokens de salida (incluye razonamiento) | 8174 |

Los tokens suman todos los intentos de cada consulta (`usage.iterations`), incluidos los rechazados y los del modelo de respaldo.

