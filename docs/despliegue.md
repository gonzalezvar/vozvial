# Despliegue de VozVial (Railway, GitHub y alternativa en Vercel)

## Despliegue actual: Railway (2026-11-08)

- **Enlace público:** https://vozvial-production.up.railway.app
- **Repositorio:** https://github.com/gonzalezvar/vozvial (público desde el 2026-11-08).
- **Proyecto Railway:** `vozvial`, entorno `production`, con dos servicios: `vozvial` (la app) y `Postgres` (la base de datos).
- **Cómo funciona:** `railway.json` usa Railpack (Node 22), compila con `npm run build` y arranca con `npm start` (`scripts/servidor-produccion.ts`). Ese servidor sirve `dist/` como SPA, `/api/asistente` y la API de cuentas y datos cifrados en el mismo origen, con las cabeceras y la CSP de `vercel.json`. Las migraciones de la base corren al arrancar.
- **Variables del servicio `vozvial`** (los valores no se escriben en el repositorio):
  - `ANTHROPIC_API_KEY`: activa el asistente con Claude.
  - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`: la base por la red interna de Railway.
  - `SECRETO_SERVIDOR`: valor aleatorio para la sal falsa de los celulares no registrados. Se generó con:
    ```bash
    openssl rand -hex 32 | railway variable set SECRETO_SERVIDOR --stdin --service vozvial --skip-deploys
    ```
  - `RAILPACK_NODE_VERSION=22`.
- **Cuentas de demostración:** se crean desde el equipo local contra la URL pública de Postgres (`DATABASE_PUBLIC_URL` del servicio `Postgres`; la interna no se alcanza desde fuera):
  ```bash
  npx tsx scripts/sembrar-demo.ts --url-bd "$URL_PUBLICA"
  ```
  Las fechas de los casos se calculan el día de la siembra. Los accesos ficticios están en `docs/usuarios-demo.md`.
- **Redesplegar** (desde la raíz, con la CLI enlazada):
  ```bash
  railway up --ci -m "resumen del cambio"
  ```
  El código se sube desde el equipo local. El servicio no está conectado al repo de GitHub porque la app de Railway en GitHub no tiene acceso al repositorio privado. Si le das acceso en GitHub (Settings → Applications → Railway), se puede conectar para que cada push despliegue solo.
- **Comprobación hecha:** `/`, `/entrar` y `/acerca` responden 200. Las cabeceras CSP y HSTS están presentes. `/api/asistente` responde con cita o abstención, rechaza campos extra con 400 y la consola del navegador no muestra errores.
- **RNF-02 medido contra Railway:** `npm run eval:asistente -- --url https://vozvial-production.up.railway.app/api/asistente` da p50 98 ms y p95 119 ms con red (meta < 1,5 s). Ver `docs/evaluacion/asistente.md`.

Las secciones siguientes son la alternativa con Vercel. Sirven solo para el asistente: la función `api/asistente.ts` no incluye la API de cuentas ni la base de datos, así que en Vercel no funcionaría entrar desde otro celular.

Estos pasos los hace **Juan desde su propia cuenta**, cuando decida publicar. Hasta hoy (8 de noviembre de 2026) no se ha creado el repositorio remoto ni se ha desplegado nada. El proyecto ya trae `vercel.json` listo.

> **El enlace tiene que ser HTTPS.** La app usa WebCrypto (`crypto.subtle`) para el hash del PIN y el cifrado, y el navegador solo lo ofrece en un contexto seguro (HTTPS o `localhost`). Vercel da HTTPS automáticamente en `*.vercel.app` y en los dominios propios. No compartas un enlace `http://` ni una IP de la red local: ahí no se puede crear la cuenta.

## 0. Antes de publicar el repositorio

1. Revisa `data/fuentes/mintransporte-concepto-20241340906911.pdf`: puede traer el nombre de un ciudadano (`docs/pendientes-verificacion.md`, decisión 17). Si lo trae y el repositorio va a ser público, quítalo del repositorio o déjalo privado.
2. Comprueba que no hay archivos `.env` ni claves: `git status` y `git ls-files | grep -i env` no deben mostrar nada sensible. `.gitignore` ya excluye `.env*`, `.vercel/`, `dist/`, `node_modules/` y los resultados de pruebas.
3. Corre las pruebas una vez, para publicar lo mismo que se evaluó:

   ```bash
   npm ci
   npm run typecheck && npm test && npm run lint
   npm run e2e
   ```

## 1. Crear el repositorio en GitHub y subir el código

El repositorio git local ya existe, en la rama `main` y con todos los commits del ciclo de vida.

**Opción A, con la CLI de GitHub (`gh`):**

```bash
cd "/ruta/a/voz vial"
gh auth login                      # solo la primera vez
gh repo create vozvial --public --source=. --remote=origin --push
```

**Opción B, desde la web:**
1. En github.com, crea un repositorio vacío llamado `vozvial`, sin README, sin `.gitignore` y sin licencia.
2. Luego:

   ```bash
   cd "/ruta/a/voz vial"
   git remote add origin https://github.com/<tu-usuario>/vozvial.git
   git push -u origin main
   ```

Usa `--private` si prefieres que el repositorio no sea público. La entrega final pide el repositorio con `docs/`, así que la docente necesita acceso.

## 2. Publicar en Vercel con la CLI

```bash
npx vercel login          # abre el navegador para entrar a tu cuenta de Vercel
npx vercel                # primer despliegue: preview
```

En el primer `npx vercel`, la CLI pregunta:

| Pregunta | Respuesta |
|---|---|
| Set up and deploy? | `Y` |
| Which scope? | Tu cuenta personal |
| Link to existing project? | `N` |
| Project name | `vozvial` |
| In which directory is your code located? | `./` |
| Want to modify these settings? | `N`: `vercel.json` ya define la instalación (`npm ci`), el build (`npx expo export -p web`), la salida (`dist`) y la función `api/*.ts` |

Esto crea la carpeta `.vercel/`, que está en `.gitignore`, y entrega un enlace **preview**.

Cuando la preview funcione, publica la versión de producción:

```bash
npx vercel --prod
```

El enlace de producción (`https://vozvial-<algo>.vercel.app` o el que asigne Vercel) es el que va en el documento y en el video.

- Las previews suelen tener activada la protección de Vercel (piden iniciar sesión), así que **no le mandes a la docente un enlace de preview**.
- Comprueba en una ventana de incógnito que el enlace de producción abre sin pedir cuenta.
- Si la versión de Node del proyecto en Vercel es menor que 20, cámbiala en **Settings → General → Node.js Version** a 20.x o superior.

**Alternativa sin CLI:** en vercel.com, **Add New → Project → Import** el repositorio de GitHub. Deja el preset en "Other": `vercel.json` manda. Cada push a `main` desplegará producción.

## 3. Variables de entorno

**No hace falta configurar ninguna.**

| Variable | Qué hacer en Vercel |
|---|---|
| `EXPO_PUBLIC_API_URL` | No la definas. La app llama a `/api/asistente` en el mismo origen, que es lo único que permite la CSP (`connect-src 'self'`) |
| `EXPO_PUBLIC_BLOQUEO_MS`, `EXPO_PUBLIC_INACTIVIDAD_MS`, `EXPO_PUBLIC_PBKDF2_ITERACIONES` | No las definas. Sin ellas la app usa los valores reales: 5 min de bloqueo, 10 min de inactividad y 600 000 iteraciones. Los valores cortos son solo para e2e |
| `LLM_BASE_URL`, `LLM_MODELO`, `LLM_API_KEY`, `LLM_TIMEOUT_MS` | No las definas. El modo LLM queda **apagado** y el asistente responde en modo verificado, que es el que se evaluó. Solo se activa si existen `LLM_BASE_URL` y `LLM_MODELO` (propuesta para la entrega final en `docs/insumos-documento.md`) |

Si en el futuro se activa el modo LLM, las variables se agregan en **Settings → Environment Variables** o con `npx vercel env add LLM_BASE_URL production`, y después se vuelve a desplegar.

## 4. Comprobar el despliegue

Reemplaza `https://TU-DOMINIO` por el enlace de producción.

**El asistente responde con cita:**

```bash
curl -s -X POST https://TU-DOMINIO/api/asistente \
  -H 'Content-Type: application/json' \
  -d '{"pregunta":"¿Cómo pido la audiencia para impugnar el comparendo?"}'
```

Se espera un JSON con `"tipo":"respuesta"`, `"modo":"verificado"`, una lista `citas` con `L769-2002-art136` y el aviso `"VozVial informa y organiza. No reemplaza a un abogado."`.

**Solo acepta la pregunta (RNF-01).** Este debe responder 400 con `campos_no_permitidos`:

```bash
curl -s -X POST https://TU-DOMINIO/api/asistente \
  -H 'Content-Type: application/json' \
  -d '{"pregunta":"hola","nombre":"Rosa"}'
```

**Solo acepta POST.** Debe responder 405:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://TU-DOMINIO/api/asistente
```

**Cabeceras de seguridad:** debe aparecer `content-security-policy` con `default-src 'self'` y `strict-transport-security`.

```bash
curl -sI https://TU-DOMINIO/ | grep -iE 'content-security-policy|strict-transport-security|x-frame-options'
```

**En el celular, con Chrome:**
1. Abre el enlace, crea una cuenta y entra.
2. Prueba "Me pararon": debe pedir el permiso del micrófono.
3. Prueba el asistente con el micrófono.

Si el build o la función fallan, revisa el registro con `npx vercel inspect <url-del-despliegue> --logs` o en el panel del proyecto, en **Deployments**. La función `api/asistente.ts` importa los JSON de `data/` y las clases de `src/core/`, y nunca se ha compilado en Vercel: si falla, es lo primero que hay que mirar.

## 5. Medir el tiempo de respuesta desde Vercel (RNF-02)

RNF-02 pide un p95 menor a 1,5 s desde Vercel. Hasta ahora solo se midió en local. Para medirlo contra el despliegue:

```bash
npm run eval:asistente -- --url https://TU-DOMINIO/api/asistente
```

- El script corre las 60 preguntas del banco en proceso y además contra la URL, con la red incluida.
- Reescribe `docs/evaluacion/asistente.md` con una sección "Resultados contra https://TU-DOMINIO/api/asistente", que trae la precisión y los tiempos p50 y p95.
- La primera petición puede incluir el **arranque en frío** de la función. Corre el comando dos veces seguidas y reporta las dos corridas, diciendo cuál incluyó el arranque en frío. No borres la primera para que el número se vea mejor.
- Anota desde dónde se midió (ciudad y tipo de conexión).
- Haz commit de `docs/evaluacion/asistente.md` con la medición.

Si el p95 pasa de 1,5 s, RNF-02 queda "No cumple" con esa explicación.

## 6. Dominio propio (opcional)

1. En el panel del proyecto: **Settings → Domains → Add**, y escribe el dominio (por ejemplo `vozvial.tudominio.co`). Por CLI: `npx vercel domains add vozvial.tudominio.co`.
2. En el proveedor del dominio, crea el registro DNS que indique Vercel: normalmente un `CNAME` a `cname.vercel-dns.com` para un subdominio, o un registro `A` para el dominio raíz.
3. Espera a que Vercel muestre el dominio como válido. El certificado HTTPS se emite solo.

El enlace `*.vercel.app` sigue funcionando, así que el dominio propio no es necesario para la entrega.

## 7. Después de publicar

- Pon el enlace de producción en el README (sección "Despliegue"), en el documento de la actividad y en la descripción del video.
- Si cambias algo del código, haz push a `main` (si conectaste GitHub) o vuelve a correr `npx vercel --prod`.
