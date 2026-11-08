// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'dist/*',
      // Builds y resultados aislados de scripts/e2e-aislado.sh (dist-<nombre>, test-results-<nombre>).
      'dist-*/**',
      'test-results-*/**',
      '.cache/**',
      '.expo/*',
      'node_modules/*',
      'test-results/*',
      'playwright-report/*',
      'evidencias/*',
      // Copias descargadas de las fuentes oficiales: no son codigo del proyecto.
      'data/fuentes/*',
      // Worker y núcleo WASM de tesseract.js copiados de node_modules: código de terceros.
      'public/tesseract/**',
      'expo-env.d.ts',
    ],
  },
]);
