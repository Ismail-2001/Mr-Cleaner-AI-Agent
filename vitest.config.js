import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['tests/**/*.test.js'],
        exclude: ['tests/integration.test.js', 'node_modules'],
        coverage: {
            include: ['lib/**/*.js', 'app/api/**/route.js'],
            exclude: ['lib/mock-data.js'],
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname),
        },
    },
});
