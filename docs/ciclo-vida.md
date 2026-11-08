# Ciclo de vida del prototipo aplicado a VozVial

Este documento registra **lo que se hizo** en cada etapa del ciclo de vida del prototipo, con fecha, decisiones y problemas. No contiene definiciones.

## 1. Recolección de requisitos

### 2026-11-08 · Fase 0 · Plan
- **Qué se hizo:** se leyeron `CLAUDE.md`, `docs/historias-usuario.md` (14 historias, 49 criterios) y `docs/base-normativa.md`. Se inicializó el repositorio git y se escribió `docs/plan.md` con el orden de construcción por historia, 12 riesgos técnicos y su mitigación. Se crearon este documento y `docs/refinamiento-historias.md`.
- **Decisiones:**
  - La base normativa y el dominio se construyen antes que las pantallas, porque casi todas las historias dependen de ellos.
  - Esquema de clave envuelta (clave de datos cifrada con el PIN y con el código de recuperación) para que CA-03.1 sea posible sin perder los casos.
  - Tiempos de bloqueo e inactividad configurables por variable de entorno solo para las pruebas.
- **Problemas:** el reconocimiento de voz del navegador no funciona en todos los navegadores y, en Chrome, el audio lo procesa Google. Se declara en la app y se ofrece siempre la opción de escribir.

### 2026-11-08 · Fase 2 · Base normativa
- **Qué se hizo:**
  - Seis agentes descargaron con `curl` las páginas oficiales de cada norma. Las fuentes fueron la Secretaría del Senado, Función Pública, MinTransporte y los decretos en PDF de Presidencia.
  - Los HTML crudos quedaron guardados en `data/fuentes/` para responder "¿de dónde sale esto?".
  - El texto literal se extrajo con scripts y no a mano.
  - Otros seis agentes, que buscaban errores a propósito, volvieron a descargar cada fuente y compararon palabra por palabra.
  - Resultado: 39 entradas, 35 verificadas, 108 infracciones del art. 131, 11 parámetros (8 verificados), 45 preguntas verificadas y un banco de 60 preguntas (40 con sustento, 10 sin sustento, 10 fuera de tema).
  - Todo lo que quedó sin verificar está en `docs/pendientes-verificacion.md`.
- **Decisiones:**
  - Las notas de vigencia de la fuente no van dentro de `texto_literal`; van en `notas`.
  - `verificado_por` dice que la verificación fue automatizada y que falta la revisión humana de Juan.
  - Los plazos para pagar con descuento quedaron `verificado: false`, porque el texto dice "días" sin decir "hábiles".
- **Problemas encontrados:**
  - **Unidad de la multa:**
    - Desde 2024 la unidad es la UVB (art. 313 de la Ley 2294 de 2023), no el SMDLV.
    - El valor 2026 de la UVB sale de una resolución de MinHacienda que no se pudo descargar.
    - Por eso ninguna infracción tiene valor en pesos, lo que afecta a CA-10.2.
  - **Fotodetección (CA-11.2 y CA-11.3):**
    - El art. 8 de la Ley 1843 cuenta los 11 días hábiles "a partir del recibo del comparendo" en la dirección del RUNT, no desde la "notificación".
    - La fecha del caso de prueba coincide (1 dic 2026), pero cambia el concepto. Requiere revisión jurídica.
  - **Derecho a grabar (CA-07.3):** el art. 21 de la Ley 1801 habla de "procedimiento policivo" y no menciona a los agentes de tránsito civiles.
  - **Día hábil:** ninguna norma de la base define "día hábil". Excluir sábados, domingos y festivos queda como decisión pendiente de sustento.
  - **Festivo del 9 de julio:** la Ley 2578 de 2026 agrega un festivo el 9 de julio, que quedó "en revisión".

## 2. Diseño rápido

### 2026-11-08 · Fase 1 · Base del proyecto, sistema visual y wireframes
- **Qué se hizo:**
  - App Expo SDK 58 con Expo Router y TypeScript estricto (`noUncheckedIndexedAccess`).
  - Pruebas y calidad: Jest con dos proyectos (dominio en Node con WebCrypto y app con `jest-expo`), Playwright con Pixel 7, axe y ESLint.
  - Servidor local del asistente (puerto 3001) y servidor e2e que sirve la app y `/api/asistente` en el mismo origen, como en Vercel.
  - `vercel.json` con cabeceras de seguridad y una CSP que bloquea scripts de terceros. No se desplegó nada.
  - Sistema visual en `src/ui/`:
    - todos los pares de color cumplen WCAG AA; el más bajo es 5,56:1 y lo comprueba una prueba;
    - tres tamaños de letra, 18/22/26 px, que se conservan al volver a entrar;
    - botones de 56 px como mínimo;
    - componentes `BotonEscuchar`, `TarjetaCita` y `AvisoLegal`.
  - Wireframes navegables de las 7 secciones, con los datos de ejemplo marcados como "Ejemplo".
  - 26 capturas en `docs/diseno-rapido/`.
- **Decisiones:**
  - "Acerca del prototipo" y "Política de datos" quedan fuera de la sesión, porque se enlazan desde el registro.
  - Se usan rutas relativas en vez del alias `@/`, porque el resolver de ESLint de Expo no lo soporta.
  - Se usa ESLint 9, porque la versión 10 rompe `eslint-plugin-react`.
- **Problemas:**
  - La primera revisión con axe encontró violaciones serias (`label-content-name-mismatch`): la etiqueta del botón "Me pararon" decía "registrar" y el botón decía "grabar". Se corrigieron y quedaron 0 violaciones.
  - Chromium sin interfaz no lee en voz alta, así que el e2e de "Escuchar" solo comprueba la llamada. La voz real se muestra en el video.

## 3. Construcción

### 2026-11-08 · Fase 3 · Dominio orientado a objetos
- **Qué se hizo:** clases TypeScript puras en `src/core/`, sin React, con WebCrypto inyectado. Se escribieron en cuatro bloques en paralelo y después se integraron:
  - **Tiempo:** `FechaCivil`, `FestivosColombia` (Ley 51 de 1983 más el cálculo de la Pascua), `ParametrosPlazos` y `CalculadoraPlazos`.
  - **Seguridad:** `ValidadorRegistro`, `ServicioCredenciales` (PBKDF2-SHA256, 600 000 iteraciones), `ControlIntentos`, `GestorClaves` y `CodigoRecuperacion`.
  - **Casos:** `Caso`, `Evidencia`, `Comparendo`, `ParserComparendo`, `CatalogoInfracciones` y `GeneradorSolicitud`.
  - **Asistente:** `NormalizadorEspanol`, `BaseNormativa`, `ProveedorRespuesta` con dos implementaciones (`ProveedorVerificado` y `ProveedorLLM`), `DetectorTema` y `AsistenteNormativo`. También la interfaz `ProveedorVoz`.
  - **Clave envuelta:** una clave de datos AES-GCM que se cifra con el PIN y también con el código de recuperación.
  - **Resultado:** 31 suites y 320 pruebas unitarias pasan; typecheck y lint están limpios.
- **Decisiones:**
  - `FechaCivil` propia para no depender de los husos horarios de `Date`.
  - Los plazos salen de `parametros.json`, no de constantes en el código.
  - Con el `parametros.json` real, la calculadora da las 5 filas de la tabla de `docs/base-normativa.md`.
  - `AsistenteNormativo` valida cada cita contra la base: mismo texto y misma URL. Si una cita no coincide, se abstiene.
  - Una prueba verifica que `src/core` no importa React ni Expo.
- **Problemas:**
  - **Asistente con el banco de evaluación:** la primera evaluación dio 0 de 40 citas pertinentes y 39 de 40 falsas abstenciones con el umbral de 0,85. Las abstenciones correctas y las de fuera de tema dieron 10 de 10 cada una.
    - Causa: el banco está redactado distinto a las preguntas verificadas, a propósito para no evaluar con lo mismo, y el umbral es estricto.
    - Este hallazgo va a la etapa de evaluación y refinamiento.
  - **Límite del PIN:** un PIN de 6 dígitos tiene solo 10⁶ combinaciones. Con el hash, alguien podría probarlas todas sin conexión. CA-01.6 se cumple (el PIN no está en claro), pero el límite se declara.

### 2026-11-08 · Fase 4 · Módulos 1, 3, 4 y 5 en paralelo
- **Qué se hizo:**
  - Primero un agente de infraestructura dejó la base común: `AlmacenCifrado` (IndexedDB con AES-GCM y la clave de datos envuelta con el PIN y con el código de recuperación), `ServicioCuenta`, `RepositorioCasos`, la sesión en memoria con cierre por inactividad, los layouts y `e2e/utilidades.ts`. Sus pruebas unitarias usan `fake-indexeddb` y comprueban que en el almacén no aparecen el PIN, el nombre ni el texto de una nota.
  - Después, cuatro agentes construyeron en paralelo los módulos 1 (cuenta y acceso, HU-01 a HU-03), 3 (asistente, HU-05, HU-06 y RNF-01), 4 (Me pararon y evidencias, HU-07 y HU-08) y 5 (comparendo y plazos, HU-09 a HU-12). Cada uno con una prueba e2e por criterio, con el id en el nombre, y su captura en `evidencias/`.
  - Los wireframes de la etapa 2 se reemplazaron por pantallas reales conectadas al dominio de `src/core/`.
  - OCR del comparendo con tesseract.js autoalojado en `public/tesseract/` (worker, núcleo WASM y modelo `spa`): la CSP no permite CDN y la foto no sale del celular. Solo se probó con imágenes sintéticas (`e2e/fixtures/comparendo-prueba.png`).
  - Reporter `e2e/reporter-matriz.ts` que escribe `docs/evaluacion/matriz-criterios.md` y prueba `e2e/axe.spec.ts` sobre 10 pantallas (CA-04.3).
  - Revisores que buscaban errores a propósito, uno por módulo, revisaron cada "Cumple" débil y corrigieron pruebas y pantallas.
- **Decisiones:**
  - Para que varias suites corrieran a la vez sin pisarse se escribió `scripts/e2e-aislado.sh <nombre> <puerto> <specs>`: cada agente usa su propio build (`dist-<nombre>`), su puerto y su carpeta de resultados. `scripts/build-e2e.sh` serializa los builds con `flock` sobre `.cache/` para que dos builds simultáneos no choquen en la caché de Metro.
  - El build e2e inyecta tiempos cortos (bloqueo de 3 s, inactividad de 5 s y 1000 iteraciones PBKDF2). La app real usa 5 min, 10 min y 600 000.
  - La matriz acumula resultados por criterio en `docs/evaluacion/resultados-e2e.json`, así cada suite actualiza solo sus criterios.
  - Los módulos 2 (salvo axe), 6 y 7 no se priorizaron para el prototipo.
- **Problemas reales:**
  - **Carga diferida de rutas.** Con la carga diferida de Expo Router (`asyncRoutes`), cada pantalla se descarga la primera vez que se abre; sin red, una pantalla todavía no visitada no abriría, y CA-06.5 promete accesos a lo que funciona sin conexión. Se puso `"asyncRoutes": false` en `app.json` para que todas las rutas vayan en el paquete inicial. Aun así no hay service worker: si se recarga sin internet, la app no abre.
  - **Suite de diseño rápido.** `e2e/diseno-rapido.spec.ts` recorría los wireframes y, al volverse reales las pantallas, sobrescribía las capturas históricas de `docs/diseno-rapido/`. Se desactivó en la suite normal y solo corre con `DISENO_RAPIDO=1`. Por eso `npm run e2e` muestra 14 pruebas omitidas.
  - **Fechas futuras.** El formulario del comparendo rechaza fechas posteriores a hoy. Los ejemplos de CA-11.1 y CA-11.2 son del 13 nov 2026, así que sus pruebas fijan el reloj en ese día. El fixture del comparendo trae 13/11/2026: antes de esa fecha no se puede guardar a mano tal cual.
  - **Tiempos de e2e.** La suite completa (`npm run e2e`) tarda unos 2 minutos en este computador: 45 pruebas pasan y 14 se omiten. Una suite aislada pequeña (hu06 y axe, 6 pruebas) tarda unos 22 s. Corren con un solo worker (`workers: 1` en `playwright.config.ts`).

## 4. Evaluación

### 2026-11-08 · Evaluación con la matriz, axe y el banco del asistente
- **Qué se hizo:**
  - **Matriz de criterios** (`docs/evaluacion/matriz-criterios.md`, generada por Playwright): 50 criterios (49 de las historias y RNF-01). **40 Cumple, 1 Cumple parcialmente (CA-10.2), 0 No cumple y 9 Sin prueba** (CA-04.1, CA-04.2, CA-13.1 a CA-13.3 y CA-14.1 a CA-14.4).
  - **Accesibilidad** (`docs/evaluacion/axe-reporte.md`): axe con `wcag2a` y `wcag2aa` en 10 pantallas (bienvenida, registro, entrar, inicio, asistente, Me pararon, Mis casos, registrar comparendo, ajustes y acerca): **0 violaciones** críticas, serias, moderadas o menores. axe no reemplaza una revisión con lector de pantalla.
  - **Asistente, medición ANTES** (`npm run eval:asistente`, umbral 0,85, 45 preguntas verificadas, banco de 60):
    - citas pertinentes 0/40 (0 %), meta ≥ 95 %: **No cumple**;
    - abstenciones correctas 10/10 (100 %), meta ≥ 90 %: **Cumple**;
    - fuera de tema 10/10; falsas abstenciones 39/40; citas no pertinentes 0/40; con sustento marcadas fuera de tema 1/40;
    - la pertinente queda en primer lugar, sin umbral, en 21/40;
    - p50 1,07 ms y p95 2,45 ms en local, en proceso y sin red.
- **Hallazgos que pasan a refinamiento:**
  - CA-10.2 no puede mostrar el valor en pesos de 2026: la UVB 2026 no está verificada.
  - CA-11.2 y CA-11.3 hablan de "notificación", pero el art. 8 de la Ley 1843 cuenta desde el "recibo del comparendo".
  - CA-07.3 se apoya en el art. 21 de la Ley 1801, que habla de "procedimiento policivo".
  - CA-06.5 solo vale con la app ya abierta.
  - El asistente se abstiene casi siempre que la pregunta usa otras palabras.
- **Lo que no se pudo evaluar:** RNF-02 desde Vercel (no se ha desplegado) y la voz real (Chromium sin interfaz no habla; se muestra en el video).


## 5. Refinamiento

### 2026-11-08 · Refinamiento de criterios y del asistente
- **Criterios aclarados** (detalle, motivo y evidencia en `docs/refinamiento-historias.md`; en `docs/historias-usuario.md` quedan marcados "(refinado 2026-11-08, ver refinamiento)"):
  - CA-11.2 y CA-11.3: los 11 días hábiles se cuentan desde el recibo del comparendo en la dirección del RUNT. Si el día del recibo cuenta queda marcado como "requiere revisión jurídica".
  - CA-10.2: se divide en (a) sanción en su unidad legal con fuente y remisión a SIMIT, que cumple, y (b) valor en pesos del año, bloqueado hasta verificar la UVB 2026. Sigue "Cumple parcialmente".
  - CA-07.3: el derecho a grabar se sustenta en el art. 21 de la Ley 1801 y su aplicación a agentes de tránsito civiles requiere revisión jurídica. La pantalla Me pararon muestra el resumen verificado y la cita, pero **no** muestra esa advertencia; la advertencia está en las respuestas PV-002 y PV-003 del asistente. Agregarla a la pantalla queda para la entrega final.
  - CA-06.5: vale con la app ya abierta (no hay service worker).
  - CA-11.1 y CA-11.2: la app rechaza fechas futuras y las pruebas usan reloj fijo.
  - HU-04 (CA-04.1 y CA-04.2), HU-13 y HU-14: pospuestas para la entrega final, sin borrar sus criterios.
- **Refinamiento del asistente:**
  - Diagnóstico de 40 errores: el puntaje premiaba casi solo las palabras de las preguntas verificadas, faltaba raíz de las palabras, "inspector" se trataba como "agente" y varios artículos verificados no tenían pregunta.
  - Cambios generales en `NormalizadorEspanol`, `ProveedorVerificado` y `DetectorTema`, y 4 preguntas verificadas nuevas (PV-046 a PV-049). Umbral, margen y pesos se calibraron sin el banco: costo 208 frente a 249 de abstenerse siempre.
- **Reevaluación (DESPUÉS)**, con el mismo banco (umbral 0,85, margen 0, 49 preguntas verificadas):
  - citas pertinentes 0/40 (0 %): **sigue No cumple**;
  - abstenciones correctas 10/10 (100 %): **Cumple**;
  - fuera de tema 10/10; falsas abstenciones 39/40; citas no pertinentes 0/40; con sustento marcadas fuera de tema 1/40;
  - la pertinente queda en primer lugar, sin umbral, en 24/40 (antes 21/40);
  - p50 3,71 ms y p95 6,31 ms en local.
  - Cota informativa, no usada: lo mejor posible en el banco con al menos 90 % de abstenciones correctas es 8/40 con umbral 0,70.
- **Lectura honesta:** el ciclo evaluar → refinar → reevaluar se aplicó de verdad, pero la mejora casi no se ve en las respuestas entregadas. Con búsqueda por palabras la calibración no separa bien lo que tiene sustento de lo que no. Para la entrega final hacen falta más preguntas verificadas revisadas por una persona o un buscador por significado.
- **Pruebas tras el refinamiento:** jest 336/336 (32 suites); e2e del asistente (hu05, hu06 y rnf01) 9/9; `tsc` y `eslint` sin errores. En el cierre se corrió la suite completa y se regeneró la matriz: sigue en 40 Cumple, 1 Cumple parcialmente, 0 No cumple y 9 Sin prueba.
- **Correcciones de cierre:** la pantalla "Acerca del prototipo", el README, el guion, los insumos y la observación de CA-06.1 decían "45 preguntas verificadas"; se cambió a 49. ESLint fallaba al analizar los scripts guardados en `docs/prompts/`, que no son código de la app; se agregaron a sus exclusiones.


## 6. Entrega

### 2026-11-08 · Entrega preparada (sin publicar)
- **Qué se hizo:**
  - `README.md` como manual técnico: estado por módulo con la matriz, diagramas Mermaid de capas, de clases y de secuencia, instalación y comandos, variables de entorno que el código lee de verdad, privacidad (qué se guarda, dónde y cómo se cifra), base normativa y limitaciones.
  - `docs/despliegue.md`: revisión previa, comandos de GitHub y Vercel, comprobaciones con `curl` y medición del p95 con `npm run eval:asistente -- --url`. **No se publicó nada**: lo publica Juan desde su cuenta. La función `api/asistente.ts` nunca se ha compilado en Vercel y RNF-02 sigue sin medir.
  - `docs/guion-video.md`: recorrido criterio por criterio de los módulos 1, 3, 4 y 5 (unos 9,5 minutos). CA-10.2 se presenta como parcial.
  - `docs/insumos-documento.md`: clasificación del prototipo, lo real frente a lo simulado, resumen de este ciclo de vida, resultados con los números finales y la propuesta, no probada, del modo LLM y la transcripción en el servidor.
  - Scripts de orquestación usados con el asistente de programación con IA, guardados en `docs/prompts/`.
  - Limpieza de los builds y resultados aislados (`dist-*`, `test-results-*`, `.cache`).
- **Pendiente para Juan:** publicar en GitHub y Vercel, medir RNF-02 desde Vercel, ver los diagramas Mermaid renderizados en GitHub, cambiar la fecha del fixture a 06/11/2026 si graba antes del 13 nov 2026, confirmar con la app el ejemplo de CA-12.1 del guion, y la revisión jurídica y humana de lo listado en `docs/pendientes-verificacion.md`.

### 2026-11-08 · Publicación
- **Qué se hizo:**
  - Se creó el repositorio privado https://github.com/gonzalezvar/vozvial y se subió el historial completo.
  - Se publicó en Railway: https://vozvial-production.up.railway.app.
  - Se verificaron las rutas, las cabeceras CSP y HSTS, el asistente y la consola del navegador sin errores.
  - Se midió RNF-02 contra el despliegue: p95 de 119 ms.
- **Decisiones:**
  - Railway en lugar de Vercel, porque es la cuenta que tiene el equipo.
  - Un solo servicio Node (`scripts/servidor-produccion.ts`) que reutiliza el servidor de las pruebas e2e, así producción y pruebas sirven la app igual.
  - `.railwayignore` para subir solo lo necesario.
- **Problemas:**
  - La primera subida con `railway up` se cortó por tiempo: subía unos 58 MB con evidencias y fuentes. Se resolvió con `.railwayignore`.
  - Railway no pudo conectarse al repo privado, porque su app de GitHub no tiene acceso. Por eso se despliega desde el equipo local.

