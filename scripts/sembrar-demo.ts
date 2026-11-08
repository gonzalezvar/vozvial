// Siembra las cuentas de demostracion (datos ficticios) y escribe docs/usuarios-demo.md.
// Uso: tsx scripts/sembrar-demo.ts [--url-bd URL | --pglite CARPETA] [--iteraciones N] [--solo-doc] [--sin-doc]
// Sin --url-bd usa DATABASE_URL. Nunca imprime la URL ni datos de las cuentas.
import { writeFileSync } from 'node:fs';
import path from 'node:path';

import { conectar } from '../src/servidor/bd/conexion';
import { migrar } from '../src/servidor/bd/migraciones';
import { configuracionDesdeEntorno } from '../src/servidor/configuracion';
import { documentoUsuariosDemo, sembrarDemo } from '../src/servidor/semillaDemo';

function argumento(nombre: string): string | undefined {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function principal(): Promise<void> {
  const rutaDoc = path.resolve(__dirname, '..', 'docs', 'usuarios-demo.md');
  if (!process.argv.includes('--sin-doc')) {
    writeFileSync(rutaDoc, documentoUsuariosDemo(), 'utf8');
    console.log('Escrito docs/usuarios-demo.md');
  }
  if (process.argv.includes('--solo-doc')) return;

  const url = argumento('--url-bd') ?? process.env.DATABASE_URL;
  const directorioPglite = argumento('--pglite');
  if (!url && !directorioPglite) {
    console.error('Falta --url-bd, DATABASE_URL o --pglite <carpeta>.');
    process.exitCode = 1;
    return;
  }
  const iteraciones = argumento('--iteraciones');
  const config = configuracionDesdeEntorno({ ...process.env, DATABASE_URL: url });
  const bd = await conectar({ url, directorioPglite });
  try {
    await migrar(bd);
    const resultado = await sembrarDemo(bd, config, { iteraciones: iteraciones ? Number(iteraciones) : undefined });
    const casos = resultado.cuentas.reduce((s, c) => s + c.casos, 0);
    console.log(`Sembradas ${resultado.cuentas.length} cuentas de demostración con ${casos} casos (${bd.tipo}).`);
  } finally {
    await bd.cerrar();
  }
}

principal().catch((error: unknown) => {
  console.error(`No se pudo sembrar: ${error instanceof Error ? error.message : 'error'}`);
  process.exitCode = 1;
});
