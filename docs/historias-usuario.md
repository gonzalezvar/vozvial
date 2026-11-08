# Historias de usuario y criterios de aceptación — prototipo VozVial

Fuente de verdad para construir, probar y documentar el prototipo. Cada criterio tiene un id (`CA-HH.N`) que se usa en el nombre de su prueba e2e y de su captura (`evidencias/CA-HH.N.png`).

- Los criterios están escritos en formato Dado / Cuando / Entonces.
- Si al evaluar un criterio no se puede cumplir o hay que cambiarlo, **no se borra**. Se registra en `docs/refinamiento-historias.md`: qué cambió, por qué y qué prueba lo reveló.

Actor principal: **conductor**, en especial adulto mayor, que usa la app en su celular.

Orden de uso, que también es el orden del documento y del video:
1. Cuenta y acceso
2. Accesibilidad
3. Asistente por voz
4. Me pararon y evidencias
5. Comparendo y plazos
6. Documentos
7. Historial y privacidad

---

## Módulo 1 · Cuenta y acceso

### HU-01 · Crear mi cuenta
**Como** conductor, **quiero** crear mi cuenta con mi nombre, mi celular y un PIN, **para** que solo yo pueda ver mis casos.

| Id | Criterio | Dado / Cuando / Entonces | Resultado esperado |
|---|---|---|---|
| CA-01.1 | Registro exitoso | Dado que lleno nombre, celular y PIN válidos y acepto la autorización de datos, cuando toco "Crear cuenta", entonces la cuenta se crea | Pantalla con el código de recuperación de 12 caracteres, con opción de escucharlo y aviso de guardarlo |
| CA-01.2 | Campos obligatorios | Dado que dejo vacío un campo, cuando toco "Crear cuenta", entonces no se crea la cuenta | Se marca el campo vacío con un mensaje claro y se lee en voz alta |
| CA-01.3 | Celular válido | Dado que escribo un celular que no tiene 10 dígitos o no empieza por 3, cuando continúo, entonces se rechaza | "Escribe tu celular de 10 dígitos, por ejemplo 3001234567" |
| CA-01.4 | PIN seguro | Dado que escribo un PIN que no tiene 6 dígitos, es una secuencia (123456, 654321), tiene todos los dígitos iguales (111111) o no coincide con su confirmación, cuando continúo, entonces se rechaza | Mensaje que dice cuál regla falló |
| CA-01.5 | Autorización de datos (Ley 1581 de 2012) | Dado que no marco la autorización de tratamiento de datos, cuando toco "Crear cuenta", entonces no se crea | Aviso y enlace a la política de datos en lenguaje sencillo |
| CA-01.6 | PIN protegido | Dado que la cuenta se creó, cuando se inspecciona el almacenamiento del navegador, entonces el PIN no aparece en texto plano | Solo se ven el hash PBKDF2, la sal y el número de iteraciones |

### HU-02 · Entrar con mi PIN
**Como** conductor, **quiero** entrar con mi PIN de 6 dígitos, **para** no tener que recordar contraseñas largas.

| Id | Criterio | Dado / Cuando / Entonces | Resultado esperado |
|---|---|---|---|
| CA-02.1 | PIN correcto | Dado que tengo cuenta, cuando escribo mi PIN correcto, entonces entro | Pantalla de inicio con mi nombre |
| CA-02.2 | PIN incorrecto | Dado que escribo un PIN incorrecto, cuando confirmo, entonces no entro | "PIN incorrecto. Te quedan N intentos." |
| CA-02.3 | Bloqueo temporal | Dado que fallo 5 veces seguidas, cuando intento de nuevo, entonces la app se bloquea 5 minutos | Contador visible del tiempo restante |
| CA-02.4 | Cierre por inactividad | Dado que estoy dentro, cuando pasan 10 minutos sin actividad, entonces la sesión se cierra | Vuelve a pedir el PIN. En las pruebas el tiempo se configura más corto |

### HU-03 · Recuperar el acceso
**Como** conductor que olvidó su PIN, **quiero** recuperar el acceso con mi código de recuperación, **para** no perder mis casos.

| Id | Criterio | Dado / Cuando / Entonces | Resultado esperado |
|---|---|---|---|
| CA-03.1 | Código correcto | Dado que escribo mi código de recuperación correcto, cuando defino un PIN nuevo, entonces entro | Mis casos anteriores siguen ahí y se pueden abrir |
| CA-03.2 | Código incorrecto | Dado que escribo un código incorrecto, cuando confirmo, entonces se rechaza | Mensaje de error; no permite cambiar el PIN |

---

## Módulo 2 · Accesibilidad

### HU-04 · Ver y escuchar con comodidad
*CA-04.1 y CA-04.2 pospuestos para la entrega final (ver `docs/refinamiento-historias.md`). CA-04.3 sí se evalúa en el prototipo.*

**Como** adulto mayor, **quiero** agrandar la letra y escuchar lo que dice cada pantalla, **para** usar la app sin esforzar la vista.

| Id | Criterio | Dado / Cuando / Entonces | Resultado esperado |
|---|---|---|---|
| CA-04.1 | Tamaño de letra (pospuesto para la entrega final) | Dado que estoy en Ajustes, cuando elijo "Grande" o "Muy grande", entonces toda la app cambia | Texto base de 18 / 22 / 26 px según la opción; la elección se conserva al volver a entrar |
| CA-04.2 | Escuchar pantalla (pospuesto para la entrega final) | Dado que estoy en cualquier pantalla principal, cuando toco "Escuchar", entonces se lee el contenido | Lectura en español; el botón cambia a "Detener" |
| CA-04.3 | Contraste y etiquetas | Dado cualquier pantalla principal, cuando se analiza con axe, entonces no hay violaciones serias ni críticas | Reporte de axe adjunto en la evaluación |

---

## Módulo 3 · Asistente por voz

### HU-05 · Preguntar hablando
**Como** conductor, **quiero** hacer mi pregunta hablando, **para** no tener que escribir.

| Id | Criterio | Dado / Cuando / Entonces | Resultado esperado |
|---|---|---|---|
| CA-05.1 | Transcripción visible | Dado que toco el micrófono y hablo, cuando termino, entonces veo lo que la app entendió | Texto transcrito, con botones "Enviar" y "Corregir" |
| CA-05.2 | Alternativa sin micrófono | Dado que el navegador no permite reconocer voz o niego el permiso, cuando abro el asistente, entonces puedo escribir | Campo de texto visible y mensaje que explica por qué |
| CA-05.3 | Respuesta hablada | Dado que envío una pregunta con respuesta verificada, cuando llega la respuesta, entonces se lee en voz alta | Respuesta corta en lenguaje sencillo, con botón "Repetir" |

### HU-06 · Respuestas con sustento
**Como** conductor, **quiero** que cada respuesta me diga en qué norma se basa, **para** poder confiar en ella y mostrarla.

| Id | Criterio | Dado / Cuando / Entonces | Resultado esperado |
|---|---|---|---|
| CA-06.1 | Cita obligatoria | Dado que la pregunta tiene respuesta en la base, cuando responde, entonces muestra norma, artículo y enlace al texto oficial | Tarjeta de cita que, al tocarla, muestra el texto literal y la fecha de consulta |
| CA-06.2 | Abstención | Dado que la pregunta es de tránsito pero no hay sustento verificado, cuando responde, entonces no inventa | "No tengo información verificada sobre eso" + sugerencia de dónde consultar |
| CA-06.3 | Fuera de tema | Dado que pregunto algo que no es de tránsito, cuando responde, entonces declina con amabilidad | Mensaje que explica qué temas sí cubre |
| CA-06.4 | Aviso legal | Dado cualquier respuesta, cuando se muestra, entonces aparece el aviso | "VozVial informa y organiza. No reemplaza a un abogado." |
| CA-06.5 | Sin conexión (refinado 2026-11-08, ver refinamiento) | Dado que la app ya está abierta y se pierde internet, cuando abro el asistente, entonces me avisa. El prototipo no tiene service worker: si se recarga sin internet la app no abre | "El asistente necesita internet" + accesos a las funciones que sí sirven sin conexión |

---

## Módulo 4 · Me pararon y evidencias

### HU-07 · Modo "Me pararon"
**Como** conductor detenido por un agente, **quiero** un botón grande que empiece a registrar todo, **para** tener pruebas sin pensar qué hacer.

| Id | Criterio | Dado / Cuando / Entonces | Resultado esperado |
|---|---|---|---|
| CA-07.1 | Inicio rápido | Dado que estoy en la pantalla de inicio, cuando toco "Me pararon", entonces en máximo 2 toques empieza a grabar audio | Indicador visible "Grabando" con tiempo transcurrido |
| CA-07.2 | Datos del momento | Dado que se inicia el modo, cuando se crea el caso, entonces se guardan fecha, hora y ubicación | Si niego la ubicación, el caso se crea igual y lo indica: "Sin ubicación" |
| CA-07.3 | Derechos a la vista (refinado 2026-11-08, ver refinamiento) | Dado que el modo está activo, cuando miro la pantalla, entonces veo mis derechos clave | Solo entradas verificadas de la base, cada una con su artículo. El derecho a grabar se sustenta en el art. 21 de la Ley 1801 de 2016, que habla de "procedimiento policivo"; si se aplica a agentes de tránsito civiles requiere revisión jurídica |
| CA-07.4 | Terminar y guardar | Dado que toco "Terminar", cuando se detiene la grabación, entonces el audio queda en el caso | El caso aparece en el historial con su audio reproducible |

### HU-08 · Agregar evidencias
**Como** conductor, **quiero** agregar fotos y notas a mi caso, **para** tener todo junto cuando impugne.

| Id | Criterio | Dado / Cuando / Entonces | Resultado esperado |
|---|---|---|---|
| CA-08.1 | Foto | Dado que estoy en un caso, cuando agrego una foto, entonces queda con fecha y hora | Miniatura en la lista de evidencias |
| CA-08.2 | Nota por voz o texto | Dado que estoy en un caso, cuando dicto o escribo una nota, entonces se guarda | Nota visible con fecha y hora |
| CA-08.3 | Evidencias cifradas | Dado que guardé evidencias, cuando se inspecciona IndexedDB, entonces el contenido está cifrado | Solo se ven datos cifrados, sin texto ni imagen legible |

---

## Módulo 5 · Comparendo y plazos

### HU-09 · Registrar el comparendo con una foto
**Como** conductor, **quiero** tomarle foto al comparendo y que la app saque los datos, **para** no tener que escribirlos.

| Id | Criterio | Dado / Cuando / Entonces | Resultado esperado |
|---|---|---|---|
| CA-09.1 | Extracción | Dado que subo la foto de un comparendo legible, cuando se procesa, entonces se llenan número, fecha, placa y código de infracción | Formulario prellenado |
| CA-09.2 | Revisión de dudosos | Dado que el OCR tiene baja confianza en un campo, cuando se muestra el formulario, entonces ese campo se resalta | "Revisa este dato"; no se guarda hasta que lo confirmo |
| CA-09.3 | Código válido | Dado que el código de infracción no existe en el catálogo verificado, cuando intento guardar, entonces se rechaza | "Ese código no aparece en el Código de Tránsito. Revísalo." |
| CA-09.4 | Registro manual | Dado que no tengo foto o el OCR falla, cuando elijo "Escribir los datos", entonces puedo registrar todo a mano | Comparendo guardado igual que con foto |

### HU-10 · Entender mi infracción
**Como** conductor, **quiero** saber qué significa el código de mi comparendo y cuánto cuesta, **para** decidir qué hacer.

| Id | Criterio | Dado / Cuando / Entonces | Resultado esperado |
|---|---|---|---|
| CA-10.1 | Explicación | Dado un comparendo guardado, cuando abro su detalle, entonces veo la descripción de la infracción en palabras sencillas y su artículo | Texto sencillo + texto literal desplegable |
| CA-10.2 | Valor de referencia (refinado 2026-11-08, ver refinamiento) | Dado un comparendo guardado, cuando veo el valor, entonces aparece con su unidad, su vigencia y su fuente. Se divide en dos partes: (a) la sanción en su unidad legal con su fuente y remisión a SIMIT; (b) el valor en pesos del año, bloqueado hasta verificar el valor de la UVB 2026 (resolución de MinHacienda) | (a) Sanción en su unidad legal, fuente con fecha de consulta y "Confirma en SIMIT". (b) "Valor de referencia para AAAA según [fuente]": bloqueado hasta verificar la UVB 2026 |

### HU-11 · Saber hasta cuándo puedo actuar
**Como** conductor, **quiero** que la app calcule mi fecha límite, **para** no perder el derecho a impugnar.

| Id | Criterio | Dado / Cuando / Entonces | Resultado esperado |
|---|---|---|---|
| CA-11.1 | Comparendo en vía (refinado 2026-11-08, ver refinamiento) | Dado un comparendo en vía del viernes 13 nov 2026, cuando calculo, entonces se cuentan 5 días hábiles desde el día siguiente. La app no acepta fechas de infracción futuras: la prueba fija el reloj en el 13 nov 2026 | Fecha límite: lunes 23 nov 2026 (el 16 nov es festivo) |
| CA-11.2 | Fotodetección (refinado 2026-11-08, ver refinamiento) | Dado un comparendo por fotodetección recibido (comparendo o notificación) en mi dirección del RUNT el viernes 13 nov 2026, cuando calculo, entonces se cuentan 11 días hábiles desde el día siguiente al recibo (art. 8 de la Ley 1843 de 2017). Si el día del recibo cuenta o no requiere revisión jurídica. La app no acepta fechas futuras: la prueba fija el reloj en el 13 nov 2026 | Fecha límite: martes 1 dic 2026 |
| CA-11.3 | Fecha de recibo explícita (refinado 2026-11-08, ver refinamiento) | Dado un comparendo por fotodetección, cuando lo registro, entonces la app pregunta la fecha en que **recibí el comparendo o la notificación** en mi dirección (no la de la infracción) | Pregunta con explicación; el cálculo dice qué fecha usó |
| CA-11.4 | Días restantes | Dado un caso con fecha límite, cuando lo abro, entonces veo los días hábiles restantes | "Te quedan N días hábiles" o "El plazo venció el …" |

*Las cifras de 5 y 11 días hábiles y su punto de partida se toman de los artículos verificados en la base normativa (art. 136 de la Ley 769 de 2002, con sus modificaciones, y art. 8 de la Ley 1843 de 2017). Si la verificación muestra otra cosa, se corrige el criterio y se registra en refinamiento.*

*Refinado 2026-11-08: el art. 8 de la Ley 1843 cuenta los 11 días hábiles "a partir del recibo del comparendo en la última dirección registrada por el propietario del vehículo" en el RUNT, no desde la "notificación". El caso de prueba da la misma fecha (1 dic 2026). Si el día del recibo contara como día 1, daría lunes 30 nov 2026: requiere revisión jurídica (ver `docs/pendientes-verificacion.md`).*

### HU-12 · Recordatorios de plazo
**Como** conductor, **quiero** que la app me avise antes de que venza el plazo, **para** no olvidarlo.

| Id | Criterio | Dado / Cuando / Entonces | Resultado esperado |
|---|---|---|---|
| CA-12.1 | Aviso anticipado | Dado un caso cuyo plazo vence en 2 días hábiles o menos, cuando abro la app, entonces veo una alerta destacada | Alerta en el inicio que lleva al caso |
| CA-12.2 | Día límite | Dado que hoy es el día límite, cuando abro la app, entonces la alerta lo dice | "Hoy vence tu plazo para …" |

---

## Módulo 6 · Documentos

### HU-13 · Generar la solicitud de audiencia
*Pospuesta para la entrega final (ver `docs/refinamiento-historias.md`). Los criterios se conservan.*

**Como** conductor que no está de acuerdo con el comparendo, **quiero** generar la solicitud de audiencia en PDF, **para** radicarla a tiempo.

| Id | Criterio | Dado / Cuando / Entonces | Resultado esperado |
|---|---|---|---|
| CA-13.1 | Vista previa (pospuesto para la entrega final) | Dado un caso con comparendo completo, cuando toco "Generar solicitud", entonces veo la vista previa | PDF con mis datos, los del comparendo, la lista de evidencias y la norma citada |
| CA-13.2 | Datos faltantes (pospuesto para la entrega final) | Dado que falta un dato obligatorio (por ejemplo, la cédula), cuando intento generar, entonces no se genera | La app dice qué falta y me lleva a completarlo |
| CA-13.3 | Descarga (pospuesto para la entrega final) | Dado que reviso la vista previa, cuando toco "Descargar", entonces obtengo el PDF | Archivo `solicitud-audiencia-<numero>.pdf` |

---

## Módulo 7 · Historial y privacidad

### HU-14 · Mis casos
*Pospuesta para la entrega final (ver `docs/refinamiento-historias.md`). Los criterios se conservan.*

**Como** conductor, **quiero** ver todos mis casos ordenados por urgencia, y poder exportarlos o borrarlos, **para** tener el control de mi información.

| Id | Criterio | Dado / Cuando / Entonces | Resultado esperado |
|---|---|---|---|
| CA-14.1 | Orden por urgencia (pospuesto para la entrega final) | Dado que tengo varios casos, cuando abro "Mis casos", entonces aparecen primero los de plazo más próximo | Cada caso con estado y días restantes |
| CA-14.2 | Exportar (pospuesto para la entrega final) | Dado un caso, cuando toco "Exportar", entonces descargo un archivo con el caso y sus evidencias | ZIP con JSON y archivos |
| CA-14.3 | Borrar caso (pospuesto para la entrega final) | Dado un caso, cuando toco "Borrar" y confirmo, entonces se elimina de forma definitiva | El caso ya no aparece y sus datos ya no están en IndexedDB |
| CA-14.4 | Borrar todo (pospuesto para la entrega final) | Dado que estoy en Ajustes, cuando elijo "Borrar todos mis datos" y confirmo con el PIN, entonces la app vuelve al estado inicial | Pantalla de bienvenida; IndexedDB vacío |

---

## Requisitos no funcionales que se verifican en la evaluación
- **RNF-01 · Privacidad.** Al servidor solo viaja el texto de la pregunta. Se verifica con la pestaña Network de Playwright: la petición a `/api/asistente` no contiene nombre, ubicación ni audio.
- **RNF-02 · Tiempo de respuesta.** En modo verificado, el p95 es menor a 1,5 s desde Vercel. Se mide en `npm run eval:asistente`.
  - La meta de 4 s con LLM de la formulación queda pendiente de la PoC con el modelo en RunPod y se declara así.
- **RNF-03 · Precisión del asistente.** Sobre `data/banco-evaluacion.json` (construido por el equipo, con la respuesta esperada y el artículo esperado de cada pregunta), se miden:
  - citas pertinentes ≥ 95 %;
  - abstenciones correctas ≥ 90 %.
