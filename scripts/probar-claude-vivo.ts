// Prueba manual con la API real (gasta creditos): npx tsx scripts/probar-claude-vivo.ts "pregunta" ...
// Requiere ANTHROPIC_API_KEY en el entorno. No imprime la llave.
import { crearAsistenteServidor } from '../src/servidor/crearAsistenteServidor';

const preguntas = process.argv.slice(2);
const asistente = crearAsistenteServidor({ env: process.env });

async function main() {
  for (const p of preguntas) {
    const inicio = Date.now();
    const r = await asistente.responder(p);
    const ms = Date.now() - inicio;
    console.log(`\n### ${p}\n[${r.tipo} | ${r.modo}${r.respaldo ? ' respaldo=' + r.respaldo : ''} | ${ms} ms] ${r.texto}\nCitas: ${r.citas.map((c) => c.id).join(', ') || '-'}`);
  }
}
void main();
