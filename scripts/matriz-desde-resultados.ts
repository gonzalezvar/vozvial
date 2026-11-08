// Regenera docs/evaluacion/matriz-criterios.md desde docs/evaluacion/resultados-e2e.json sin correr pruebas.
// Uso: npx tsx scripts/matriz-desde-resultados.ts
import path from 'node:path';
import { generarMatriz } from '../e2e/reporter-matriz';

const { ruta, criterios } = generarMatriz(new Date());
console.log(`Matriz regenerada con ${criterios} criterios: ${path.relative(process.cwd(), ruta)}`);
