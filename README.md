# VozVial · manual técnico del prototipo

VozVial es una app móvil con asistente de voz para que conductores en Colombia, en especial adultos mayores, entiendan sus derechos frente a un comparendo de tránsito. La app también sirve para registrar lo que pasa durante el procedimiento, calcular los plazos legales y, en la entrega final, generar la solicitud de audiencia.

- Proyecto del curso "Proyecto de software". Este repositorio contiene el **prototipo funcional (actividad 4)**, que será la base de la entrega final (actividad 6).
- Equipo: Juan David González Varilla (líder) y un colaborador.
- Objetivo evaluado: la **web en vista móvil**, hecha con Expo (React Native con salida web) y publicada en Railway con un servidor Node y Postgres.
- Aviso que se ve en la app: "VozVial informa y organiza. No reemplaza a un abogado."

## Contenido

1. [Estado del prototipo](#1-estado-del-prototipo)
2. [Inicio rápido](#2-inicio-rápido)
3. [Cómo probar cada módulo](#3-cómo-probar-cada-módulo)
4. [Stack](#4-stack)
5. [Estructura del proyecto](#5-estructura-del-proyecto)
6. [Arquitectura](#6-arquitectura)
7. [Requisitos e instalación](#7-requisitos-e-instalación)
8. [Variables de entorno](#8-variables-de-entorno)
9. [Comandos y pruebas](#9-comandos-y-pruebas)
10. [Despliegue](#10-despliegue)
11. [Flujo de datos y privacidad](#11-flujo-de-datos-y-privacidad)
12. [Base normativa](#12-base-normativa)
13. [Limitaciones](#13-limitaciones)
14. [Problemas comunes](#14-problemas-comunes)
15. [Documentos del proyecto](#15-documentos-del-proyecto)

## 1. Estado del prototipo

La evaluación se hace con las historias y criterios de `docs/historias-usuario.md`. Cada criterio tiene una prueba e2e con su id en el nombre y una captura en `evidencias/`. La matriz `docs/evaluacion/matriz-criterios.md` se genera sola al correr Playwright.

| Módulo | Historias | Estado |
|---|---|---|
| 1 · Cuenta y acceso | HU-01, HU-02, HU-03 | Completo: 12 de 12 criterios cumplen. CA-02.1 se prueba también entrando desde otro navegador limpio con celular y PIN |
| 2 · Accesibilidad | HU-04 | Parcial. CA-04.3 (axe en 12 pantallas) cumple. CA-04.1 (tamaño de letra) y CA-04.2 (Escuchar) están en la app pero no tienen prueba e2e, así que la matriz los muestra "Sin prueba" |
| 3 · Asistente por voz | HU-05, HU-06 | Completo: 8 de 8 criterios cumplen |
| 4 · Me pararon y evidencias | HU-07, HU-08 | Completo: 7 de 7 criterios cumplen |
| 5 · Comparendo y plazos | HU-09 a HU-12 | Completo: 11 cumplen y 1 cumple parcialmente (CA-10.2, ver abajo) |
| 6 · Documentos | HU-13 | Pospuesto para la entrega final. La pantalla todavía muestra datos de ejemplo marcados "Ejemplo" |
| 7 · Historial y privacidad | HU-14 | Parcial: CA-14.1 (orden por urgencia) y CA-14.4 (borrar todo, en el navegador y en el servidor) cumplen. CA-14.2 (exportar) y CA-14.3 (borrar un caso) quedan para la entrega final |
| RNF-01 · Privacidad | — | Cumple: la petición al asistente solo lleva `{ pregunta }`, y al servidor de datos solo llegan verificadores y datos cifrados (`docs/bd.md`) |
| Guía | — | Recorrido de 5 pasos, ayuda por situación y botón "Ayuda" en cada pantalla, con 6 pruebas e2e propias (`e2e/guia.spec.ts`). No es una historia evaluada |

Resumen de la matriz al 8 de noviembre de 2026: **50 criterios: 42 Cumple, 1 Cumple parcialmente, 0 No cumple, 7 Sin prueba**. Los 7 sin prueba son CA-04.1, CA-04.2, los 3 de HU-13, CA-14.2 y CA-14.3. La suite completa: 55 pruebas pasan, 0 fallan y 0 se omiten, tanto en modo verificado como con la API real de Anthropic (Claude). Además, la suite contra producción (`playwright.produccion.config.ts`) pasa 28 de 28.

**CA-10.2 cumple solo en parte.** El valor en pesos de 2026 no está verificado: la Resolución de MinHacienda con el valor de la UVB no se pudo descargar. Por eso la app muestra la sanción en su unidad legal (por ejemplo, 15 SMDLV) con su fuente y fecha de consulta, y remite a SIMIT. No muestra "Valor de referencia para AAAA". El detalle está en `docs/pendientes-verificacion.md`.

RNF-02 (tiempo de respuesta) y RNF-03 (precisión del asistente) se miden con `npm run eval:asistente`:
- **Modo verificado** (`docs/evaluacion/asistente.md`): RNF-02 cumple (p95 de 119 ms contra Railway); RNF-03 no cumple (0 de 40 citas pertinentes: se abstiene con otras palabras).
- **Con Claude, el modo que corre en producción** (`docs/evaluacion/asistente-claude.md`): RNF-03 **cumple**, con 40 de 40 citas pertinentes (100 %), 10 de 10 abstenciones correctas, 10 de 10 fuera de tema y 0 respaldos al modo verificado. El p50 es de 2,2 s y el p95 de 7,8 s: RNF-02 se definió para el modo verificado y con Claude la meta de 1,5 s no se alcanza.

## 2. Inicio rápido

### Sin instalar nada

Abre https://vozvial-production.up.railway.app en el celular o en Chrome con vista móvil. Puedes crear una cuenta propia o entrar con una de las cuentas de demostración de [`docs/usuarios-demo.md`](docs/usuarios-demo.md) (datos ficticios y públicos): toca "Ya tengo cuenta", escribe el celular y el PIN de la tabla y verás sus casos con plazos cargados.

### En tu computador

Necesitas Node.js 22 y npm (ver [Requisitos](#7-requisitos-e-instalación)).

```bash
git clone https://github.com/gonzalezvar/vozvial.git
cd vozvial
npm ci
cp .env.example .env        # opcional: pon tu ANTHROPIC_API_KEY para usar Claude
npm run build               # compila la web a dist/ y revisa que el SDK de Anthropic no quede en ella
```

Elige cómo arrancar:

| Quieres | Comando | Abre |
|---|---|---|
| La app como en producción, con el asistente en modo verificado y la base en memoria | `npm start` | http://localhost:4173 |
| Lo mismo, pero con el asistente de Claude (lee tu `.env`) | `set -a; . ./.env; set +a; npm start` | http://localhost:4173 |
| Con las 3 cuentas de demostración y los datos guardados en disco | `npx tsx scripts/sembrar-demo.ts --pglite .datos-locales --sin-doc` y luego `set -a; . ./.env; set +a; PGLITE_DIR=.datos-locales npm start` | http://localhost:4173/entrar |
| Desarrollar con recarga en caliente | `npm run api` en una terminal y `EXPO_PUBLIC_API_URL=http://localhost:3001 npm run web` en otra | http://localhost:8081 |

- Usa `localhost`, no la IP de tu red: WebCrypto solo funciona en un contexto seguro y sin él no se puede crear la cuenta.
- Para verla como en un celular: Chrome, DevTools (F12), "Toggle device toolbar" y elige Pixel 7.
- `npm start` sin `PGLITE_DIR` guarda la base en memoria: al detenerlo se borran las cuentas del servidor (las del navegador siguen en IndexedDB).
- La semilla es idempotente: si la vuelves a correr, recrea las cuentas demo con fechas calculadas ese día. PGlite no admite dos procesos a la vez sobre la misma carpeta: corre la semilla con el servidor detenido.

### Comprobar que todo funciona

```bash
npm run typecheck && npm run lint && npm test   # tipos, estilo y 503 pruebas unitarias
npx playwright install chromium                 # solo la primera vez
npm run e2e                                     # 55 pruebas e2e, capturas en evidencias/ y matriz en docs/evaluacion/
```

## 3. Cómo probar cada módulo

Recorrido a mano en la app (local o publicada), en el orden de las historias. Cada criterio tiene además su prueba automática y su captura en `evidencias/CA-xx.y.png`.

| Módulo | Qué hacer | Qué debe pasar |
|---|---|---|
| 1 · Crear cuenta (HU-01) | "Crear mi cuenta": deja un campo vacío, escribe un celular de 9 dígitos y un PIN como 123456; luego llénalo bien y marca la autorización | Cada error se marca y se lee en voz alta; con datos válidos aparece el código de recuperación de 12 caracteres con "Escuchar" |
| 1 · Entrar (HU-02) | Entra con tu PIN; escribe un PIN equivocado 5 veces; deja la app quieta 10 minutos; abre la app en otro navegador y entra con celular y PIN | Entras al inicio con tu nombre; al quinto error se bloquea 5 minutos; la sesión se cierra por inactividad; en el otro navegador ves tus mismos casos |
| 1 · Recuperar (HU-03) | "Olvidé mi PIN" con el código de recuperación | Pones un PIN nuevo y tus casos siguen ahí |
| 2 · Accesibilidad (HU-04) | Ajustes, tamaño de letra "Muy grande"; "Escuchar" en cualquier pantalla | Toda la app crece; la pantalla se lee en voz alta |
| 3 · Asistente (HU-05 y HU-06) | "Preguntar": toca "Hablar" (Chrome) o escribe "¿Cuántos días tengo para pedir audiencia?"; prueba también "¿Qué día tengo pico y placa?" y "¿Cómo hago un sancocho?" | Ves "Esto entendí" con Enviar y Corregir; la respuesta trae norma, artículo y enlace, y al tocar la cita ves el texto literal y la fecha de consulta; sin sustento se abstiene; fuera de tema lo dice; siempre aparece el aviso legal |
| 3 · Sin conexión (CA-06.5) | Con la app abierta, quita el internet y entra a "Preguntar" | Avisa que el asistente necesita internet y ofrece lo que sí funciona |
| 4 · Me pararon (HU-07) | Toca "Me pararon" y permite micrófono y ubicación; toca "Terminar" | Empieza a grabar con contador; se guardan fecha, hora y ubicación; ves tus derechos verificados con su artículo; el audio queda en el caso |
| 4 · Evidencias (HU-08) | En un caso, agrega una foto y una nota dictada o escrita | Quedan con fecha y hora; en IndexedDB todo está cifrado (DevTools, Application, IndexedDB, `vozvial`) |
| 5 · Comparendo (HU-09 y HU-10) | "Registrar un comparendo", "Tomar foto del comparendo" con `e2e/fixtures/comparendo-prueba.png` (imagen de prueba con datos inventados); o "Escribir los datos" | Se llenan número, fecha, placa y código; lo dudoso se resalta; un código inexistente se rechaza; el detalle explica la infracción con su artículo y la sanción en SMDLV |
| 5 · Plazos y recordatorios (HU-11 y HU-12) | Registra un comparendo en vía o por fotodetección con fecha reciente; entra con la cuenta demo de Rosa | Ves la fecha límite en días hábiles con festivos y la fecha que se usó; en el inicio aparece la alerta "Tu plazo vence pronto" |
| 7 · Mis casos y borrar (HU-14) | "Mis casos"; luego Ajustes, "Borrar todos mis datos" con tu PIN | Los casos salen ordenados por urgencia; al borrar vuelves a la bienvenida y la cuenta ya no existe en el servidor |
| Guía | En la bienvenida, "¿Cómo funciona?"; en cualquier pantalla, "Ayuda" | Recorrido de 5 pasos con Escuchar; ayuda de la pantalla y guías por situación |

El módulo 6 (solicitud en PDF), exportar y borrar un caso quedan para la entrega final: la pantalla de solicitud muestra datos de ejemplo marcados "Ejemplo".

## 4. Stack

| Capa | Tecnología | Versión |
|---|---|---|
| App | Expo con Expo Router, salida web | Expo 58, React 19.3, React Native 0.88 |
| Lenguaje | TypeScript estricto | 6.0 |
| Estado | zustand | 5.1 |
| Persistencia en el navegador | IndexedDB con `idb` | 8.0 |
| Cifrado | WebCrypto: PBKDF2 y AES-GCM | del navegador |
| Voz | Web Speech API (`es-CO`) y `expo-speech` | del navegador |
| OCR | `tesseract.js` con modelo `spa`, autoalojado | 7.0 |
| Búsqueda (modo verificado) | `minisearch` con normalización de español | 7.2 |
| PDF (entrega final) | `pdf-lib` | 1.17 |
| Servidor | Node con `tsx`, sin framework | Node 22 |
| Base de datos | Postgres con `pg` en producción; PGlite en local y pruebas | `pg` 8.23, PGlite 0.5 |
| Asistente | API de Anthropic con `@anthropic-ai/sdk`, modelo `claude-opus-5-5` | SDK 1.6 |
| Pruebas | Jest con `jest-expo`; Playwright con Pixel 7; `@axe-core/playwright` | Jest 30, Playwright 1.65 |
| Despliegue | Railway (Railpack) con Postgres | — |

## 5. Estructura del proyecto

```
app/                    pantallas (Expo Router)
  (publico)/            bienvenida, registro, código de recuperación, entrar, recuperar, guía, privacidad, acerca
  (app)/                con sesión: inicio, asistente, me-pararon, casos, comparendo, solicitud, ayuda, ajustes
  +not-found.tsx        pantalla para rutas que no existen
api/asistente.ts        endpoint POST /api/asistente
src/core/               dominio orientado a objetos, sin React (lo comparten la app y el servidor)
src/services/           adaptadores del navegador: almacén cifrado, cuenta, sincronización, voz, OCR, audio, fotos, ubicación
src/state/              estado con zustand: sesión en memoria, casos, ajustes, sincronización
src/servidor/           solo servidor: ProveedorClaude, base de datos (bd/), cuentas, rutas de la API de datos, límites, semilla
src/ui/                 sistema de diseño accesible, componentes y guía (guia/)
data/                   base normativa verificada, infracciones, preguntas verificadas, banco de evaluación y fuentes crudas
public/tesseract/       worker, núcleo WASM y modelo en español del OCR
scripts/                servidores (desarrollo, e2e y producción), evaluación del asistente, semilla demo, verificación del bundle
tests/unit/             pruebas unitarias (Jest)
e2e/                    pruebas e2e (una por criterio), utilidades, reporter de la matriz y suite de producción (produccion/)
evidencias/             capturas que generan las pruebas e2e (CA-xx.y.png) y las de producción (produccion/)
docs/                   historias, base normativa, ciclo de vida, refinamiento, evaluación, base de datos, despliegue, usuarios demo
```

## 6. Arquitectura

### 2.1 Capas

```mermaid
flowchart TD
  subgraph NAV["Navegador del celular"]
    APP["app/ · pantallas Expo Router"]
    UI["src/ui/ · componentes accesibles y tema"]
    STATE["src/state/ · zustand: sesión en memoria, casos, ajustes"]
    SERV["src/services/ · adaptadores de plataforma"]
    CORE["src/core/ · dominio orientado a objetos, sin React"]
    IDB[("IndexedDB 'vozvial' · datos cifrados (copia principal)")]
    LS[("localStorage · solo el tamaño de letra")]
    TESS["public/tesseract/ · OCR autoalojado"]
  end
  subgraph VER["Servidor Node en Railway (scripts/servidor-produccion.ts)"]
    API["api/asistente.ts"]
    SRV["src/servidor/ · ProveedorClaude (solo servidor)"]
    RUT["src/servidor/rutas.ts · cuentas, sesiones, casos y evidencias"]
    CORESRV["src/core/ · AsistenteNormativo"]
  end
  PG[("Postgres · solo verificadores y datos cifrados")]
  ANT["API de Anthropic · Claude (solo si hay ANTHROPIC_API_KEY)"]
  DATA[("data/ · base normativa JSON verificada")]

  APP --> UI
  APP --> STATE
  APP --> SERV
  STATE --> SERV
  SERV --> CORE
  SERV --> IDB
  UI --> LS
  SERV --> TESS
  SERV -- "POST { pregunta }" --> API
  SERV -- "verificador del PIN y datos ya cifrados" --> RUT
  RUT --> PG
  API --> SRV
  API --> CORESRV
  SRV -- "texto de la pregunta + base verificada" --> ANT
  CORE --> DATA
  CORESRV --> DATA
```

- **`app/`** solo orquesta: lee el estado, llama a los servicios y muestra el resultado.
  - Rutas públicas en `app/(publico)/`: bienvenida, registro, código de recuperación, entrar, recuperar, guía, privacidad y acerca.
  - Rutas con sesión en `app/(app)/`: inicio, asistente, me-pararon, casos, comparendo, solicitud, ayuda y ajustes.
- **`src/core/`** guarda la lógica de dominio en clases TypeScript puras. Una prueba unitaria verifica que no importa React ni Expo. La comparten la app y el servidor.
- **`src/services/`** adapta el navegador al dominio:
  - `AlmacenCifrado` (IndexedDB), `ServicioCuenta`, `RepositorioCasos`;
  - `ClienteCuentas`, `ClienteSincronizacion` y `SincronizadorCasos`: registro y entrada en el servidor, y subida y bajada de casos y evidencias ya cifrados;
  - `ProveedorVozWeb` y `ProveedorTexto`, `ServicioLecturaVoz` (`expo-speech`);
  - `GrabadorAudio` (MediaRecorder), `ServicioFotos`, `ServicioUbicacion`;
  - `ServicioOCR` (tesseract.js), `ServicioPlazos`, `ClienteAsistente`, `ServicioConectividad`, `RegistroMePararon`.
- **`api/asistente.ts`** es el endpoint `POST /api/asistente`. Usa `crearAsistenteServidor()` de `src/servidor/`: con `ANTHROPIC_API_KEY` arma el asistente con Claude; sin ella usa `crearAsistente()` de `src/core/cargarDatos.ts`, el mismo código que corre en las pruebas.
- **`src/servidor/`** guarda el código que solo corre en el servidor: `ProveedorClaude` y `crearAsistenteServidor`, la base de datos (`bd/`, con `pg` o PGlite), las rutas de cuentas y datos cifrados (`rutas.ts`), los límites por IP y la semilla de demostración. El protocolo completo está en [`docs/bd.md`](docs/bd.md). Importa `@anthropic-ai/sdk`, por eso nada de la app lo importa (Metro lo metería en el bundle web). Hay dos comprobaciones:
  - la prueba unitaria "el SDK de Anthropic no llega a la app" (`tests/unit/servidor/ProveedorClaude.test.ts`) revisa que ningún archivo de `app/` ni de `src/` fuera de `src/servidor/` importe el SDK;
  - `scripts/verificar-bundle.ts` corre al final de `npm run build`, `npm run build:web` y del build de e2e (`scripts/build-e2e.sh`), y falla si algún archivo del build contiene `@anthropic-ai`, `api.anthropic.com`, `anthropic-version`, `sk-ant-`, `ANTHROPIC_API_KEY` o `<articulos>` (el inicio del prompt del servidor). La palabra "Anthropic" sola sí aparece en la app, porque la política de datos la nombra.
- **`src/ui/guia/`** guarda el contenido de la guía: el recorrido de 5 pasos (`/guia`), las guías por situación (`/ayuda`) y la ayuda de cada pantalla (`AyudaPantalla`).
- **`data/`** guarda la base normativa (`normativa/*.json`), el catálogo `infracciones.json`, `preguntas-verificadas.json`, `banco-evaluacion.json` y las descargas crudas en `fuentes/`.

### 2.2 Clases principales de `src/core/`

```mermaid
classDiagram
  direction LR

  class ProveedorRespuesta {
    <<interface>>
    +modo
    +responder(pregunta) Promise~RespuestaAsistente~
  }
  class ProveedorVerificado {
    +umbral
    +responder(pregunta)
  }
  class ProveedorLLM {
    +configDesdeEntorno(env) ConfigLLM$
    +responder(pregunta)
  }
  class ProveedorClaude {
    +configDesdeEntorno(env) ConfigClaude$
    +parametros(pregunta)
    +responder(pregunta)
  }
  class AsistenteNormativo {
    +responder(pregunta) Promise~RespuestaAsistente~
    -citasValidas(citas) boolean
  }
  class DetectorTema {
    +esDelTema(pregunta) boolean
  }
  class NormalizadorEspanol
  class BaseNormativa {
    +desdeArchivos(archivos) BaseNormativa$
    +porId(id) EntradaNormativa
    +cita(id) Cita
  }
  class DerechosClave {
    +lista() DerechoClave[]
  }

  class ProveedorVoz {
    <<interface>>
    +disponible() Promise~DisponibilidadVoz~
    +escuchar(opciones) Promise~string~
    +detener()
  }
  class ProveedorVozWeb {
    Web Speech API es-CO
  }
  class ProveedorTexto {
    alternativa de escribir
  }

  class CalendarioFestivos {
    <<interface>>
    +esFestivo(fecha) boolean
  }
  class FestivosColombia
  class ParametrosPlazos {
    +desdeJSON(json) ParametrosPlazos$
    +obtener(tipo) ParametroPlazo
  }
  class CalculadoraPlazos {
    +calcular(solicitud) ResultadoPlazo
    +diasHabilesRestantes(hoy, limite) DiasRestantes
  }
  class FechaCivil

  class ServicioCredenciales {
    +crearCredencial(pin) Credencial
    +verificar(pin, credencial) boolean
  }
  class DerivadorPBKDF2
  class GestorClaves {
    +generarClaveDatos() CryptoKey
    +envolver(clave, secreto) ClaveEnvuelta
  }
  class ControlIntentos
  class CodigoRecuperacion
  class ValidadorRegistro

  class Caso
  class Evidencia
  class Comparendo
  class ParserComparendo {
    +analizar(texto, palabras) ResultadoParser
  }
  class CatalogoInfracciones {
    +validarCodigo(codigo) ResultadoValidacionCodigo
  }
  class GeneradorSolicitud {
    +faltantes(caso) Faltante[]
    +armarContenido(caso, opciones) ContenidoSolicitud
  }

  ProveedorRespuesta <|.. ProveedorVerificado
  ProveedorRespuesta <|.. ProveedorLLM
  ProveedorRespuesta <|.. ProveedorClaude
  ProveedorClaude o-- ProveedorVerificado : respaldo
  ProveedorClaude --> BaseNormativa
  AsistenteNormativo o-- ProveedorRespuesta
  AsistenteNormativo o-- DetectorTema
  AsistenteNormativo o-- BaseNormativa
  ProveedorVerificado --> BaseNormativa
  ProveedorVerificado --> NormalizadorEspanol
  ProveedorLLM --> BaseNormativa
  DetectorTema --> NormalizadorEspanol
  DerechosClave --> BaseNormativa

  ProveedorVoz <|.. ProveedorVozWeb
  ProveedorVoz <|.. ProveedorTexto

  CalendarioFestivos <|.. FestivosColombia
  CalculadoraPlazos o-- CalendarioFestivos
  CalculadoraPlazos o-- ParametrosPlazos
  CalculadoraPlazos --> FechaCivil

  ServicioCredenciales --> DerivadorPBKDF2
  GestorClaves --> DerivadorPBKDF2

  Caso *-- Evidencia
  Caso o-- Comparendo
  GeneradorSolicitud --> Caso
```

- `ProveedorVoz` es una interfaz de `src/core/ProveedorVoz.ts`. Sus dos implementaciones viven en `src/services/`, porque dependen del navegador.
- `AsistenteNormativo` aplica dos garantías con cualquier proveedor:
  - toda respuesta lleva el aviso legal;
  - una respuesta sin cita, o con una cita que no coincide con la base (mismo id, mismo texto literal y misma URL), se convierte en abstención.
- Clases agregadas después del diagrama:
  - en `src/core/`: `ValidadorRedaccion` (revisa el texto de Claude), `DerivadorVerificador` (verificador del PIN que viaja al servidor, separado de la clave de datos), `ResolvedorSincronizacion` (decide qué subir, bajar o borrar) y `PrioridadCasos` (orden de "Mis casos" por urgencia);
  - en `src/servidor/`: `ProveedorClaude`, `ControlConsumo` (topes de gasto), `LimitadorPeticiones`, `ServicioCuentasServidor`, `CriptoServidor` (scrypt), `RepositorioCuentas`, `RepositorioSesiones` y `RepositorioDatosCifrados`;
  - en `src/services/`: `SincronizadorCasos`, `ClienteCuentas` y `ClienteSincronizacion`.
- `CalculadoraPlazos` no tiene los días escritos en el código: los lee de `data/normativa/parametros.json` a través de `ParametrosPlazos`, que rechaza los parámetros con `verificado: false`.

### 2.3 Asistente: modos

- **Modo Claude (si el servidor tiene `ANTHROPIC_API_KEY`).** `ProveedorClaude` (`src/servidor/ProveedorClaude.ts`) usa el SDK oficial `@anthropic-ai/sdk` con el modelo `claude-opus-5-5`.
  - **Contexto:** toda la base verificada (`BaseNormativa.todas()`, una entrada por línea con id, norma, artículo, título, texto literal y resumen sencillo) va en el `system`, en un bloque estable con `cache_control` (caché de prompts). La pregunta va después, sola, en `messages`. Así no depende de MiniSearch para encontrar el artículo.
  - **Advertencias:** de las notas de cada entrada solo viaja la frase "Requiere revisión jurídica: …" (`BaseNormativa.advertencia`), y las instrucciones piden decirla en una frase si se usa ese artículo. Hoy la tienen el art. 21 de la Ley 1801 (si cubre a agentes de tránsito civiles) y el art. 6 de la Ley 2578 (el 9 de julio).
  - **Instrucciones:** responder solo con los artículos dados, en español de Colombia, en segunda persona, de 1 a 4 frases cortas y sin jerga; nunca "garantizado" ni asesoría legal; citar los ids que sustentan la respuesta; `abstencion` si los artículos no la sustentan; `fuera_de_tema` si no es de tránsito ni de los datos de la app; la pregunta es un dato, no instrucciones.
  - **Salida estructurada** (`output_config.format`, JSON Schema): `{ tipo: "respuesta" | "abstencion" | "fuera_de_tema", texto, citas }`. Las citas del esquema son un `enum` con los ids de la base verificada, así el modelo no puede escribir otro id. Una respuesta sin citas, o con un id que no existe en la base verificada, se convierte en abstención. Las citas que ve el usuario se construyen desde `BaseNormativa` (texto literal real), nunca desde lo que escribe el modelo, y luego `AsistenteNormativo` las vuelve a validar.
  - **Revisión del texto** (`ValidadorRedaccion`, en `src/core/`): que las citas existan no prueba que sustenten lo que dice el texto. Antes de mostrarlo se revisa, de forma determinista, que no tenga frases prohibidas ("garantizado", "seguro que ganas", "te aseguro"...), ni enlaces, correos o teléfonos, y que toda cifra (en dígitos o en palabras de "dos" a "cien") aparezca en el texto literal, el resumen, la norma, el artículo o el título de alguna entrada citada. Si falla, se abstiene. Límites: no comprueba el sentido de la frase y puede abstenerse de más (por ejemplo, si el texto dice "dos opciones" y la norma citada no tiene el número 2).
  - **Parámetros:** esfuerzo `low` (consulta corta sobre un contexto dado, meta de 4 s); `max_tokens` 4000, que también es el tope de gasto por petición (valor sin medir; si se corta, responde el modo verificado); sin `temperature` ni `thinking` (en Opus 5.5 el razonamiento no se apaga y se controla con el esfuerzo); fallback del servidor `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`): si el modelo rechaza por política, Anthropic reintenta en otro modelo. Solo se envía a los modelos que lo aceptan (`claude-opus-5-5`, `claude-opus-5`, `claude-fable-5-1`, `claude-sonnet-5-5`); con otro `ANTHROPIC_MODELO`, por ejemplo `claude-haiku-5-5`, va sin fallback. Si aun así rechaza (`stop_reason: "refusal"`), se abstiene.
  - **Topes de gasto** (`ControlConsumo`, `src/servidor/`): en modo Claude, el endpoint acepta 10 preguntas por minuto y 100 por día por IP (después responde 429 con `Retry-After`), y un cupo global de 300 consultas a Claude por día; al agotarse el cupo global responde el modo verificado con `respaldo: "limite"`. Los contadores viven en memoria: se reinician si el servidor se reinicia y no se comparten entre instancias. En todos los modos el endpoint solo acepta `Content-Type: application/json` (415 si no), para que otro sitio no pueda enviar preguntas desde el navegador de un visitante sin una verificación de CORS, que el servidor no autoriza. Como protección adicional conviene fijar un límite de gasto mensual en la consola de Anthropic.
  - **Registros del SDK:** el cliente se crea con `logLevel: 'warn'` y sin trazas de OpenTelemetry, para que `ANTHROPIC_LOG=debug` no escriba en el log el cuerpo de la petición, que trae la pregunta.
  - **Segunda petición:** si la primera no responde en 5 s (`ASISTENTE_REINTENTO_MS`), se lanza otra igual y gana la primera que llegue; la otra se cancela. Medido: la mayoría responde en 2 a 6 s, pero cerca de 1 de cada 12 llamadas esperaba más de 12 s en la API (con solo 130 tokens de salida), y repetirla respondía en 2 a 4 s. Con la segunda petición, el banco pasó de 35 a 40 citas pertinentes y de 5 a 0 respaldos.
  - **Respaldo:** si Claude falla (red, 429, 5xx, tiempo agotado a los 12 s, JSON inválido o salida cortada), responde el modo verificado y la respuesta trae `modo: "verificado"` y `respaldo: "<motivo>"`. El SDK no reintenta (`maxRetries: 0`) para no duplicar la espera.
  - **Detector de tema:** con Claude no hay prefiltro. El `DetectorTema` es una lista fija de palabras y bloqueaba preguntas válidas escritas con otras palabras (por ejemplo "¿Me pueden embargar el sueldo?"); Claude clasifica `fuera_de_tema`. El detector se sigue usando en el modo verificado, también cuando es el respaldo de Claude.
  - **En la pantalla:** si la respuesta viene de Claude, aparece la línea "Respuesta redactada con IA (Claude) a partir de los artículos citados. Revisa el texto de la norma." Las tarjetas de cita no cambian.
  - Se evalúa con `npm run eval:asistente -- --claude` (gasta créditos de la API). Sin llave, avisa y no hace nada. Resultado en `docs/evaluacion/asistente-claude.md`.
- **Modo verificado (predeterminado sin llave; el evaluado en el prototipo).** `ProveedorVerificado` busca con MiniSearch, después de normalizar el español, entre las preguntas verificadas y sus variantes.
  - Si el puntaje supera el umbral, devuelve la `respuesta_sencilla` ya revisada, con sus citas.
  - Si no lo supera, se abstiene.
  - Nunca genera texto.
- **Modo LLM (opcional, apagado).** `ProveedorLLM` solo se crea si existen `LLM_BASE_URL` y `LLM_MODELO`.
  - Manda fragmentos de la base a un endpoint compatible con OpenAI (`/v1/chat/completions`, `temperature: 0`, `response_format: json_object`) y exige `{"respuesta", "citas"}`.
  - Si una cita no está entre los fragmentos recuperados, si el JSON no sirve o si se agota el tiempo, se abstiene.
  - No se evaluó en el prototipo.

## 7. Requisitos e instalación

Requisitos:
- Node.js 22 y npm (`package.json` acepta desde la 20; Railway y las pruebas usan la 22);
- git;
- Google Chrome o Edge para el dictado por voz (Web Speech API). En Firefox no hay dictado y la app ofrece escribir;
- para las pruebas e2e, Chromium de Playwright (`npx playwright install chromium`, una sola vez) y la herramienta `flock` (viene en Linux; la usa `scripts/build-e2e.sh`).

Instalación:

```bash
git clone https://github.com/gonzalezvar/vozvial.git
cd vozvial
npm ci
```

Los pasos para arrancarla están en [Inicio rápido](#2-inicio-rápido).

La app necesita un **contexto seguro** (HTTPS o `localhost`) porque usa WebCrypto (`crypto.subtle`). Si se abre por la IP de la red local (`http://192.168…`), no se puede crear la cuenta. Para probar en un celular, usa el enlace HTTPS publicado: https://vozvial-production.up.railway.app

## 8. Variables de entorno

Ninguna es obligatoria. Estas son las que el código lee de verdad:

| Variable | Dónde se lee | Para qué | Valor por defecto |
|---|---|---|---|
| `EXPO_PUBLIC_API_URL` | `src/services/ClienteAsistente.ts` (en el build de la app) | Origen del API del asistente, sin barra final. Sirve en desarrollo para apuntar a `http://localhost:3001`. En producción se deja vacía: la CSP solo permite conectarse al mismo origen | vacío (mismo origen) |
| `EXPO_PUBLIC_BLOQUEO_MS` | `src/state/configuracion.ts` | Duración del bloqueo tras 5 PIN incorrectos (CA-02.3) | 300000 (5 min) |
| `EXPO_PUBLIC_INACTIVIDAD_MS` | `src/state/configuracion.ts` | Tiempo sin actividad antes de cerrar la sesión (CA-02.4) | 600000 (10 min) |
| `EXPO_PUBLIC_PBKDF2_ITERACIONES` | `src/state/configuracion.ts` | Iteraciones de PBKDF2 para el PIN y las claves | 600000 |
| `ANTHROPIC_API_KEY` | `src/servidor/ProveedorClaude.ts` (en el servidor) | Llave de la API de Anthropic. Si existe, el asistente usa Claude (y tiene prioridad sobre `LLM_BASE_URL`). Nunca va en el build de la app ni con prefijo `EXPO_PUBLIC_` | sin valor (modo verificado) |
| `ANTHROPIC_MODELO` | `src/servidor/ProveedorClaude.ts` | Modelo de Claude | `claude-opus-5-5` |
| `ASISTENTE_ESFUERZO` | `src/servidor/ProveedorClaude.ts` | Esfuerzo de Claude: `low`, `medium`, `high`, `xhigh` o `max` | `low` |
| `ASISTENTE_MODO` | `src/servidor/ProveedorClaude.ts` | Si vale `verificado`, apaga Claude aunque exista la llave | sin valor |
| `ASISTENTE_TIMEOUT_MS` | `src/servidor/ProveedorClaude.ts` | Tiempo máximo de espera de Claude antes de responder con el modo verificado. Debe ser menor que los 15 s del cliente | 12000 |
| `ASISTENTE_REINTENTO_MS` | `src/servidor/ProveedorClaude.ts` | Si la primera petición a Claude no respondió en este tiempo, se lanza una segunda igual y gana la primera. `0` lo apaga | 5000 |
| `ASISTENTE_LIMITE_MINUTO` | `src/servidor/ControlConsumo.ts` | Preguntas por minuto por IP en modo Claude (después, 429) | 10 |
| `ASISTENTE_LIMITE_DIA` | `src/servidor/ControlConsumo.ts` | Preguntas por día por IP en modo Claude (después, 429) | 100 |
| `ASISTENTE_LIMITE_GLOBAL_DIA` | `src/servidor/ControlConsumo.ts` | Consultas a Claude por día en todo el servidor (después, modo verificado) | 300 |
| `LLM_BASE_URL` | `src/core/ProveedorLLM.ts` (en el servidor) | Endpoint compatible con OpenAI (por ejemplo vLLM en RunPod). Si falta, el modo LLM queda apagado | sin valor |
| `LLM_MODELO` | `src/core/ProveedorLLM.ts` | Nombre del modelo que sirve el endpoint. También es obligatoria para activar el modo LLM | sin valor |
| `LLM_API_KEY` | `src/core/ProveedorLLM.ts` | Se manda como `Authorization: Bearer …` si existe | sin valor |
| `LLM_TIMEOUT_MS` | `src/core/ProveedorLLM.ts` | Tiempo máximo de espera del LLM | 15000 |
| `DATABASE_URL` | `src/servidor/configuracion.ts` | Postgres del servidor. En Railway es `${{Postgres.DATABASE_URL}}` (red interna). Sin ella se usa PGlite | sin valor (PGlite) |
| `PGLITE_DIR` | `src/servidor/configuracion.ts` | Carpeta donde PGlite guarda los datos. Sin ella, PGlite vive en memoria | sin valor (memoria) |
| `SECRETO_SERVIDOR` | `src/servidor/configuracion.ts` | Secreto aleatorio de 32 caracteres o más para la sal falsa de los celulares no registrados. Si falta, se deriva de `DATABASE_URL` y el log lo avisa | derivado |
| `BLOQUEO_CUENTA_MS` | `src/servidor/configuracion.ts` | Bloqueo de la cuenta en el servidor tras 5 fallos | 300000 (5 min) |
| `ITERACIONES_AUTENTICACION` | `src/servidor/configuracion.ts` | Iteraciones PBKDF2 del verificador que se proponen al registrar | 600000 |
| `SCRYPT_N` | `src/servidor/configuracion.ts` | Costo de scrypt sobre los verificadores (potencia de 2) | 32768 |
| `SESION_HORAS` | `src/servidor/configuracion.ts` | Duración del token de sesión del servidor | 168 (7 días) |
| `LIMITE_PETICIONES_MINUTO` | `src/servidor/configuracion.ts` | Peticiones por minuto por IP en registro, sesión, recuperación y parámetros | 30 |
| `MAX_BYTES_EVIDENCIA`, `CUOTA_CUENTA_BYTES` | `src/servidor/configuracion.ts` | Tamaño máximo por evidencia y cuota por cuenta | 8 MB y 100 MB |
| `CONFIAR_PROXY` | `src/servidor/configuracion.ts` | Si vale `1`, toma la IP de `X-Forwarded-For`. En Railway se activa solo | automático en Railway |
| `PORT` | `scripts/servidor-api.ts`, `scripts/servidor-e2e.ts` y `scripts/servidor-produccion.ts` | Puerto de los servidores | 3001 y 4173 |
| `E2E_PUERTO`, `E2E_DIST` | `playwright.config.ts` | Puerto y carpeta de build de una suite e2e aislada | 4173 y `dist` |

- Las `EXPO_PUBLIC_*` las reemplaza Expo **al compilar**, así que hay que definirlas antes de `expo export` o `expo start`.
- Los tiempos cortos (3 s de bloqueo, 5 s de inactividad, 1000 iteraciones) se usan **solo** en el build de e2e (`scripts/build-e2e.sh` y `npm run build:web:e2e`). La app publicada usa los valores reales.
- No hay archivo `.env` en el repositorio: `.gitignore` excluye `.env*`.

## 9. Comandos y pruebas

| Comando | Qué hace |
|---|---|
| `npm run web` | App en el navegador con el servidor de desarrollo de Expo (puerto 8081) |
| `npm run api` | Servidor local del asistente en el puerto 3001 (`scripts/servidor-api.ts`). Usa el mismo handler de `api/asistente.ts` y permite CORS solo desde `localhost` |
| `npm run android` | Expo Go en Android (opcional; en nativo no se graba audio) |
| `npm test` | Pruebas unitarias con Jest. Dos proyectos: `core` en Node con WebCrypto y `app` con `jest-expo` |
| `npm run typecheck` | `tsc --noEmit` con TypeScript estricto |
| `npm run lint` | ESLint 9 con `eslint-config-expo` |
| `npm run e2e` | Playwright (Pixel 7, Chromium). Compila con tiempos cortos, sirve la app y el API en el mismo origen y genera `evidencias/` y `docs/evaluacion/matriz-criterios.md` |
| `bash scripts/e2e-aislado.sh <nombre> <puerto> [specs]` | Corre una o varias suites con su propio build (`dist-<nombre>`) y su propio puerto, para no chocar con otras corridas. Ejemplo: `bash scripts/e2e-aislado.sh m5 4215 e2e/hu11-plazos.spec.ts` |
| `npx tsx scripts/matriz-desde-resultados.ts` | Regenera la matriz desde `docs/evaluacion/resultados-e2e.json` sin volver a correr las pruebas |
| `npm run eval:asistente` | Corre `data/banco-evaluacion.json` contra el asistente en proceso y escribe `docs/evaluacion/asistente.md` |
| `npm run eval:asistente -- --url <url>/api/asistente` | Además mide contra un servidor real (local o Railway), con la red incluida |
| `npm run eval:asistente -- --claude` | Corre el banco con Claude (requiere `ANTHROPIC_API_KEY`; cada pregunta es una llamada pagada) y escribe `docs/evaluacion/asistente-claude.md` con citas pertinentes, abstenciones, fuera de tema, respaldos, uso del caché y p50/p95 |
| `npm run build:web` | `expo export -p web` a `dist/` y luego `scripts/verificar-bundle.ts`, que falla si el SDK de Anthropic o el prompt del servidor quedaron en el build |
| `npm run build:web:e2e` | Mismo build con los tiempos cortos de prueba |
| `npm run servidor:e2e` | Sirve `dist/`, `/api/asistente` y la API de datos en el puerto 4173, con las cabeceras y la CSP de `vercel.json` |
| `npx playwright test -c playwright.produccion.config.ts` | Pruebas e2e contra el despliegue publicado (o `E2E_URL_BASE`). No crean cuentas: cubren pantallas públicas, guía, asistente, API sin sesión y cabeceras. Resultados en `docs/evaluacion/produccion.md` |
| `npm start` | Servidor de producción (`scripts/servidor-produccion.ts`). Usa Postgres si hay `DATABASE_URL` y PGlite si no |
| `npm run sembrar:demo -- --url-bd <url>` | Crea las 3 cuentas de demostración de `docs/usuarios-demo.md` con casos y plazos cargados. También acepta `--pglite <carpeta>` o lee `DATABASE_URL` |

Para desarrollar con el asistente, abre dos terminales:

```bash
npm run api                                         # terminal 1
EXPO_PUBLIC_API_URL=http://localhost:3001 npm run web   # terminal 2
```

Para ver la app como quedaría publicada (con la CSP de producción):

```bash
npm run build
npm start      # abre http://localhost:4173
```

Para correr la e2e completa con la API real de Anthropic (gasta créditos; en local se sube el tope por minuto para que la suite no reciba 429):

```bash
set -a; . ./.env; set +a
ASISTENTE_LIMITE_MINUTO=1000 ASISTENTE_LIMITE_DIA=10000 E2E_PUERTO=4181 E2E_DIST=dist-claude npx playwright test
```

Las pruebas del asistente valen en los dos modos: en modo verificado comparan con la respuesta sencilla fija; con Claude, con el texto y las citas que devolvió el servidor, y en ambos validan norma, artículo, texto literal, fecha de consulta y enlace.

Si tienes `npm start` corriendo en el puerto 4173, Playwright lo reutilizaría en vez de levantar su propio servidor con tiempos cortos: deténlo o usa `E2E_PUERTO` y `E2E_DIST` como arriba.

Cómo están hechas las pruebas e2e:
- Cada criterio tiene una prueba cuyo nombre empieza por su id (`CA-09.2 …`) y guarda la captura `evidencias/CA-09.2.png`.
- El reporter `e2e/reporter-matriz.ts` arma la matriz con Cumple, Cumple parcialmente, No cumple o Sin prueba.
- Lo simulado en e2e, declarado en cada prueba y en "Acerca del prototipo":
  - el reconocimiento de voz (`SpeechRecognition` falso con `page.addInitScript`);
  - micrófono y cámara falsos de Chromium;
  - la ubicación (permisos del contexto);
  - el reloj, en plazos y recordatorios (`page.clock`);
  - la falta de conexión (`context.setOffline`).
- El servidor de e2e usa PGlite en memoria, compartido por todas las pruebas, así que `e2e/utilidades.ts` genera un celular distinto en cada registro. La prueba de varios dispositivos abre dos contextos de navegador contra el mismo servidor.
- `e2e/axe.spec.ts` revisa 12 pantallas con axe (wcag2a y wcag2aa) y escribe `docs/evaluacion/axe-reporte.md`.

## 10. Despliegue

**Publicado en Railway:** https://vozvial-production.up.railway.app (desplegado el 2026-11-08 desde la cuenta de Juan). Redesplegado el mismo día con Postgres, el asistente con Claude, la sincronización, el rediseño y la guía. Código en GitHub: https://github.com/gonzalezvar/vozvial (público).

- Railway corre dos servicios en el proyecto `vozvial`:
  - `vozvial`: `npm run build` (`expo export -p web`) y `npm start` (`scripts/servidor-produccion.ts`), que sirve `dist/` como SPA, `/api/asistente` y la API de cuentas y datos cifrados en el mismo origen, con las cabeceras y la CSP de `vercel.json`. Es el mismo servidor que usan las pruebas e2e. Las migraciones de la base corren al arrancar.
  - `Postgres`: la base de datos. El servicio `vozvial` la alcanza por la red interna con `DATABASE_URL`.
- Variables del servicio `vozvial`: `ANTHROPIC_API_KEY`, `DATABASE_URL`, `SECRETO_SERVIDOR` y `RAILPACK_NODE_VERSION=22`. Los valores no van en el repositorio.
- Configuración en `railway.json` (builder Railpack, Node 22). `.railwayignore` deja fuera evidencias, documentos, fuentes crudas y pruebas para que la subida sea liviana.
- Redesplegar: `railway up --ci -m "<resumen>"` desde la raíz del proyecto.

Desplegar desde cero en otra cuenta de Railway (con la CLI instalada y `railway login`):

```bash
railway init                       # crea el proyecto
railway add --database postgres    # agrega el servicio Postgres
railway up --ci -m "primer despliegue"
railway variable set 'DATABASE_URL=${{Postgres.DATABASE_URL}}' --service vozvial
railway variable set RAILPACK_NODE_VERSION=22 --service vozvial
openssl rand -hex 32 | railway variable set SECRETO_SERVIDOR --stdin --service vozvial
railway variable set ANTHROPIC_API_KEY --stdin --service vozvial   # pega la llave y Ctrl+D; opcional
railway domain                     # genera la URL pública
railway ssh --service vozvial -- npx tsx scripts/sembrar-demo.ts --sin-doc   # cuentas demo, opcional
```

El nombre del servicio (`vozvial`) es el que Railway le dé a la app; revísalo con `railway status`. Cada `railway variable set` sin `--skip-deploys` redespliega.
- Vercel quedó como alternativa solo para el asistente: la función `api/asistente.ts` no sirve la API de cuentas ni la base de datos. Los pasos están en [`docs/despliegue.md`](docs/despliegue.md).

En resumen:
- `vercel.json` instala con `npm ci`, compila con `npx expo export -p web`, publica `dist/` y crea la función `api/*.ts` con un máximo de 15 s.
- Reescribe todas las rutas a `index.html` (SPA), menos `/api/`.
- Agrega cabeceras de seguridad: CSP, HSTS, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` y `Permissions-Policy`.
- Sin variables la app funciona en modo verificado y con PGlite en memoria (los datos se pierden al reiniciar). Para activar Claude, se agrega `ANTHROPIC_API_KEY` en las variables del servicio (Railway: Variables; Vercel: Environment Variables) y se redespliega.

## 11. Flujo de datos y privacidad

```mermaid
sequenceDiagram
  actor U as Conductor
  participant A as App en el navegador
  participant C as WebCrypto
  participant I as IndexedDB
  participant G as Dictado de Chrome (Google)
  participant S as api/asistente (servidor)
  participant D as API de datos y Postgres (servidor)
  participant K as API de Anthropic (Claude)

  U->>A: Crea la cuenta con nombre, celular y PIN
  A->>C: PBKDF2-SHA256 del PIN (600 000 iteraciones, sal de 16 bytes)
  A->>C: Genera la clave de datos AES-GCM 256 y la envuelve con el PIN y con el código
  A->>I: Guarda hash, sales, claves envueltas y el perfil cifrado
  U->>A: Usa Me pararon con audio, ubicación, fotos y notas
  A->>C: Cifra con AES-GCM (IV de 12 bytes)
  A->>I: Guarda solo id, IV y datos cifrados
  A->>D: Sube el verificador del PIN, las claves envueltas y los datos ya cifrados
  opt Si dicta la pregunta en Chrome
    U->>G: Audio de la pregunta
    G-->>A: Texto reconocido
  end
  A->>S: POST solo con el texto de la pregunta
  opt Si el servidor tiene ANTHROPIC_API_KEY
    S->>K: Base normativa verificada (system) y texto de la pregunta (messages)
    K-->>S: JSON con tipo, texto y ids de las citas
  end
  S-->>A: Respuesta con citas y aviso legal
```

### Qué se guarda y dónde

IndexedDB es la copia principal. Si el servidor responde, cada cambio se sube **ya cifrado** a Postgres para poder entrar desde otro celular. El servidor no tiene la clave de datos, así que no puede leer el nombre, los casos ni las evidencias. El detalle del protocolo y del esquema está en [`docs/bd.md`](docs/bd.md).

| Dato | Dónde | Cómo |
|---|---|---|
| PIN | IndexedDB, store `cuenta` | Nunca en claro. Solo `{ algoritmo, hash, sal, iteraciones }`: PBKDF2-HMAC-SHA256, 600 000 iteraciones y sal aleatoria de 16 bytes (`ServicioCredenciales`) |
| Clave de datos | IndexedDB, store `cuenta` | Una clave AES-GCM de 256 bits aleatoria, guardada **dos veces envuelta**: con una clave derivada del PIN y con otra derivada del código de recuperación (PBKDF2, cada una con su sal). Nunca se guarda en crudo (`GestorClaves`) |
| Nombre y celular | IndexedDB, store `cuenta` | Cifrados con AES-GCM y la clave de datos (`perfilCifrado`) |
| Intentos fallidos y bloqueo | IndexedDB, store `cuenta` | Contador y hora de fin del bloqueo (`ControlIntentos`) |
| Casos (fecha, ubicación, comparendo, metadatos de evidencias) | IndexedDB, store `casos` | `{ id, iv, datos }`: el JSON del caso cifrado con AES-GCM |
| Contenido de las evidencias (audio, fotos, notas) | IndexedDB, store `evidencias` | `{ id, casoId, iv, datos }` en binario cifrado con AES-GCM |
| Clave de datos abierta | Memoria (zustand, `src/state/sesion.ts`) | Solo mientras la sesión está abierta. Se borra al salir o por inactividad |
| Tamaño de letra | localStorage (`vozvial.ajustes`) | En claro: no es un dato personal |
| Celular | Postgres, tabla `cuentas` | En claro, porque es el usuario para entrar |
| Verificadores del PIN y del código | Postgres, tabla `cuentas` | El celular manda `PBKDF2("vozvial/autenticacion/pin/v1|" + PIN, sal_auth)`, que no abre la clave de datos; el servidor le aplica scrypt antes de guardarlo |
| Claves envueltas y perfil | Postgres, tabla `cuentas` | Las mismas que en IndexedDB, cifradas con AES-GCM |
| Casos y evidencias | Postgres, tablas `casos` y `evidencias` | `{ id, iv, datos }` cifrados, más fechas, tipo de archivo y tamaño |
| Sesión del servidor | Postgres, tabla `sesiones` | Solo el SHA-256 del token |

- Cómo se comprueba: CA-01.6 y CA-08.3 inspeccionan IndexedDB en e2e. El volcado está en `evidencias/CA-08.3-indexeddb.json`.
- A mano: Chrome, DevTools, Application, IndexedDB, `vozvial`.

### Qué viaja al servidor y qué no

- **Viaja al asistente:** solo el cuerpo `{ "pregunta": "<texto>" }`, de 500 caracteres como máximo, a `/api/asistente`.
  - `ClienteAsistente.cuerpo()` arma exactamente eso.
  - El servidor (`validarCuerpo`) rechaza con 400 cualquier campo adicional.
  - RNF-01 lo comprueba en e2e interceptando la petición.
- **No viaja al asistente:** el nombre, el celular, el PIN, la ubicación, el audio, las fotos, las notas, el comparendo ni las cookies.
- **Viaja a la API de datos:** el celular, el verificador derivado del PIN o del código (nunca el PIN ni el código), las claves envueltas y el perfil, los casos y las evidencias ya cifrados en el celular. Las rutas, los límites y el bloqueo de 5 fallos están en [`docs/bd.md`](docs/bd.md).
- El servidor **no registra** el texto de las preguntas ni de las respuestas. Ante un error responde un mensaje genérico, sin detalles que puedan contener la pregunta. Si Claude falla, el registro solo dice el motivo, el estado HTTP y el id de la petición.
- **Claude (si el servidor tiene la llave):** el servidor reenvía a la API de Anthropic el texto de la pregunta, junto con la base normativa (que es pública). No se envía nada más del usuario: ni nombre, ni ubicación, ni audio, ni la IP del celular (la petición sale del servidor).
  - Anthropic trata ese texto según sus propias condiciones y puede conservarlo por un tiempo limitado. Por eso la política de datos pide no escribir datos personales en la pregunta.
  - Se declara en la política de datos y en "Acerca del prototipo", y la pantalla del asistente lo recuerda bajo el campo de la pregunta ("No escribas tu nombre, tu cédula ni tu placa.").
- **Modo LLM (si el servidor tiene `LLM_BASE_URL` y `LLM_MODELO`, sin `ANTHROPIC_API_KEY`):** la pregunta va al endpoint configurado en lugar de Anthropic.
- Solo en el modo verificado, sin ninguna IA externa, la pregunta no sale del servidor.
- **Tope por IP (solo en modo Claude):** el servidor guarda en memoria la IP y un contador, hasta por un día, para limitar el gasto. No lo junta con la pregunta ni lo escribe en el log.
- **Dictado por voz:** en Chrome, el reconocimiento de voz del navegador (Web Speech API) manda el audio a un servicio de Google para convertirlo en texto. Ese audio no pasa por VozVial y lo trata Google según sus propias condiciones.
  - Es opcional: siempre se puede escribir.
  - Se declara en la app ("Acerca del prototipo" y política de datos).
- **OCR del comparendo:** corre en el navegador con tesseract.js. El worker, el núcleo WASM y el modelo `spa.traineddata` están autoalojados en `public/tesseract/`, así que la foto no sale del celular y no se usa ningún CDN.
- **Sin terceros:** no hay analítica ni scripts externos.
  - La CSP de `vercel.json` limita `script-src` y `connect-src` a `'self'` (más `blob:` y `wasm-unsafe-eval` para el OCR).
  - El servidor e2e aplica las mismas cabeceras, así que las pruebas detectan si algo intenta salir.
- **Lectura en voz alta:** usa la síntesis de voz del sistema (`expo-speech`, `speechSynthesis` en web).

## 12. Base normativa

Regla del proyecto: ningún artículo, plazo, código de infracción ni valor de multa entra a la app si no se copió de una fuente oficial. El procedimiento está en `docs/base-normativa.md`.

Cómo se construyó, el 8 de noviembre de 2026:
1. **Descarga.** Seis agentes, uno por norma, descargaron con `curl` las páginas oficiales:
   - Secretaría del Senado;
   - Función Pública;
   - MinTransporte;
   - Presidencia (decretos en PDF).

   Los archivos crudos están en `data/fuentes/`, con sus sumas `SHA256SUMS-*.txt`, para poder responder "¿de dónde sale esto?".
2. **Extracción.** El texto literal se extrajo con scripts, no a mano ni con resúmenes de un modelo. Las notas de vigencia de la fuente van en `notas`, no en `texto_literal`.
3. **Verificación adversarial.** Otros seis agentes volvieron a descargar cada fuente, extrajeron el texto con un extractor propio y compararon palabra por palabra. Un séptimo revisó la síntesis y corrigió:
   - 8 respuestas de `preguntas-verificadas.json`;
   - 14 preguntas del banco que eran casi iguales a las verificadas.
4. **Esquema.** Cada entrada guarda `url_fuente`, `fecha_consulta`, `texto_literal`, `modificado_por`, `resumen_sencillo`, `verificado` y `verificado_por`.
   - `BaseNormativa` descarta las entradas con `verificado: false`, así que la app no las usa.
   - `verificado_por` dice que la verificación fue automatizada y que falta la revisión humana de Juan.

Contenido:
- 39 entradas, 35 verificadas, de las leyes 769 de 2002, 1843 de 2017, 1801 de 2016, 1581 de 2012, 51 de 1983, 2578 de 2026 y 2294 de 2023, más conceptos de MinTransporte que ninguna respuesta cita;
- 108 infracciones del art. 131 (107 verificadas), con la sanción en SMDLV;
- 11 parámetros de plazos (8 verificados);
- 49 preguntas verificadas (45 de la fase 2 y 4 agregadas en el refinamiento del asistente: PV-046 a PV-049);
- un banco de evaluación de 60 preguntas: 40 con sustento, 10 sin sustento y 10 fuera de tema.

Todo lo que quedó sin verificar o que requiere decisión jurídica está en `docs/pendientes-verificacion.md`.

## 13. Limitaciones

Son las mismas que declara la pantalla "Acerca del prototipo" (`src/ui/contenidoAcerca.ts`), más los pendientes de verificación:

- **Asistente.** Sin `ANTHROPIC_API_KEY` responde en modo verificado con las 49 preguntas revisadas: si se pregunta con otras palabras, muchas veces se abstiene (resultado medido en `docs/evaluacion/asistente.md`). Con la llave, Claude redacta la respuesta desde la base verificada; las citas se validan contra la base, pero el texto redactado puede tener errores y por eso la pantalla pide revisar la norma. Con Claude, el banco dio 40 de 40 citas pertinentes en una corrida (`docs/evaluacion/asistente-claude.md`); el modelo no es determinista, así que otra corrida puede variar.
- **Sin conexión.** El asistente necesita internet. Sin conexión funcionan "Me pararon", las evidencias, el comparendo y los plazos, pero solo si la app ya estaba abierta: no hay service worker, así que recargar sin internet no abre la app.
- **Voz.** El dictado funciona en Chrome y Edge, y en Chrome el audio lo procesa Google. En las pruebas automáticas la voz es simulada; la voz real se muestra en el video.
- **Servidor de prueba.** La copia en Railway es del proyecto universitario y no se ha probado restaurar una copia de respaldo de la base. Si se olvidan el PIN y el código de recuperación, nadie puede abrir los casos, porque el servidor no tiene la clave.
- **Sincronización.** Al entrar gana el cambio más reciente de cada caso; no se juntan dos ediciones del mismo caso hechas en dos celulares sin conexión.
- **Código de recuperación.** A diferencia del PIN, la cuenta no se bloquea por código mal escrito. El servidor solo limita a 30 peticiones por minuto por IP.
- **PIN de 6 dígitos.** Tiene 10⁶ combinaciones. Quien copie el almacenamiento del navegador o la tabla `cuentas` podría probarlas todas sin conexión: PBKDF2 (y scrypt en el servidor) lo hacen más lento, pero no lo impiden.
- **Audio de "Me pararon".**
  - Se guarda al tocar "Terminar" o al salir de la pantalla. Si se cierra el navegador mientras graba, se pierde.
  - En Expo Go (nativo) no se graba audio.
  - Mientras se usa "Me pararon", la sesión no se cierra por inactividad.
- **Fotos.** La fecha y hora de una foto es la de cuando se agrega al caso, no la de cuando se tomó.
- **OCR.** Solo se probó con imágenes sintéticas con datos inventados y marca de agua "DOCUMENTO DE PRUEBA — NO VÁLIDO". Con fotos reales, varios datos pueden salir marcados para revisar.
- **Valor de la multa en pesos.** No se muestra (CA-10.2 parcial), porque la UVB 2026 y la equivalencia de SMDLV a UVB no están verificadas.
- **Plazos.**
  - La forma de contar los días hábiles, el punto de partida en fotodetección ("recibo del comparendo", art. 8 de la Ley 1843) y los casos de envío solo por correo electrónico o por aviso esperan revisión jurídica.
  - La app no acepta fechas futuras de infracción ni de notificación.
- **Recordatorios.** Se ven al abrir la app; no hay notificaciones push.
- **Derecho a grabar.** Se sustenta en el art. 21 de la Ley 1801, que habla de "procedimiento de policía". Si aplica a agentes de tránsito civiles es una decisión jurídica pendiente.
- **Política de datos.** Falta publicar la identificación, la dirección y el teléfono del responsable (Ley 1581, art. 12).
- **Revisión humana.** Toda la base fue verificada por agentes automatizados y falta la revisión de Juan (`docs/pendientes-verificacion.md`).
- **Módulos pospuestos.** El 6 (solicitud de audiencia en PDF) y la exportación de casos del 7 quedan para la entrega final, igual que las pruebas e2e de CA-04.1 y CA-04.2.
- **Despliegue en Railway, no en Vercel.** RNF-02 se midió contra Railway (p95 de 119 ms con red, meta < 1,5 s). La función de Vercel (`api/asistente.ts` con `vercel.json`) no se ha probado en Vercel.

## 14. Problemas comunes

| Síntoma | Causa y solución |
|---|---|
| "No se pudo crear la cuenta" o error de `crypto.subtle` | La app se abrió por IP (`http://192.168…`) o por HTTP. Usa `http://localhost:…` o el enlace HTTPS |
| El asistente responde siempre con las mismas 49 respuestas o se abstiene mucho | No hay `ANTHROPIC_API_KEY` en el proceso del servidor: carga el `.env` con `set -a; . ./.env; set +a` antes de `npm start` o `npm run api` |
| La app en `npm run web` no encuentra el asistente | Falta `EXPO_PUBLIC_API_URL=http://localhost:3001` y `npm run api` en otra terminal |
| `EADDRINUSE` al arrancar | El puerto ya está ocupado por otro servidor: cámbialo con `PORT=4180 npm start` |
| La semilla falla con PGlite | El servidor está abierto sobre la misma carpeta: detenlo y vuelve a correr la semilla |
| Al recargar la página pide el PIN otra vez | Es a propósito: la clave de datos vive solo en memoria y se borra al recargar |
| `npm run e2e` falla en muchas pruebas a la vez | Reutilizó un `npm start` del puerto 4173 (sin los tiempos cortos de prueba): deténlo o usa `E2E_PUERTO` |
| Playwright no encuentra el navegador | Falta `npx playwright install chromium` |
| Railway: "No se pudo sembrar: ENOENT … usuarios-demo.md" | Falta `--sin-doc`: `docs/` no se sube a Railway |

## 15. Documentos del proyecto

| Archivo | Contenido |
|---|---|
| `docs/historias-usuario.md` | Historias y criterios de aceptación (lo que se evalúa) |
| `docs/base-normativa.md` | Procedimiento de la base normativa y tablas de prueba de festivos y plazos |
| `docs/pendientes-verificacion.md` | Lo no verificado y las decisiones jurídicas pendientes |
| `docs/ciclo-vida.md` | Lo que se hizo en cada etapa del ciclo de vida del prototipo |
| `docs/refinamiento-historias.md` | Cambios a historias y criterios, con su motivo |
| `docs/evaluacion/` | `matriz-criterios.md` (resultado por criterio), `asistente.md` (banco en modo verificado), `asistente-claude.md` (banco con Claude), `produccion.md` (pruebas contra el despliegue) y `axe-reporte.md` |
| `evidencias/` | Capturas de cada criterio (`CA-xx.y.png`), volcado cifrado de IndexedDB y capturas de producción |
| `.env.example` | Variables que se pueden definir en local, sin valores |
| `docs/despliegue.md` | Pasos para publicar en Railway (y la alternativa en Vercel) |
| `docs/bd.md` | Base de datos, cifrado de extremo a extremo, protocolo y rutas de la API de datos |
| `docs/usuarios-demo.md` | Cuentas de demostración con datos ficticios |
