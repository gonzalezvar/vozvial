// Servidor de produccion (Railway): reutiliza el mismo servidor que usan las pruebas e2e.
// Sirve dist/ como SPA y /api/asistente en el mismo origen, con las cabeceras de seguridad de vercel.json.
// Railway inyecta PORT; dist/ lo genera "npm run build".
import './servidor-e2e';
