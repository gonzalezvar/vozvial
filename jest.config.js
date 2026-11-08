// Tres proyectos: el dominio (src/core) corre en Node puro para usar el WebCrypto
// de Node en globalThis.crypto; el código solo de servidor (src/servidor, con el
// SDK de Anthropic) también corre en Node; el resto usa el entorno de jest-expo.
const presetExpo = require('jest-expo/jest-preset');

const comun = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};

module.exports = {
  projects: [
    {
      ...comun,
      displayName: 'core',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/unit/core/**/*.test.ts?(x)'],
    },
    {
      // Sin el preset de jest-expo: su setup reemplaza fetch por el de Expo (un stub en pruebas) y define
      // window, y el codigo de servidor necesita el fetch real de Node y PGlite sin window.
      displayName: 'servidor',
      testEnvironment: 'node',
      moduleNameMapper: comun.moduleNameMapper,
      testMatch: ['<rootDir>/tests/unit/servidor/**/*.test.ts?(x)'],
      transform: {
        // PGlite (Postgres en proceso) se transforma para cambiar sus import() por require.
        '@electric-sql/pglite/.+\\.cjs$': '<rootDir>/scripts/jest/transformar-import-dinamico.js',
        '\\.[jt]sx?$': presetExpo.transform['\\.[jt]sx?$'],
      },
      // expo/virtual/env lo inyecta babel-preset-expo al leer EXPO_PUBLIC_*.
      transformIgnorePatterns: ['/node_modules/(?!(@electric-sql|expo)/)'],
    },
    {
      ...comun,
      displayName: 'app',
      testMatch: ['<rootDir>/tests/unit/**/*.test.ts?(x)'],
      testPathIgnorePatterns: ['/node_modules/', '<rootDir>/tests/unit/core/', '<rootDir>/tests/unit/servidor/'],
    },
  ],
};
