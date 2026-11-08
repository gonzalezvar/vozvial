# Matriz de criterios de aceptación

Archivo generado por el reporter `e2e/reporter-matriz.ts` al correr Playwright, o por `npx tsx scripts/matriz-desde-resultados.ts`. No editar a mano.

- Fuente de los criterios y del resultado esperado: `docs/historias-usuario.md`.
- Fuente de los resultados: `docs/evaluacion/resultados-e2e.json`, con el último resultado de cada criterio. Las suites se corren por separado y cada una actualiza solo sus criterios.
- Una prueba cubre un criterio cuando su nombre empieza por el id (por ejemplo `CA-09.2 ...`). "Sin prueba" quiere decir que no hay resultado registrado para ese criterio.
- RNF-02 y RNF-03 se miden con `npm run eval:asistente` y su resultado está en `docs/evaluacion/asistente.md`.

## Resumen

- Fecha de generación: 8 de noviembre de 2026, 1:36 p. m.
- Última ejecución registrada: 8 de noviembre de 2026, 1:36 p. m.
- Total de criterios: 50
- Cumple: 40
- Cumple parcialmente: 1
- No cumple: 0
- Sin prueba: 9

## HU-01 · Crear mi cuenta

| Criterio | Resultado esperado | Resultado observado | Cumple / No cumple | Observación | Evidencia |
|---|---|---|---|---|---|
| CA-01.1 Registro exitoso | Pantalla con el código de recuperación de 12 caracteres, con opción de escucharlo y aviso de guardarlo | Comprobado: Registro exitoso muestra el código de 12 caracteres, se puede escuchar y pide guardarlo | Cumple | (prueba: e2e/hu01-crear-cuenta.spec.ts, 2026-11-08) | [CA-01.1.png](../../evidencias/CA-01.1.png) |
| CA-01.2 Campos obligatorios | Se marca el campo vacío con un mensaje claro y se lee en voz alta | Comprobado: Un campo vacío se marca con mensaje claro, se lee en voz alta y no se crea la cuenta | Cumple | (prueba: e2e/hu01-crear-cuenta.spec.ts, 2026-11-08) | [CA-01.2.png](../../evidencias/CA-01.2.png) |
| CA-01.3 Celular válido | "Escribe tu celular de 10 dígitos, por ejemplo 3001234567" | Comprobado: Un celular que no tiene 10 dígitos o no empieza por 3 se rechaza | Cumple | (prueba: e2e/hu01-crear-cuenta.spec.ts, 2026-11-08) | [CA-01.3.png](../../evidencias/CA-01.3.png) |
| CA-01.4 PIN seguro | Mensaje que dice cuál regla falló | Comprobado: El PIN se rechaza diciendo qué regla falló | Cumple | (prueba: e2e/hu01-crear-cuenta.spec.ts, 2026-11-08) | [CA-01.4.png](../../evidencias/CA-01.4.png) |
| CA-01.5 Autorización de datos (Ley 1581 de 2012) | Aviso y enlace a la política de datos en lenguaje sencillo | Comprobado: Sin la autorización de datos no se crea la cuenta y se enlaza la política | Cumple | (prueba: e2e/hu01-crear-cuenta.spec.ts, 2026-11-08) | [CA-01.5.png](../../evidencias/CA-01.5.png) |
| CA-01.6 PIN protegido | Solo se ven el hash PBKDF2, la sal y el número de iteraciones | Comprobado: El PIN no queda en texto plano: solo hash PBKDF2, sal e iteraciones | Cumple | (prueba: e2e/hu01-crear-cuenta.spec.ts, 2026-11-08) | [CA-01.6.png](../../evidencias/CA-01.6.png) |

## HU-02 · Entrar con mi PIN

| Criterio | Resultado esperado | Resultado observado | Cumple / No cumple | Observación | Evidencia |
|---|---|---|---|---|---|
| CA-02.1 PIN correcto | Pantalla de inicio con mi nombre | Comprobado: Con el PIN correcto entro y veo mi nombre en el inicio | Cumple | (prueba: e2e/hu02-entrar.spec.ts, 2026-11-08) | [CA-02.1.png](../../evidencias/CA-02.1.png) |
| CA-02.2 PIN incorrecto | "PIN incorrecto. Te quedan N intentos." | Comprobado: Con un PIN incorrecto no entro y me dice cuántos intentos quedan | Cumple | (prueba: e2e/hu02-entrar.spec.ts, 2026-11-08) | [CA-02.2.png](../../evidencias/CA-02.2.png) |
| CA-02.3 Bloqueo temporal | Contador visible del tiempo restante | Comprobado: Tras 5 fallos seguidos se bloquea con un contador visible del tiempo restante | Cumple | (prueba: e2e/hu02-entrar.spec.ts, 2026-11-08) | [CA-02.3.png](../../evidencias/CA-02.3.png) |
| CA-02.4 Cierre por inactividad | Vuelve a pedir el PIN. En las pruebas el tiempo se configura más corto | Comprobado: Sin actividad la sesión se cierra y vuelve a pedir el PIN | Cumple | (prueba: e2e/hu02-entrar.spec.ts, 2026-11-08) | [CA-02.4.png](../../evidencias/CA-02.4.png) |

## HU-03 · Recuperar el acceso

| Criterio | Resultado esperado | Resultado observado | Cumple / No cumple | Observación | Evidencia |
|---|---|---|---|---|---|
| CA-03.1 Código correcto | Mis casos anteriores siguen ahí y se pueden abrir | Comprobado: Con el código correcto y un PIN nuevo entro y mis casos anteriores siguen ahí | Cumple | (prueba: e2e/hu03-recuperar.spec.ts, 2026-11-08) | [CA-03.1.png](../../evidencias/CA-03.1.png) |
| CA-03.2 Código incorrecto | Mensaje de error; no permite cambiar el PIN | Comprobado: Con un código incorrecto se rechaza y el PIN no cambia | Cumple | (prueba: e2e/hu03-recuperar.spec.ts, 2026-11-08) | [CA-03.2.png](../../evidencias/CA-03.2.png) |

## HU-04 · Ver y escuchar con comodidad

| Criterio | Resultado esperado | Resultado observado | Cumple / No cumple | Observación | Evidencia |
|---|---|---|---|---|---|
| CA-04.1 Tamaño de letra (pospuesto para la entrega final) | Texto base de 18 / 22 / 26 px según la opción; la elección se conserva al volver a entrar | — | Sin prueba | No hay prueba registrada para este criterio. | — |
| CA-04.2 Escuchar pantalla (pospuesto para la entrega final) | Lectura en español; el botón cambia a "Detener" | — | Sin prueba | No hay prueba registrada para este criterio. | — |
| CA-04.3 Contraste y etiquetas | Reporte de axe adjunto en la evaluación | axe (wcag2a, wcag2aa) en 10 pantallas: 0 critical, 0 serious, 0 moderate, 0 minor. Reporte en docs/evaluacion/axe-reporte.md. | Cumple | (prueba: e2e/axe.spec.ts, 2026-11-08) | [CA-04.3.png](../../evidencias/CA-04.3.png) |

## HU-05 · Preguntar hablando

| Criterio | Resultado esperado | Resultado observado | Cumple / No cumple | Observación | Evidencia |
|---|---|---|---|---|---|
| CA-05.1 Transcripción visible | Texto transcrito, con botones "Enviar" y "Corregir" | Comprobado: Al terminar de hablar muestra lo que entendió con Enviar y Corregir | Cumple | (prueba: e2e/hu05-asistente-voz.spec.ts, 2026-11-08) | [CA-05.1.png](../../evidencias/CA-05.1.png) |
| CA-05.2 Alternativa sin micrófono | Campo de texto visible y mensaje que explica por qué | Comprobado: Sin reconocimiento de voz o con el permiso negado se puede escribir y se explica por qué | Cumple | (prueba: e2e/hu05-asistente-voz.spec.ts, 2026-11-08) | [CA-05.2.png](../../evidencias/CA-05.2.png) |
| CA-05.3 Respuesta hablada | Respuesta corta en lenguaje sencillo, con botón "Repetir" | Comprobado: La respuesta verificada se lee en voz alta y se puede repetir | Cumple | (prueba: e2e/hu05-asistente-voz.spec.ts, 2026-11-08) | [CA-05.3.png](../../evidencias/CA-05.3.png) |

## HU-06 · Respuestas con sustento

| Criterio | Resultado esperado | Resultado observado | Cumple / No cumple | Observación | Evidencia |
|---|---|---|---|---|---|
| CA-06.1 Cita obligatoria | Tarjeta de cita que, al tocarla, muestra el texto literal y la fecha de consulta | Comprobado: La respuesta muestra norma, artículo y enlace, y al tocar la cita el texto literal y la fecha | Cumple | El enlace al texto oficial aparece al tocar la cita. Solo responde preguntas parecidas a las 49 verificadas: con otras palabras suele abstenerse (ver docs/evaluacion/asistente.md). (prueba: e2e/hu06-respuestas.spec.ts, 2026-11-08) | [CA-06.1.png](../../evidencias/CA-06.1.png) |
| CA-06.2 Abstención | "No tengo información verificada sobre eso" + sugerencia de dónde consultar | Comprobado: Sin sustento verificado se abstiene y sugiere dónde consultar | Cumple | (prueba: e2e/hu06-respuestas.spec.ts, 2026-11-08) | [CA-06.2.png](../../evidencias/CA-06.2.png) |
| CA-06.3 Fuera de tema | Mensaje que explica qué temas sí cubre | Comprobado: Una pregunta que no es de tránsito se declina explicando los temas cubiertos | Cumple | (prueba: e2e/hu06-respuestas.spec.ts, 2026-11-08) | [CA-06.3.png](../../evidencias/CA-06.3.png) |
| CA-06.4 Aviso legal | "VozVial informa y organiza. No reemplaza a un abogado." | Comprobado: Toda respuesta trae el aviso legal | Cumple | (prueba: e2e/hu06-respuestas.spec.ts, 2026-11-08) | [CA-06.4.png](../../evidencias/CA-06.4.png) |
| CA-06.5 Sin conexión (refinado 2026-11-08, ver refinamiento) | "El asistente necesita internet" + accesos a las funciones que sí sirven sin conexión | Comprobado: Sin internet avisa que el asistente necesita internet y ofrece lo que sí funciona | Cumple | Vale con la app ya abierta antes de perder la conexión: no hay service worker, así que recargar sin internet no abre la app. (prueba: e2e/hu06-respuestas.spec.ts, 2026-11-08) | [CA-06.5.png](../../evidencias/CA-06.5.png) |

## HU-07 · Modo "Me pararon"

| Criterio | Resultado esperado | Resultado observado | Cumple / No cumple | Observación | Evidencia |
|---|---|---|---|---|---|
| CA-07.1 Inicio rápido | Indicador visible "Grabando" con tiempo transcurrido | 1 toque desde el inicio. Indicador "Grabando" con tiempo 00:02 (MediaRecorder activo). | Cumple | (prueba: e2e/hu07-me-pararon.spec.ts, 2026-11-08) | [CA-07.1.png](../../evidencias/CA-07.1.png) |
| CA-07.2 Datos del momento | Si niego la ubicación, el caso se crea igual y lo indica: "Sin ubicación" | Con permiso: 4.60970, -74.08170 y fecha 8 de noviembre de 2026. Sin permiso: el caso se crea igual con "Sin ubicación". | Cumple | (prueba: e2e/hu07-me-pararon.spec.ts, 2026-11-08) | [CA-07.2.png](../../evidencias/CA-07.2.png) |
| CA-07.3 Derechos a la vista (refinado 2026-11-08, ver refinamiento) | Solo entradas verificadas de la base, cada una con su artículo. El derecho a grabar se sustenta en el art. 21 de la Ley 1801 de 2016, que habla de "procedimiento policivo"; si se aplica a agentes de tránsito civiles requiere revisión jurídica | Se muestran 4 derechos verificados: L1801-2016-art21, L769-2002-art135, L769-2002-art125, L769-2002-art136. | Cumple | (prueba: e2e/hu07-me-pararon.spec.ts, 2026-11-08) | [CA-07.3.png](../../evidencias/CA-07.3.png) |
| CA-07.4 Terminar y guardar | El caso aparece en el historial con su audio reproducible | Caso en Mis casos con audio audio/webm;codecs=opus de 28971 bytes, descifrado y cargado en el reproductor. | Cumple | (prueba: e2e/hu07-me-pararon.spec.ts, 2026-11-08) | [CA-07.4.png](../../evidencias/CA-07.4.png) |

## HU-08 · Agregar evidencias

| Criterio | Resultado esperado | Resultado observado | Cumple / No cumple | Observación | Evidencia |
|---|---|---|---|---|---|
| CA-08.1 Foto | Miniatura en la lista de evidencias | Foto con fecha "domingo 8 de noviembre de 2026, 1:35 p. m." y miniatura de 64 x 64. | Cumple | (prueba: e2e/hu08-evidencias.spec.ts, 2026-11-08) | [CA-08.1.png](../../evidencias/CA-08.1.png) |
| CA-08.2 Nota por voz o texto | Nota visible con fecha y hora | Nota dictada (reconocimiento simulado, es-CO) y nota escrita, ambas con fecha y hora. | Cumple | (prueba: e2e/hu08-evidencias.spec.ts, 2026-11-08) | [CA-08.2.png](../../evidencias/CA-08.2.png) |
| CA-08.3 Evidencias cifradas | Solo se ven datos cifrados, sin texto ni imagen legible | IndexedDB: 1 caso y 2 contenidos, solo id, iv y datos cifrados. No aparece el texto de la nota ni la firma PNG o webm. | Cumple | (prueba: e2e/hu08-evidencias.spec.ts, 2026-11-08) | [CA-08.3.png](../../evidencias/CA-08.3.png) |

## HU-09 · Registrar el comparendo con una foto

| Criterio | Resultado esperado | Resultado observado | Cumple / No cumple | Observación | Evidencia |
|---|---|---|---|---|---|
| CA-09.1 Extracción | Formulario prellenado | Comprobado: La foto legible llena número, fecha, placa y código | Cumple | (prueba: e2e/hu09-comparendo.spec.ts, 2026-11-08) | [CA-09.1.png](../../evidencias/CA-09.1.png) |
| CA-09.2 Revisión de dudosos | "Revisa este dato"; no se guarda hasta que lo confirmo | Comprobado: El dato con baja confianza se resalta y no se guarda sin confirmarlo | Cumple | (prueba: e2e/hu09-comparendo.spec.ts, 2026-11-08) | [CA-09.2.png](../../evidencias/CA-09.2.png) |
| CA-09.3 Código válido | "Ese código no aparece en el Código de Tránsito. Revísalo." | Comprobado: Un código que no está en el catálogo se rechaza | Cumple | (prueba: e2e/hu09-comparendo.spec.ts, 2026-11-08) | [CA-09.3.png](../../evidencias/CA-09.3.png) |
| CA-09.4 Registro manual | Comparendo guardado igual que con foto | Comprobado: "Escribir los datos" registra el comparendo a mano | Cumple | (prueba: e2e/hu09-comparendo.spec.ts, 2026-11-08) | [CA-09.4.png](../../evidencias/CA-09.4.png) |

## HU-10 · Entender mi infracción

| Criterio | Resultado esperado | Resultado observado | Cumple / No cumple | Observación | Evidencia |
|---|---|---|---|---|---|
| CA-10.1 Explicación | Texto sencillo + texto literal desplegable | Comprobado: El detalle explica la infracción en palabras sencillas, con su artículo y el texto literal desplegable | Cumple | (prueba: e2e/hu10-infraccion.spec.ts, 2026-11-08) | [CA-10.1.png](../../evidencias/CA-10.1.png) |
| CA-10.2 Valor de referencia (refinado 2026-11-08, ver refinamiento) | (a) Sanción en su unidad legal, fuente con fecha de consulta y "Confirma en SIMIT". (b) "Valor de referencia para AAAA según [fuente]": bloqueado hasta verificar la UVB 2026 | Comprobado: El valor aparece con su unidad, su vigencia y su fuente | Cumple parcialmente | No aparece un valor en pesos con su año: ninguna infracción tiene valor_referencia verificado y la UVB 2026 está en verificado:false. La app muestra la sanción en SMDLV, la fuente con su fecha de consulta y remite a SIMIT. (prueba: e2e/hu10-infraccion.spec.ts, 2026-11-08) | [CA-10.2.png](../../evidencias/CA-10.2.png) |

## HU-11 · Saber hasta cuándo puedo actuar

| Criterio | Resultado esperado | Resultado observado | Cumple / No cumple | Observación | Evidencia |
|---|---|---|---|---|---|
| CA-11.1 Comparendo en vía (refinado 2026-11-08, ver refinamiento) | Fecha límite: lunes 23 nov 2026 (el 16 nov es festivo) | Comprobado: Comparendo en vía del viernes 13 nov 2026: fecha límite lunes 23 nov 2026 | Cumple | La prueba fija el reloj en el 13 nov 2026. La app no acepta fechas futuras, así que a mano solo se reproduce desde ese día. (prueba: e2e/hu11-plazos.spec.ts, 2026-11-08) | [CA-11.1.png](../../evidencias/CA-11.1.png) |
| CA-11.2 Fotodetección (refinado 2026-11-08, ver refinamiento) | Fecha límite: martes 1 dic 2026 | Comprobado: Fotodetección notificada el viernes 13 nov 2026: fecha límite martes 1 dic 2026 | Cumple | La prueba fija el reloj en el 13 nov 2026. La app no acepta fechas futuras, así que a mano solo se reproduce desde ese día. (prueba: e2e/hu11-plazos.spec.ts, 2026-11-08) | [CA-11.2.png](../../evidencias/CA-11.2.png) |
| CA-11.3 Fecha de recibo explícita (refinado 2026-11-08, ver refinamiento) | Pregunta con explicación; el cálculo dice qué fecha usó | Comprobado: En fotodetección se pregunta la fecha de la notificación y el cálculo dice qué fecha usó | Cumple | (prueba: e2e/hu11-plazos.spec.ts, 2026-11-08) | [CA-11.3.png](../../evidencias/CA-11.3.png) |
| CA-11.4 Días restantes | "Te quedan N días hábiles" o "El plazo venció el …" | Comprobado: El caso muestra los días hábiles restantes o que el plazo venció | Cumple | (prueba: e2e/hu11-plazos.spec.ts, 2026-11-08) | [CA-11.4.png](../../evidencias/CA-11.4.png) |

## HU-12 · Recordatorios de plazo

| Criterio | Resultado esperado | Resultado observado | Cumple / No cumple | Observación | Evidencia |
|---|---|---|---|---|---|
| CA-12.1 Aviso anticipado | Alerta en el inicio que lleva al caso | Comprobado: Con 2 días hábiles o menos el inicio muestra una alerta que lleva al caso | Cumple | (prueba: e2e/hu12-recordatorios.spec.ts, 2026-11-08) | [CA-12.1.png](../../evidencias/CA-12.1.png) |
| CA-12.2 Día límite | "Hoy vence tu plazo para …" | Comprobado: El día límite la alerta dice "Hoy vence tu plazo para …" | Cumple | (prueba: e2e/hu12-recordatorios.spec.ts, 2026-11-08) | [CA-12.2.png](../../evidencias/CA-12.2.png) |

## HU-13 · Generar la solicitud de audiencia

| Criterio | Resultado esperado | Resultado observado | Cumple / No cumple | Observación | Evidencia |
|---|---|---|---|---|---|
| CA-13.1 Vista previa (pospuesto para la entrega final) | PDF con mis datos, los del comparendo, la lista de evidencias y la norma citada | — | Sin prueba | No hay prueba registrada para este criterio. | — |
| CA-13.2 Datos faltantes (pospuesto para la entrega final) | La app dice qué falta y me lleva a completarlo | — | Sin prueba | No hay prueba registrada para este criterio. | — |
| CA-13.3 Descarga (pospuesto para la entrega final) | Archivo `solicitud-audiencia-<numero>.pdf` | — | Sin prueba | No hay prueba registrada para este criterio. | — |

## HU-14 · Mis casos

| Criterio | Resultado esperado | Resultado observado | Cumple / No cumple | Observación | Evidencia |
|---|---|---|---|---|---|
| CA-14.1 Orden por urgencia (pospuesto para la entrega final) | Cada caso con estado y días restantes | — | Sin prueba | No hay prueba registrada para este criterio. | — |
| CA-14.2 Exportar (pospuesto para la entrega final) | ZIP con JSON y archivos | — | Sin prueba | No hay prueba registrada para este criterio. | — |
| CA-14.3 Borrar caso (pospuesto para la entrega final) | El caso ya no aparece y sus datos ya no están en IndexedDB | — | Sin prueba | No hay prueba registrada para este criterio. | — |
| CA-14.4 Borrar todo (pospuesto para la entrega final) | Pantalla de bienvenida; IndexedDB vacío | — | Sin prueba | No hay prueba registrada para este criterio. | — |

## RNF-01 · Privacidad (requisito no funcional)

| Criterio | Resultado esperado | Resultado observado | Cumple / No cumple | Observación | Evidencia |
|---|---|---|---|---|---|
| RNF-01 Privacidad | Al servidor solo viaja el texto de la pregunta. Se verifica con la pestaña Network de Playwright: la petición a `/api/asistente` no contiene nombre, ubicación ni audio. | Comprobado: La peticion solo lleva el texto de la pregunta | Cumple | (prueba: e2e/rnf01-privacidad.spec.ts, 2026-11-08) | [RNF-01.png](../../evidencias/RNF-01.png) |
