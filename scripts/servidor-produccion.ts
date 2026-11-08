// Servidor de produccion (Railway): reutiliza el mismo servidor que usan las pruebas e2e.
// Sirve dist/ como SPA, /api/asistente y la API de cuentas y datos cifrados en el mismo origen, con las cabeceras de seguridad de vercel.json.
// Con DATABASE_URL usa el Postgres de Railway; sin ella, PGlite en memoria.
// Railway inyecta PORT; dist/ lo genera "npm run build".
import './servidor-e2e';
