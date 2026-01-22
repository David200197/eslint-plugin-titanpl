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
                `import axios from 'axios'`,
                `import utils from './utils.js'`,
                `import config from '../config.js'`,
                `export { foo } from './foo.js'`,
                `export * from './helpers/index.js'`,
            ],
            invalid: [
                // ============================================
                // Módulos CON alternativa en Titan
                // ============================================
                
                // fs → t.core.fs
                {
                    code: `import fs from 'fs'`,
                    errors: [{ messageId: 'notAvailable' }]
                },
                {
                    code: `import { readFile } from 'node:fs'`,
                    errors: [{ messageId: 'notAvailable' }]
                },
                
                // path → t.core.path
                {
                    code: `import path from 'path'`,
                    errors: [{ messageId: 'notAvailable' }]
                },
                {
                    code: `export { join } from 'path'`,
                    errors: [{ messageId: 'notAvailable' }]
                },
                
                // crypto → t.core.crypto
                {
                    code: `import crypto from 'crypto'`,
                    errors: [{ messageId: 'notAvailable' }]
                },
                
                // os → t.core.os
                {
                    code: `import os from 'os'`,
                    errors: [{ messageId: 'notAvailable' }]
                },
                
                // http/https → t.fetch()
                {
                    code: `import http from 'http'`,
                    errors: [{ messageId: 'notAvailable' }]
                },
                {
                    code: `import https from 'https'`,
                    errors: [{ messageId: 'notAvailable' }]
                },
                
                // buffer → t.core.buffer
                {
                    code: `import { Buffer } from 'buffer'`,
                    errors: [{ messageId: 'notAvailable' }]
                },
                
                // url → t.core.url
                {
                    code: `import { URL } from 'url'`,
                    errors: [{ messageId: 'notAvailable' }]
                },
                
                // querystring → t.core.url.SearchParams
                {
                    code: `import qs from 'querystring'`,
                    errors: [{ messageId: 'notAvailable' }]
                },
                
                // dns → t.core.net.resolveDNS()
                {
                    code: `import dns from 'dns'`,
                    errors: [{ messageId: 'notAvailable' }]
                },
                
                // net → t.core.net
                {
                    code: `import net from 'net'`,
                    errors: [{ messageId: 'notAvailable' }]
                },
                
                // timers → t.core.time
                {
                    code: `import { setTimeout } from 'timers'`,
                    errors: [{ messageId: 'notAvailable' }]
                },
                
                // process → t.core.proc
                {
                    code: `import process from 'process'`,
                    errors: [{ messageId: 'notAvailable' }]
                },
                
                // Import dinámico con alternativa
                {
                    code: `const fs = await import('fs')`,
                    errors: [{ messageId: 'notAvailable' }]
                },
                
                // ============================================
                // Módulos SIN alternativa en Titan
                // ============================================
                
                {
                    code: `import { spawn } from 'child_process'`,
                    errors: [{ messageId: 'notAvailableNoAlt' }]
                },
                {
                    code: `import { Worker } from 'worker_threads'`,
                    errors: [{ messageId: 'notAvailableNoAlt' }]
                },
                {
                    code: `import { EventEmitter } from 'events'`,
                    errors: [{ messageId: 'notAvailableNoAlt' }]
                },
                {
                    code: `export * from 'events'`,
                    errors: [{ messageId: 'notAvailableNoAlt' }]
                },
                {
                    code: `import { createReadStream } from 'stream'`,
                    errors: [{ messageId: 'notAvailableNoAlt' }]
                },
                {
                    code: `import cluster from 'cluster'`,
                    errors: [{ messageId: 'notAvailableNoAlt' }]
                },
                {
                    code: `import zlib from 'zlib'`,
                    errors: [{ messageId: 'notAvailableNoAlt' }]
                },
                {
                    code: `import assert from 'assert'`,
                    errors: [{ messageId: 'notAvailableNoAlt' }]
                },
                
                // Import dinámico sin alternativa
                {
                    code: `const { spawn } = await import('child_process')`,
                    errors: [{ messageId: 'notAvailableNoAlt' }]
                },
            ]
        });
    });
});