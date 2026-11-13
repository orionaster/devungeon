import { defineConfig } from 'vitest/config';

// Consumer source/dependency snapshots live under ignored output/. They have
// their own test commands and must never be discovered as compiler unit tests.
export default defineConfig({ test: { include: ['test/**/*.test.ts'] } });
