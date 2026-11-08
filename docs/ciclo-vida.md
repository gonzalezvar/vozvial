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

## 4. Evaluación

## 5. Refinamiento

## 6. Entrega
