import { describe, it } from 'node:test';
import { RuleTester } from 'eslint';
import { requireDrift } from '../rules/require-drift.js';

const ruleTester = new RuleTester({
    languageOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        globals: {
            t: 'readonly',
            Titan: 'readonly',
            drift: 'readonly'
        }
    }
});

describe('require-drift', () => {
    it('should require drift() for async Titan methods', () => {
        ruleTester.run('require-drift', requireDrift, {
            valid: [
                // Correctly using drift with async methods
                `drift(t.fetch('/api/data'));`,
                `drift(Titan.fetch('/api/data'));`,
                `drift(t.core.fs.readFile('/path/to/file'));`,
                `drift(t.core.fs.writeFile('/path', 'content'));`,
                `drift(t.core.crypto.hash('data'));`,
                `drift(t.core.time.sleep(1000));`,
                `drift(t.core.net.resolveDNS('example.com'));`,
                
                // Sync methods don't need drift
                `t.core.path.join('a', 'b');`,
                `t.core.url.parse('http://example.com');`,
                `t.core.crypto.uuid();`,
                
                // Non-Titan calls
                `myFunction();`,
                `someModule.method();`,
                `console.log('hello');`,
                
                // Store drift result
                `const result = drift(t.core.fs.readFile('/file'));`,
            ],
            invalid: [
                // t.fetch without drift
                {
                    code: `t.fetch('/api/data');`,
                    errors: [{ messageId: 'requireDrift' }]
                },
                {
                    code: `Titan.fetch('/api/data');`,
                    errors: [{ messageId: 'requireDrift' }]
                },
                
                // t.core.fs async methods without drift
                {
                    code: `t.core.fs.readFile('/path/to/file');`,
                    errors: [{ messageId: 'requireDrift' }]
                },
                {
                    code: `t.core.fs.writeFile('/path', 'content');`,
                    errors: [{ messageId: 'requireDrift' }]
                },
                {
                    code: `t.core.fs.remove('/path');`,
                    errors: [{ messageId: 'requireDrift' }]
                },
                {
                    code: `t.core.fs.mkdir('/dir');`,
                    errors: [{ messageId: 'requireDrift' }]
                },
                {
                    code: `t.core.fs.readdir('/dir');`,
                    errors: [{ messageId: 'requireDrift' }]
                },
                {
                    code: `t.core.fs.stat('/file');`,
                    errors: [{ messageId: 'requireDrift' }]
                },
                {
                    code: `t.core.fs.exists('/file');`,
                    errors: [{ messageId: 'requireDrift' }]
                },
                
                // t.core.crypto async methods without drift
                {
                    code: `t.core.crypto.hash('data');`,
                    errors: [{ messageId: 'requireDrift' }]
                },
                {
                    code: `t.core.crypto.encrypt('data', 'key');`,
                    errors: [{ messageId: 'requireDrift' }]
                },
                {
                    code: `t.core.crypto.decrypt('data', 'key');`,
                    errors: [{ messageId: 'requireDrift' }]
                },
                
                // t.core.net async methods without drift
                {
                    code: `t.core.net.resolveDNS('example.com');`,
                    errors: [{ messageId: 'requireDrift' }]
                },
                
                // t.core.time async methods without drift
                {
                    code: `t.core.time.sleep(1000);`,
                    errors: [{ messageId: 'requireDrift' }]
                },
                
                // t.core.session async methods without drift
                {
                    code: `t.core.session.get('key');`,
                    errors: [{ messageId: 'requireDrift' }]
                },
                {
                    code: `t.core.session.set('key', 'value');`,
                    errors: [{ messageId: 'requireDrift' }]
                },
                
                // Titan namespace without drift
                {
                    code: `Titan.core.fs.readFile('/file');`,
                    errors: [{ messageId: 'requireDrift' }]
                },
                {
                    code: `Titan.core.crypto.hash('data');`,
                    errors: [{ messageId: 'requireDrift' }]
                },
            ]
        });
    });
});