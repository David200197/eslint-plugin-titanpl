import { describe, it } from 'node:test';
import { RuleTester } from 'eslint';
import { driftOnlyTitanAsync } from '../rules/drift-only-titan-async.js';

const ruleTester = new RuleTester({
    languageOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        globals: {
            t: 'readonly',
            Titan: 'readonly',
            drift: 'readonly',
            console: 'readonly',
            myFunction: 'readonly',
            someModule: 'readonly',
            someVariable: 'readonly',
            someFunction: 'readonly'
        }
    }
});

describe('drift-only-titan-async', () => {
    it('should only allow drift() with async Titan method calls', () => {
        ruleTester.run('drift-only-titan-async', driftOnlyTitanAsync, {
            valid: [
                // ============================================
                // Valid: Async Titan methods with drift
                // ============================================
                
                // HTTP/Network - t namespace
                `drift(t.fetch('/api'));`,
                `const data = drift(t.fetch('/api/users'));`,
                
                // HTTP/Network - Titan namespace
                `drift(Titan.fetch('/api'));`,
                
                // File System (async) - t namespace
                `drift(t.core.fs.readFile('/file'));`,
                `drift(t.core.fs.writeFile('/file', 'data'));`,
                `drift(t.core.fs.remove('/file'));`,
                `drift(t.core.fs.mkdir('/dir'));`,
                `drift(t.core.fs.readdir('/dir'));`,
                `drift(t.core.fs.stat('/file'));`,
                `drift(t.core.fs.exists('/file'));`,
                
                // File System (async) - Titan namespace
                `drift(Titan.core.fs.readFile('/file'));`,
                `drift(Titan.core.fs.writeFile('/file', 'content'));`,
                `drift(Titan.core.fs.remove('/path'));`,
                `drift(Titan.core.fs.mkdir('/directory'));`,
                `drift(Titan.core.fs.readdir('/directory'));`,
                `drift(Titan.core.fs.stat('/path'));`,
                `drift(Titan.core.fs.exists('/path'));`,
                
                // Crypto (async) - t namespace
                `drift(t.core.crypto.hash('data'));`,
                `drift(t.core.crypto.encrypt('data', 'key'));`,
                `drift(t.core.crypto.decrypt('encrypted', 'key'));`,
                `drift(t.core.crypto.hashKeyed('sha256', 'key', 'message'));`,
                
                // Crypto (async) - Titan namespace
                `drift(Titan.core.crypto.hash('data'));`,
                `drift(Titan.core.crypto.encrypt('data', 'key'));`,
                `drift(Titan.core.crypto.decrypt('encrypted', 'key'));`,
                `drift(Titan.core.crypto.hashKeyed('sha256', 'key', 'msg'));`,
                
                // Network (async)
                `drift(t.core.net.resolveDNS('example.com'));`,
                `drift(Titan.core.net.resolveDNS('google.com'));`,
                
                // Time (async)
                `drift(t.core.time.sleep(1000));`,
                `drift(Titan.core.time.sleep(500));`,
                
                // Session (async) - t namespace
                `drift(t.core.session.get('key'));`,
                `drift(t.core.session.set('key', 'value'));`,
                `drift(t.core.session.delete('key'));`,
                `drift(t.core.session.clear());`,
                
                // Session (async) - Titan namespace
                `drift(Titan.core.session.get('sessionKey'));`,
                `drift(Titan.core.session.set('sessionKey', 'sessionValue'));`,
                `drift(Titan.core.session.delete('sessionKey'));`,
                `drift(Titan.core.session.clear());`,
                
                // With result assignment
                `const result = drift(t.core.fs.readFile('/config.json'));`,
                `const exists = drift(t.core.fs.exists('/path/to/file'));`,
                
                // ============================================
                // Non-drift calls are NOT checked by this rule
                // (require-drift rule handles these)
                // ============================================
                `t.core.path.join('a', 'b');`,
                `t.fetch('/api');`,
                `someFunction();`,
                `console.log('test');`,
                `myFunction();`,
            ],
            invalid: [
                // ============================================
                // Invalid: drift without argument
                // ============================================
                {
                    code: `drift();`,
                    errors: [{ messageId: 'driftRequiresArgument' }]
                },
                
                // ============================================
                // Invalid: drift with method reference (not a call)
                // ============================================
                {
                    code: `drift(t.fetch);`,
                    errors: [{ messageId: 'driftRequiresCall' }]
                },
                {
                    code: `drift(t.core.fs.readFile);`,
                    errors: [{ messageId: 'driftRequiresCall' }]
                },
                {
                    code: `drift(Titan.fetch);`,
                    errors: [{ messageId: 'driftRequiresCall' }]
                },
                {
                    code: `drift(Titan.core.crypto.hash);`,
                    errors: [{ messageId: 'driftRequiresCall' }]
                },
                
                // ============================================
                // Invalid: drift with non-Titan function call
                // ============================================
                {
                    code: `drift(myFunction());`,
                    errors: [{ messageId: 'driftOnlyForTitanAsync' }]
                },
                {
                    code: `drift(someModule.method());`,
                    errors: [{ messageId: 'driftOnlyForTitanAsync' }]
                },
                {
                    code: `drift(console.log('test'));`,
                    errors: [{ messageId: 'driftOnlyForTitanAsync' }]
                },
                {
                    code: `drift(fetch('/api'));`,
                    errors: [{ messageId: 'driftOnlyForTitanAsync' }]
                },
                {
                    code: `drift(Promise.resolve(1));`,
                    errors: [{ messageId: 'driftOnlyForTitanAsync' }]
                },
                {
                    code: `drift(Math.random());`,
                    errors: [{ messageId: 'driftOnlyForTitanAsync' }]
                },
                {
                    code: `drift(JSON.parse('{}'));`,
                    errors: [{ messageId: 'driftOnlyForTitanAsync' }]
                },
                {
                    code: `drift(Object.keys(obj));`,
                    errors: [{ messageId: 'driftOnlyForTitanAsync' }]
                },
                {
                    code: `drift(Array.from([1, 2, 3]));`,
                    errors: [{ messageId: 'driftOnlyForTitanAsync' }]
                },
                
                // ============================================
                // Invalid: drift with variable (can't verify it's Titan)
                // ============================================
                {
                    code: `drift(someVariable);`,
                    errors: [{ messageId: 'driftOnlyForTitanAsync' }]
                },
                {
                    code: `drift(unknownRef);`,
                    errors: [{ messageId: 'driftOnlyForTitanAsync' }]
                },
                {
                    code: `drift(promise);`,
                    errors: [{ messageId: 'driftOnlyForTitanAsync' }]
                },
                
                // ============================================
                // Invalid: drift with function expression
                // ============================================
                {
                    code: `drift(() => {});`,
                    errors: [{ messageId: 'driftOnlyForTitanAsync' }]
                },
                {
                    code: `drift(function() {});`,
                    errors: [{ messageId: 'driftOnlyForTitanAsync' }]
                },
                {
                    code: `drift(async () => {});`,
                    errors: [{ messageId: 'driftOnlyForTitanAsync' }]
                },
                {
                    code: `drift(async function() {});`,
                    errors: [{ messageId: 'driftOnlyForTitanAsync' }]
                },
                
                // ============================================
                // Invalid: drift with SYNC Titan methods
                // (they don't need drift - this is the key check!)
                // ============================================
                
                // Path (sync) - t namespace
                {
                    code: `drift(t.core.path.join('a', 'b'));`,
                    errors: [{ messageId: 'driftNotForSyncMethods' }]
                },
                {
                    code: `drift(t.core.path.resolve('/dir', 'file'));`,
                    errors: [{ messageId: 'driftNotForSyncMethods' }]
                },
                {
                    code: `drift(t.core.path.dirname('/path/to/file.txt'));`,
                    errors: [{ messageId: 'driftNotForSyncMethods' }]
                },
                {
                    code: `drift(t.core.path.basename('/path/to/file.txt'));`,
                    errors: [{ messageId: 'driftNotForSyncMethods' }]
                },
                {
                    code: `drift(t.core.path.extname('file.txt'));`,
                    errors: [{ messageId: 'driftNotForSyncMethods' }]
                },
                
                // Path (sync) - Titan namespace
                {
                    code: `drift(Titan.core.path.join('a', 'b'));`,
                    errors: [{ messageId: 'driftNotForSyncMethods' }]
                },
                {
                    code: `drift(Titan.core.path.resolve('/base', 'file'));`,
                    errors: [{ messageId: 'driftNotForSyncMethods' }]
                },
                
                // URL (sync)
                {
                    code: `drift(t.core.url.parse('http://example.com'));`,
                    errors: [{ messageId: 'driftNotForSyncMethods' }]
                },
                {
                    code: `drift(t.core.url.format({ host: 'example.com' }));`,
                    errors: [{ messageId: 'driftNotForSyncMethods' }]
                },
                {
                    code: `drift(Titan.core.url.parse('https://titan.dev'));`,
                    errors: [{ messageId: 'driftNotForSyncMethods' }]
                },
                
                // Crypto SYNC methods (uuid, randomBytes, compare)
                {
                    code: `drift(t.core.crypto.uuid());`,
                    errors: [{ messageId: 'driftNotForSyncMethods' }]
                },
                {
                    code: `drift(t.core.crypto.randomBytes(32));`,
                    errors: [{ messageId: 'driftNotForSyncMethods' }]
                },
                {
                    code: `drift(t.core.crypto.compare('hash1', 'hash2'));`,
                    errors: [{ messageId: 'driftNotForSyncMethods' }]
                },
                {
                    code: `drift(Titan.core.crypto.uuid());`,
                    errors: [{ messageId: 'driftNotForSyncMethods' }]
                },
                
                // OS (sync)
                {
                    code: `drift(t.core.os.platform());`,
                    errors: [{ messageId: 'driftNotForSyncMethods' }]
                },
                {
                    code: `drift(t.core.os.cpus());`,
                    errors: [{ messageId: 'driftNotForSyncMethods' }]
                },
                {
                    code: `drift(t.core.os.totalMemory());`,
                    errors: [{ messageId: 'driftNotForSyncMethods' }]
                },
                {
                    code: `drift(t.core.os.freeMemory());`,
                    errors: [{ messageId: 'driftNotForSyncMethods' }]
                },
                {
                    code: `drift(t.core.os.tmpdir());`,
                    errors: [{ messageId: 'driftNotForSyncMethods' }]
                },
                {
                    code: `drift(Titan.core.os.platform());`,
                    errors: [{ messageId: 'driftNotForSyncMethods' }]
                },
                
                // Buffer (sync)
                {
                    code: `drift(t.core.buffer.toBase64('hello'));`,
                    errors: [{ messageId: 'driftNotForSyncMethods' }]
                },
                {
                    code: `drift(t.core.buffer.fromBase64('aGVsbG8='));`,
                    errors: [{ messageId: 'driftNotForSyncMethods' }]
                },
                {
                    code: `drift(t.core.buffer.toHex('hello'));`,
                    errors: [{ messageId: 'driftNotForSyncMethods' }]
                },
                {
                    code: `drift(t.core.buffer.fromHex('68656c6c6f'));`,
                    errors: [{ messageId: 'driftNotForSyncMethods' }]
                },
                {
                    code: `drift(t.core.buffer.toUtf8(bytes));`,
                    errors: [{ messageId: 'driftNotForSyncMethods' }]
                },
                {
                    code: `drift(t.core.buffer.fromUtf8('text'));`,
                    errors: [{ messageId: 'driftNotForSyncMethods' }]
                },
                
                // Time SYNC methods (now, timestamp - NOT sleep)
                {
                    code: `drift(t.core.time.now());`,
                    errors: [{ messageId: 'driftNotForSyncMethods' }]
                },
                {
                    code: `drift(t.core.time.timestamp());`,
                    errors: [{ messageId: 'driftNotForSyncMethods' }]
                },
                {
                    code: `drift(Titan.core.time.now());`,
                    errors: [{ messageId: 'driftNotForSyncMethods' }]
                },
                
                // Process (sync)
                {
                    code: `drift(t.core.proc.pid());`,
                    errors: [{ messageId: 'driftNotForSyncMethods' }]
                },
                {
                    code: `drift(t.core.proc.uptime());`,
                    errors: [{ messageId: 'driftNotForSyncMethods' }]
                },
                {
                    code: `drift(Titan.core.proc.pid());`,
                    errors: [{ messageId: 'driftNotForSyncMethods' }]
                },
                
                // Net SYNC methods (ip - NOT resolveDNS)
                {
                    code: `drift(t.core.net.ip());`,
                    errors: [{ messageId: 'driftNotForSyncMethods' }]
                },
                {
                    code: `drift(Titan.core.net.ip());`,
                    errors: [{ messageId: 'driftNotForSyncMethods' }]
                },
                
                // Local Storage (sync)
                {
                    code: `drift(t.core.ls.get('key'));`,
                    errors: [{ messageId: 'driftNotForSyncMethods' }]
                },
                {
                    code: `drift(t.core.ls.set('key', 'value'));`,
                    errors: [{ messageId: 'driftNotForSyncMethods' }]
                },
                {
                    code: `drift(t.core.ls.remove('key'));`,
                    errors: [{ messageId: 'driftNotForSyncMethods' }]
                },
                {
                    code: `drift(t.core.ls.clear());`,
                    errors: [{ messageId: 'driftNotForSyncMethods' }]
                },
                {
                    code: `drift(t.core.ls.keys());`,
                    errors: [{ messageId: 'driftNotForSyncMethods' }]
                },
                
                // Cookies (sync)
                {
                    code: `drift(t.core.cookies.get(req, 'token'));`,
                    errors: [{ messageId: 'driftNotForSyncMethods' }]
                },
                {
                    code: `drift(t.core.cookies.set(res, 'token', 'value'));`,
                    errors: [{ messageId: 'driftNotForSyncMethods' }]
                },
                {
                    code: `drift(t.core.cookies.delete(res, 'token'));`,
                    errors: [{ messageId: 'driftNotForSyncMethods' }]
                },
                
                // ============================================
                // Invalid: drift with literals
                // ============================================
                {
                    code: `drift('string');`,
                    errors: [{ messageId: 'driftOnlyForTitanAsync' }]
                },
                {
                    code: `drift(123);`,
                    errors: [{ messageId: 'driftOnlyForTitanAsync' }]
                },
                {
                    code: `drift(true);`,
                    errors: [{ messageId: 'driftOnlyForTitanAsync' }]
                },
                {
                    code: `drift(false);`,
                    errors: [{ messageId: 'driftOnlyForTitanAsync' }]
                },
                {
                    code: `drift(null);`,
                    errors: [{ messageId: 'driftOnlyForTitanAsync' }]
                },
                
                // ============================================
                // Invalid: drift with objects/arrays
                // ============================================
                {
                    code: `drift({});`,
                    errors: [{ messageId: 'driftOnlyForTitanAsync' }]
                },
                {
                    code: `drift([]);`,
                    errors: [{ messageId: 'driftOnlyForTitanAsync' }]
                },
                {
                    code: `drift({ key: 'value' });`,
                    errors: [{ messageId: 'driftOnlyForTitanAsync' }]
                },
                {
                    code: `drift([1, 2, 3]);`,
                    errors: [{ messageId: 'driftOnlyForTitanAsync' }]
                },
            ]
        });
    });
});