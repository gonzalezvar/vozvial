# Pruebas e2e contra producción

- **Fecha:** 8 de noviembre de 2026.
- **Contra:** https://vozvial-production.up.railway.app (Railway, con Postgres y el asistente con Claude).
- **Cómo se corre:**
  ```bash
  npx playwright test -c playwright.produccion.config.ts
  ```
  Con `E2E_URL_BASE=<url>` se apunta a otro despliegue. Las capturas quedan en `evidencias/produccion/`.
- **Resultado:** primera corrida, 27 de 28: la que falló encontró un defecto real (ver "Hallazgo"). Después de corregirlo y redesplegar, **28 de 28**.

## Alcance: qué cubre y qué no

Esta suite **no crea cuentas ni escribe PIN en producción**. Por eso cubre solo lo que se puede comprobar sin sesión. Los criterios con cuenta (HU-01 a HU-14) se prueban con la suite local completa (`npm run e2e`, 55 pruebas, 0 fallos), que usa el mismo servidor de producción (`scripts/servidor-e2e.ts`) con PGlite en lugar de Postgres y tiempos cortos de bloqueo e inactividad.

**No probado contra producción:** registro, entrar con PIN, entrar desde otro navegador, "Me pararon", evidencias, comparendo, plazos, recordatorios, Mis casos, borrar todo y las cuentas de demostración. Hay que probarlos a mano en el despliegue o en un entorno de pruebas.

## Resultados

| Grupo | Prueba | Resultado |
|---|---|---|
| Pantallas públicas | `/bienvenida`, `/registro`, `/entrar`, `/recuperar`, `/guia`, `/acerca` y `/privacidad` responden 200, muestran su título, sin errores de consola y sin violaciones serias de axe (7 pruebas) | Cumple |
| Pantallas públicas | La raíz sin cuenta lleva a la bienvenida; una ruta inexistente abre una pantalla de VozVial en español | Cumple tras la corrección (ver "Hallazgo") |
| Pantallas públicas | Sin sesión, `/casos` no se abre y vuelve a la bienvenida | Cumple |
| Accesibilidad | Botones principales de al menos 56 px y letra base de al menos 18 px | Cumple |
| Accesibilidad | "Volver", "Ayuda" y "Escuchar" en una fila a 412 px | Cumple |
| CA-01.2 | Con el registro vacío, cada campo muestra su mensaje y no se crea la cuenta (no se escribe ningún dato) | Cumple |
| Guía | Recorrido de 5 pasos con Siguiente, Atrás y Escuchar en cada paso; termina en "Crear mi cuenta" | Cumple |
| Guía | "Saltar" vuelve a la bienvenida | Cumple |
| Acerca | Declara la copia cifrada en el servidor, entrar desde otro celular, la guía, el servidor de prueba y Claude; ya no dice "No hay servidor de cuentas" | Cumple |
| Privacidad | La política nombra a Anthropic, dice que el servidor no puede leer los casos y cita la Ley 1581 | Cumple |
| CA-06.1 | Pregunta con sustento (SOAT): `modo: claude`, sin respaldo, con citas cuyo texto literal, URL y fecha coinciden con la base verificada, y con el aviso legal | Cumple |
| CA-07.3 | Pregunta sobre grabar al agente: cita el art. 21 de la Ley 1801 y advierte que habla de la Policía, no de agentes de tránsito | Cumple |
| CA-06.2 | Pregunta sin sustento (pico y placa): se abstiene y no inventa citas | Cumple |
| CA-06.3 | Pregunta fuera de tema (ajiaco): declina y explica los temas | Cumple |
| Asistente | Una instrucción incrustada ("ignora tus reglas… garantizado") no cambia las reglas | Cumple |
| RNF-01 | El endpoint rechaza campos extra (400), cuerpos que no son JSON (415) y preguntas de más de 500 caracteres (400) | Cumple |
| API de datos | `/api/casos` y `/api/evidencias` exigen sesión (401, también con un token inventado) y responden `no-store` | Cumple |
| API de datos | `/api/cuentas/parametros` da una sal estable de 16 bytes para un celular sin cuenta, así no revela si existe; rechaza un celular inválido | Cumple |
| Seguridad | CSP, HSTS, `X-Frame-Options: DENY`, `nosniff` y `no-referrer` en la app y en el API | Cumple |
| Seguridad | HTTP redirige a HTTPS | Cumple |
| Privacidad | La app no pide nada a otros dominios y ningún script del bundle trae el SDK, la llave ni el prompt de Anthropic | Cumple |
| OCR | Worker, núcleo WASM y modelo `spa` se sirven desde el mismo origen | Cumple |

Además, después de la corrida se revisaron los logs de Railway: no aparece ninguna de las preguntas enviadas ni los celulares usados.

## Hallazgo

Una ruta inexistente (por ejemplo `/ruta-que-no-existe`) mostraba la página por defecto de Expo Router, en inglés ("Unmatched Route"), con un enlace al mapa del sitio. No sigue el lenguaje sencillo ni el diseño de la app.

- **Corrección:** `app/+not-found.tsx`, una pantalla en español ("No encontramos esta página") con el botón "Ir al comienzo". La prueba de humo local ahora lo comprueba y pasa.
- **Estado en producción:** desplegada; la prueba pasa contra producción.
