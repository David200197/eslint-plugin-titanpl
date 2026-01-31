import { noNodeBuiltins } from './rules/no-node-builtins.js';
import { noAsyncAwait } from './rules/no-async-await.js';
import { driftOnlyTitanAsync } from './rules/drift-only-titan-async.js';
import { requireDrift } from './rules/require-drift.js';
import globals from 'globals';

const plugin = {
    rules: {
        'no-node-builtins': noNodeBuiltins,
        'no-async-await': noAsyncAwait,
        'drift-only-titan-async': driftOnlyTitanAsync,
        'require-drift': requireDrift
    },
};

/**
 * Recommended configuration for TitanPL projects
 */
export const titanpl = {
    files: ['app/**/*.js', 'app/**/*.ts'],
    ignores: ['**/*.d.ts'],
    plugins: {
        titanpl: plugin
    },
    languageOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        globals: {
            ...globals.es2024,
            t: 'readonly',
            Titan: 'readonly',
            drift: 'readonly',
            defineAction: 'readonly',
            req: 'readonly'
        }
    },
    rules: {
        'no-undef': 'error',
        'titanpl/no-node-builtins': 'error',
        'titanpl/no-async-await': 'error',
        'titanpl/drift-only-titan-async': 'error',
        'titanpl/require-drift': 'error'
    },
};

export default plugin;