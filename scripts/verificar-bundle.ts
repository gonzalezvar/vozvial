// Revisa el build web (dist/ o la carpeta que se pase) y falla si encuentra rastros del SDK de
// Anthropic o del prompt del servidor. Corre después de "npm run build" y de "npm run build:web".
// Uso: tsx scripts/verificar-bundle.ts [carpeta]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

// "Anthropic" a secas sí aparece en la app (la política de datos lo nombra), por eso se buscan
// marcadores que solo trae el SDK, la llave o el system del servidor.
export const MARCADORES: readonly string[] = [
  '@anthropic-ai',
  'api.anthropic.com',
  'anthropic-version',
  'sk-ant-',
  'ANTHROPIC_API_KEY',
  '<articulos>',
];

const EXTENSIONES = new Set(['.js', '.mjs', '.html', '.json', '.css', '.map', '.txt']);

function archivos(dir: string): string[] {
  const salida: string[] = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = path.join(dir, nombre);
    if (statSync(ruta).isDirectory()) salida.push(...archivos(ruta));
    else if (EXTENSIONES.has(path.extname(nombre))) salida.push(ruta);
  }
  return salida;
}

/** Devuelve "archivo: marcador" por cada hallazgo. Vacío si el build está limpio. */
export function revisarBundle(dir: string): string[] {
  const hallazgos: string[] = [];
  for (const ruta of archivos(dir)) {
    const contenido = readFileSync(ruta, 'utf8');
    for (const marcador of MARCADORES) {
      if (contenido.includes(marcador)) hallazgos.push(`${path.relative(dir, ruta)}: ${marcador}`);
    }
  }
  return hallazgos;
}

if (require.main === module) {
  const dir = path.resolve(process.argv[2] ?? 'dist');
  const js = archivos(dir).filter((r) => r.endsWith('.js'));
  if (js.length === 0) {
    console.error(`No hay archivos .js en ${dir}: no se pudo revisar el build.`);
    process.exit(1);
  }
  const hallazgos = revisarBundle(dir);
  if (hallazgos.length > 0) {
    console.error('El build web contiene código o datos que solo deben estar en el servidor:');
    for (const h of hallazgos) console.error(`  ${h}`);
    process.exit(1);
  }
  console.log(`Build revisado: ${js.length} archivos .js sin rastros del SDK de Anthropic ni del prompt del servidor.`);
}
