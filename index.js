import { noNodeBuiltins } from './rules/no-node-builtins.js';
import globals from 'globals';

const plugin = {
    rules: {
        'no-node-builtins': noNodeBuiltins
    }
};

export const titanpl = {
    files: ['app/**/*.js'],
    plugins: {
        titanpl: plugin
    },
    languageOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        globals: {
            ...globals.es2024,
            t: 'readonly',
            Titan: 'readonly'
        }
    },
    rules: {
        'no-undef': 'error',
        'titanpl/no-node-builtins': 'error'
    }
};

export default plugin;