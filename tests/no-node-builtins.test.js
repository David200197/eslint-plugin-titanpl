import { describe, it } from 'node:test';
import { RuleTester } from 'eslint';
import { noNodeBuiltins } from '../rules/no-node-builtins.js';

const ruleTester = new RuleTester({
    languageOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
    }
});

describe('no-node-builtins', () => {
    it('should pass valid and invalid cases', () => {
        ruleTester.run('no-node-builtins', noNodeBuiltins, {
            valid: [
                `import { something } from 'lodash'`,
                `import utils from './utils.js'`,
                `export { foo } from './foo.js'`,
            ],
            invalid: [
                // fs - tiene alternativa t.core.fs
                {
                    code: `import fs from 'fs'`,
                    errors: [{ messageId: 'notAvailable' }]
                },
                // node:fs - mismo caso con prefijo node:
                {
                    code: `import { readFile } from 'node:fs'`,
                    errors: [{ messageId: 'notAvailable' }]
                },
                // path - tiene alternativa t.core.path
                {
                    code: `import path from 'path'`,
                    errors: [{ messageId: 'notAvailable' }]
                },
                // export desde path
                {
                    code: `export { join } from 'path'`,
                    errors: [{ messageId: 'notAvailable' }]
                },
                // import dinámico
                {
                    code: `const fs = await import('fs')`,
                    errors: [{ messageId: 'notAvailable' }]
                },
                // crypto - tiene alternativa t.core.crypto
                {
                    code: `import crypto from 'crypto'`,
                    errors: [{ messageId: 'notAvailable' }]
                },
                // os - tiene alternativa t.core.os
                {
                    code: `import os from 'os'`,
                    errors: [{ messageId: 'notAvailable' }]
                },
                // http - tiene alternativa t.fetch()
                {
                    code: `import http from 'http'`,
                    errors: [{ messageId: 'notAvailable' }]
                },
                // child_process - NO tiene alternativa
                {
                    code: `import { spawn } from 'child_process'`,
                    errors: [{ messageId: 'notAvailableNoAlt' }]
                },
                // worker_threads - NO tiene alternativa
                {
                    code: `import { Worker } from 'worker_threads'`,
                    errors: [{ messageId: 'notAvailableNoAlt' }]
                },
                // export all desde módulo sin alternativa
                {
                    code: `export * from 'events'`,
                    errors: [{ messageId: 'notAvailableNoAlt' }]
                },
            ]
        });
    });
});