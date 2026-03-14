import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@agents': path.resolve(__dirname, 'src/agents'),
      '@lib': path.resolve(__dirname, 'src/lib'),
      '@mcp': path.resolve(__dirname, 'src/mcp-server'),
      '@security': path.resolve(__dirname, 'src/security'),
      '@types': path.resolve(__dirname, 'src/types'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/__tests__/**',
        '**/fixtures/**',
      ],
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
    },
    testTimeout: 30000,
    hookTimeout: 30000,
  },
})
