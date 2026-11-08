// Jest corre en CommonJS y no admite import() sin --experimental-vm-modules.
// PGlite solo usa import() para modulos nativos de Node (fs, zlib...), asi que se cambian por require.
// Se guarda require al inicio porque PGlite declara su propio "var require" dentro de funciones.
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');

const VERSION_TRANSFORMADOR = createHash('sha256').update(readFileSync(module.filename)).digest('hex');

module.exports = {
  getCacheKey(codigo, ruta) {
    return createHash('sha256').update(VERSION_TRANSFORMADOR).update(ruta).update(codigo).digest('hex');
  },
  process(codigo) {
    const reemplazado = codigo.replace(/\bimport\((["'][^"']+["'])\)/g, 'Promise.resolve(__requireJest($1))');
    return { code: `var __requireJest = require;\n${reemplazado}` };
  },
};
