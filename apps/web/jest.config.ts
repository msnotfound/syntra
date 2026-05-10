import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          moduleResolution: 'node',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          jsx: 'react-jsx',
        },
      },
    ],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@/(.*)$': '<rootDir>/$1',
    '^@syntra/llm$': '<rootDir>/../../packages/llm/index.ts',
    '^@syntra/shared$': '<rootDir>/../../packages/shared/index.ts',
    '^@syntra/shared/mocks/(.*)$': '<rootDir>/../../packages/shared/mocks/$1.ts',
    '^@syntra/shared/token-encrypt$': '<rootDir>/../../packages/shared/token-encrypt.ts',
    '^@syntra/db$': '<rootDir>/../../packages/db/index.ts',
    '^@syntra/ui/(.*)$': '<rootDir>/../../packages/ui/$1.ts',
    '^bullmq$': '<rootDir>/../../packages/shared/mocks/bullmq.ts',
  },
};

export default config;
