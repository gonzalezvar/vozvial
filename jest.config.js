// Dos proyectos: el dominio (src/core) corre en Node puro para usar el WebCrypto
// de Node en globalThis.crypto; el resto usa el entorno de jest-expo.
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
      ...comun,
      displayName: 'app',
      testMatch: ['<rootDir>/tests/unit/**/*.test.ts?(x)'],
      testPathIgnorePatterns: ['/node_modules/', '<rootDir>/tests/unit/core/'],
    },
  ],
};
