import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { Linter } from 'eslint';
import { requireDrift } from '../rules/require-drift.js';
import { clearAllCaches } from '../utils/async-detector/index.js';
import { createTestProject } from './helpers/test-project.js';

// =============================================================================
// SETUP
// =============================================================================

let project;

const linterConfig = {
    plugins: {
        titanpl: {
            rules: {
                'require-drift': requireDrift
            }
        }
    },
    rules: {
        'titanpl/require-drift': 'error'
    },
    languageOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
    }
};

/**
 * Lint a single code string using the real rule.
 * @param {string} code
 * @returns {import('eslint').Linter.LintMessage[]}
 */
function lint(code) {
    const linter = new Linter({ cwd: project.root });
    return linter.verify(code, linterConfig, { filename: project.testFile });
}

/**
 * Get only errors from the require-drift rule
 * @param {import('eslint').Linter.LintMessage[]} messages
 */
function ruleErrors(messages) {
    return messages.filter(m => m.ruleId === 'titanpl/require-drift');
}

// =============================================================================
// LIFECYCLE
// =============================================================================

describe('require-drift (real)', () => {
    before(() => {
        clearAllCaches();
        project = createTestProject();
    });

    after(() => {
        project.cleanup();
        clearAllCaches();
    });

    // =========================================================================
    // VALID: Direct async methods WITH drift
    // =========================================================================
    describe('valid: direct async methods with drift', () => {
        const codes = [
            `drift(t.fetch('/api/data'));`,
            `drift(Titan.fetch('/api/data'));`,
            `drift(t.core.fs.readFile('/path/to/file'));`,
            `drift(t.core.fs.writeFile('/path', 'content'));`,
            `drift(t.core.fs.remove('/file'));`,
            `drift(t.core.fs.mkdir('/dir'));`,
            `drift(t.core.fs.readdir('/dir'));`,
            `drift(t.core.fs.stat('/file'));`,
            `drift(t.core.fs.exists('/file'));`,
            `drift(t.core.crypto.hash('data'));`,
            `drift(t.core.crypto.encrypt('d', 'k'));`,
            `drift(t.core.crypto.decrypt('d', 'k'));`,
            `drift(t.core.crypto.hashKeyed('d', 'k'));`,
            `drift(t.core.net.resolveDNS('example.com'));`,
            `drift(t.core.time.sleep(1000));`,
            `drift(t.core.session.get('key'));`,
            `drift(t.core.session.set('key', 'value'));`,
        ];
        for (const code of codes) {
            it(`should pass: ${code}`, () => {
                const errs = ruleErrors(lint(code));
                assert.strictEqual(errs.length, 0, `Expected 0 errors for: ${code}`);
            });
        }
    });

    // =========================================================================
    // VALID: Titan namespace WITH drift
    // =========================================================================
    describe('valid: Titan namespace async methods with drift', () => {
        const codes = [
            `drift(Titan.core.fs.readFile('/file'));`,
            `drift(Titan.core.crypto.hash('data'));`,
        ];
        for (const code of codes) {
            it(`should pass: ${code}`, () => {
                const errs = ruleErrors(lint(code));
                assert.strictEqual(errs.length, 0, `Expected 0 errors for: ${code}`);
            });
        }
    });

    // =========================================================================
    // VALID: Third-party async methods WITH drift (node_modules)
    // =========================================================================
    describe('valid: third-party async methods with drift', () => {
        const codes = [
            `drift(t.ws.connect('wss://example.com'));`,
            `drift(t.ws.send('data'));`,
            `drift(t.ws.close());`,
            `drift(t.db.query('SELECT 1'));`,
            `drift(t.db.execute('INSERT ...'));`,
            `drift(t.db.transaction(() => {}));`,
            `drift(t.auth.login('user', 'pass'));`,
            `drift(t.auth.verify('token'));`,
            `drift(t.cache.get('key'));`,
            `drift(t.cache.set('key', 'val'));`,
            `drift(t.cache.del('key'));`,
        ];
        for (const code of codes) {
            it(`should pass: ${code}`, () => {
                const errs = ruleErrors(lint(code));
                assert.strictEqual(errs.length, 0, `Expected 0 errors for: ${code}`);
            });
        }
    });

    // =========================================================================
    // VALID: Sync methods WITHOUT drift (direct t.*)
    // =========================================================================
    describe('valid: sync methods without drift', () => {
        const codes = [
            `t.core.path.join('a', 'b');`,
            `t.core.path.resolve('/dir', 'file');`,
            `t.core.path.dirname('/path');`,
            `t.core.path.basename('/path');`,
            `t.core.path.extname('file.txt');`,
            `t.core.url.parse('http://example.com');`,
            `t.core.url.format({});`,
            `t.core.crypto.uuid();`,
            `t.core.crypto.randomBytes(32);`,
            `t.core.crypto.compare('a', 'b');`,
            `t.core.os.platform();`,
            `t.core.os.cpus();`,
            `t.core.os.totalMemory();`,
            `t.core.os.freeMemory();`,
            `t.core.os.tmpdir();`,
            `t.core.buffer.toBase64('hi');`,
            `t.core.buffer.fromBase64('aGk=');`,
            `t.core.buffer.toHex('hi');`,
            `t.core.buffer.fromHex('6869');`,
            `t.core.buffer.toUtf8('hi');`,
            `t.core.buffer.fromUtf8('hi');`,
            `t.core.time.now();`,
            `t.core.time.timestamp();`,
            `t.core.proc.pid();`,
            `t.core.proc.uptime();`,
            `t.core.net.ip();`,
            `t.core.ls.get('k');`,
            `t.core.ls.set('k', 'v');`,
            `t.core.ls.remove('k');`,
            `t.core.ls.clear();`,
            `t.core.ls.keys();`,
            `t.core.cookies.get('token');`,
            `t.core.cookies.set('token', 'val');`,
            `t.log('hello');`,
        ];
        for (const code of codes) {
            it(`should pass: ${code}`, () => {
                const errs = ruleErrors(lint(code));
                assert.strictEqual(errs.length, 0, `Expected 0 errors for: ${code}`);
            });
        }
    });

    // =========================================================================
    // VALID: Sync Titan.* methods WITHOUT drift
    // =========================================================================
    describe('valid: sync Titan.* methods without drift', () => {
        const codes = [
            `Titan.core.path.join('a', 'b');`,
        ];
        for (const code of codes) {
            it(`should pass: ${code}`, () => {
                const errs = ruleErrors(lint(code));
                assert.strictEqual(errs.length, 0, `Expected 0 errors for: ${code}`);
            });
        }
    });

    // =========================================================================
    // VALID: Sync third-party methods WITHOUT drift
    // =========================================================================
    describe('valid: sync third-party methods without drift', () => {
        const codes = [
            `t.ws.isConnected();`,
            `t.db.isConnected();`,
            `t.auth.currentUser();`,
            `t.cache.has('key');`,
        ];
        for (const code of codes) {
            it(`should pass: ${code}`, () => {
                const errs = ruleErrors(lint(code));
                assert.strictEqual(errs.length, 0, `Expected 0 errors for: ${code}`);
            });
        }
    });

    // =========================================================================
    // VALID: Non-Titan calls (not affected by this rule)
    // =========================================================================
    describe('valid: non-Titan calls', () => {
        const codes = [
            `myFunction();`,
            `someModule.method();`,
            `console.log('hello');`,
            `Math.random();`,
            `JSON.stringify({});`,
            `Array.isArray([]);`,
        ];
        for (const code of codes) {
            it(`should pass: ${code}`, () => {
                const errs = ruleErrors(lint(code));
                assert.strictEqual(errs.length, 0, `Expected 0 errors for: ${code}`);
            });
        }
    });

    // =========================================================================
    // VALID: Destructured SYNC aliases WITHOUT drift
    // =========================================================================
    describe('valid: destructured sync aliases without drift', () => {
        const codes = [
            // const { join: pathJoin } = t.core.path;
            `pathJoin('a', 'b');`,
            // const { log } = t;
            `log('hello');`,
            // const { now } = t.core.time;
            `now();`,
            // const { uuid } = t.core.crypto;
            `uuid();`,
        ];
        for (const code of codes) {
            it(`should pass: ${code}`, () => {
                const errs = ruleErrors(lint(code));
                assert.strictEqual(errs.length, 0, `Expected 0 errors for: ${code}`);
            });
        }
    });

    // =========================================================================
    // VALID: Declare global SYNC aliases WITHOUT drift
    // =========================================================================
    describe('valid: declare global sync aliases without drift', () => {
        const codes = [
            `globalPathJoin('a', 'b');`,
            `globalLog('message');`,
            `globalNow();`,
        ];
        for (const code of codes) {
            it(`should pass: ${code}`, () => {
                const errs = ruleErrors(lint(code));
                assert.strictEqual(errs.length, 0, `Expected 0 errors for: ${code}`);
            });
        }
    });

    // =========================================================================
    // VALID: Exported SYNC aliases WITHOUT drift
    // =========================================================================
    describe('valid: exported sync aliases without drift', () => {
        const codes = [
            `exportedPathJoin('a', 'b');`,
            `exportedLog('message');`,
        ];
        for (const code of codes) {
            it(`should pass: ${code}`, () => {
                const errs = ruleErrors(lint(code));
                assert.strictEqual(errs.length, 0, `Expected 0 errors for: ${code}`);
            });
        }
    });

    // =========================================================================
    // VALID: Destructured ASYNC aliases WITH drift
    // =========================================================================
    describe('valid: destructured async aliases with drift', () => {
        const codes = [
            // const { fetch } = t;
            `drift(fetch('/api'));`,
            // const { readFile } = t.core.fs;
            `drift(readFile('/file'));`,
            // const { writeFile } = t.core.fs;
            `drift(writeFile('/file', 'data'));`,
            // const { sleep } = t.core.time;
            `drift(sleep(1000));`,
            // const { connect: wsConnect } = t.ws;
            `drift(wsConnect('wss://example.com'));`,
            // const { query: dbQuery } = t.db;
            `drift(dbQuery('SELECT 1'));`,
        ];
        for (const code of codes) {
            it(`should pass: ${code}`, () => {
                const errs = ruleErrors(lint(code));
                assert.strictEqual(errs.length, 0, `Expected 0 errors for: ${code}`);
            });
        }
    });

    // =========================================================================
    // VALID: Declare global ASYNC aliases WITH drift
    // =========================================================================
    describe('valid: declare global async aliases with drift', () => {
        const codes = [
            `drift(globalFetch('/api'));`,
            `drift(globalReadFile('/file'));`,
            `drift(globalDbQuery('SELECT 1'));`,
            `drift(globalWsConnect('wss://example.com'));`,
            `drift(globalSleep(1000));`,
        ];
        for (const code of codes) {
            it(`should pass: ${code}`, () => {
                const errs = ruleErrors(lint(code));
                assert.strictEqual(errs.length, 0, `Expected 0 errors for: ${code}`);
            });
        }
    });

    // =========================================================================
    // VALID: Exported ASYNC aliases WITH drift
    // =========================================================================
    describe('valid: exported async aliases with drift', () => {
        const codes = [
            `drift(exportedFetch('/api'));`,
            `drift(exportedReadFile('/file'));`,
            `drift(exportedDbQuery('SELECT 1'));`,
            `drift(exportedSleep(1000));`,
        ];
        for (const code of codes) {
            it(`should pass: ${code}`, () => {
                const errs = ruleErrors(lint(code));
                assert.strictEqual(errs.length, 0, `Expected 0 errors for: ${code}`);
            });
        }
    });

    // =========================================================================
    // VALID: Simple assignment ASYNC aliases WITH drift
    // =========================================================================
    describe('valid: simple assignment async aliases with drift', () => {
        const codes = [
            // const myFetch = t.fetch;
            `drift(myFetch('/api'));`,
            // const myHash = t.core.crypto.hash;
            `drift(myHash('data'));`,
        ];
        for (const code of codes) {
            it(`should pass: ${code}`, () => {
                const errs = ruleErrors(lint(code));
                assert.strictEqual(errs.length, 0, `Expected 0 errors for: ${code}`);
            });
        }
    });

    // =========================================================================
    // VALID: Module assignment aliases — e.g. const db = t.db; drift(db.query())
    // =========================================================================
    describe('valid: module assignment aliases with drift', () => {
        const codes = [
            // const db = t.db; drift(db.query(...));
            `drift(db.query('SELECT 1'));`,
            // const fs = t.core.fs; drift(fs.readFile(...));
            `drift(fs.readFile('/file'));`,
        ];
        for (const code of codes) {
            it(`should pass: ${code}`, () => {
                const errs = ruleErrors(lint(code));
                assert.strictEqual(errs.length, 0, `Expected 0 errors for: ${code}`);
            });
        }
    });

    // =========================================================================
    // VALID: Module assignment SYNC sub-methods WITHOUT drift
    // =========================================================================
    describe('valid: module assignment sync sub-methods without drift', () => {
        const codes = [
            // const myPath = t.core.path; myPath.join(...)
            `myPath.join('a', 'b');`,
            // const db = t.db; db.isConnected()
            `db.isConnected();`,
        ];
        for (const code of codes) {
            it(`should pass: ${code}`, () => {
                const errs = ruleErrors(lint(code));
                assert.strictEqual(errs.length, 0, `Expected 0 errors for: ${code}`);
            });
        }
    });

    // =========================================================================
    // VALID: Object property aliases WITH drift
    // =========================================================================
    describe('valid: object property aliases with drift', () => {
        const codes = [
            // const titanUtils = { fetch: t.fetch }; drift(titanUtils.fetch(...));
            `drift(titanUtils.fetch('/api'));`,
            `drift(titanUtils.read('/file'));`,
            `drift(dbHelpers.query('SELECT 1'));`,
            `drift(dbHelpers.exec('INSERT ...'));`,
        ];
        for (const code of codes) {
            it(`should pass: ${code}`, () => {
                const errs = ruleErrors(lint(code));
                assert.strictEqual(errs.length, 0, `Expected 0 errors for: ${code}`);
            });
        }
    });

    // =========================================================================
    // VALID: Object property SYNC aliases WITHOUT drift
    // =========================================================================
    describe('valid: object property sync aliases without drift', () => {
        const codes = [
            // const titanUtils = { join: t.core.path.join }
            `titanUtils.join('a', 'b');`,
        ];
        for (const code of codes) {
            it(`should pass: ${code}`, () => {
                const errs = ruleErrors(lint(code));
                assert.strictEqual(errs.length, 0, `Expected 0 errors for: ${code}`);
            });
        }
    });

    // =========================================================================
    // INVALID: Direct async methods WITHOUT drift
    // =========================================================================
    describe('invalid: direct async methods without drift', () => {
        const codes = [
            `t.fetch('/api/data');`,
            `Titan.fetch('/api/data');`,
            `t.core.fs.readFile('/path/to/file');`,
            `t.core.fs.writeFile('/path', 'content');`,
            `t.core.fs.remove('/file');`,
            `t.core.fs.mkdir('/dir');`,
            `t.core.fs.readdir('/dir');`,
            `t.core.fs.stat('/file');`,
            `t.core.fs.exists('/file');`,
            `t.core.crypto.hash('data');`,
            `t.core.crypto.encrypt('d', 'k');`,
            `t.core.crypto.decrypt('d', 'k');`,
            `t.core.crypto.hashKeyed('d', 'k');`,
            `t.core.net.resolveDNS('example.com');`,
            `t.core.time.sleep(1000);`,
            `t.core.session.get('key');`,
            `t.core.session.set('key', 'value');`,
            `Titan.core.fs.readFile('/file');`,
            `Titan.core.crypto.hash('data');`,
        ];
        for (const code of codes) {
            it(`should fail: ${code}`, () => {
                const errs = ruleErrors(lint(code));
                assert.strictEqual(errs.length, 1, `Expected 1 error for: ${code}`);
                assert.strictEqual(errs[0].messageId, 'requireDrift');
            });
        }
    });

    // =========================================================================
    // INVALID: Third-party async methods WITHOUT drift
    // =========================================================================
    describe('invalid: third-party async methods without drift', () => {
        const codes = [
            `t.ws.connect('wss://example.com');`,
            `t.ws.send('data');`,
            `t.ws.close();`,
            `t.db.query('SELECT 1');`,
            `t.db.execute('INSERT ...');`,
            `t.db.transaction(() => {});`,
            `t.auth.login('user', 'pass');`,
            `t.auth.verify('token');`,
            `t.cache.get('key');`,
            `t.cache.set('key', 'val');`,
            `t.cache.del('key');`,
        ];
        for (const code of codes) {
            it(`should fail: ${code}`, () => {
                const errs = ruleErrors(lint(code));
                assert.strictEqual(errs.length, 1, `Expected 1 error for: ${code}`);
                assert.strictEqual(errs[0].messageId, 'requireDrift');
            });
        }
    });

    // =========================================================================
    // INVALID: Destructured ASYNC aliases WITHOUT drift
    // =========================================================================
    describe('invalid: destructured async aliases without drift', () => {
        const codes = [
            `fetch('/api');`,
            `readFile('/file');`,
            `writeFile('/file', 'data');`,
            `sleep(1000);`,
            `wsConnect('wss://example.com');`,
            `dbQuery('SELECT 1');`,
        ];
        for (const code of codes) {
            it(`should fail: ${code}`, () => {
                const errs = ruleErrors(lint(code));
                assert.strictEqual(errs.length, 1, `Expected 1 error for: ${code}`);
                assert.strictEqual(errs[0].messageId, 'requireDrift');
            });
        }
    });

    // =========================================================================
    // INVALID: Declare global ASYNC aliases WITHOUT drift
    // =========================================================================
    describe('invalid: declare global async aliases without drift', () => {
        const codes = [
            `globalFetch('/api');`,
            `globalReadFile('/file');`,
            `globalDbQuery('SELECT 1');`,
            `globalWsConnect('wss://example.com');`,
            `globalSleep(1000);`,
        ];
        for (const code of codes) {
            it(`should fail: ${code}`, () => {
                const errs = ruleErrors(lint(code));
                assert.strictEqual(errs.length, 1, `Expected 1 error for: ${code}`);
                assert.strictEqual(errs[0].messageId, 'requireDrift');
            });
        }
    });

    // =========================================================================
    // INVALID: Exported ASYNC aliases WITHOUT drift
    // =========================================================================
    describe('invalid: exported async aliases without drift', () => {
        const codes = [
            `exportedFetch('/api');`,
            `exportedReadFile('/file');`,
            `exportedDbQuery('SELECT 1');`,
            `exportedSleep(1000);`,
        ];
        for (const code of codes) {
            it(`should fail: ${code}`, () => {
                const errs = ruleErrors(lint(code));
                assert.strictEqual(errs.length, 1, `Expected 1 error for: ${code}`);
                assert.strictEqual(errs[0].messageId, 'requireDrift');
            });
        }
    });

    // =========================================================================
    // INVALID: Simple assignment ASYNC aliases WITHOUT drift
    // =========================================================================
    describe('invalid: assignment async aliases without drift', () => {
        const codes = [
            `myFetch('/api');`,
            `myHash('data');`,
        ];
        for (const code of codes) {
            it(`should fail: ${code}`, () => {
                const errs = ruleErrors(lint(code));
                assert.strictEqual(errs.length, 1, `Expected 1 error for: ${code}`);
                assert.strictEqual(errs[0].messageId, 'requireDrift');
            });
        }
    });

    // =========================================================================
    // INVALID: Module assignment ASYNC sub-methods WITHOUT drift
    // =========================================================================
    describe('invalid: module assignment async sub-methods without drift', () => {
        const codes = [
            // const db = t.db;  db.query(...) without drift
            `db.query('SELECT 1');`,
            // const fs = t.core.fs;  fs.readFile(...) without drift
            `fs.readFile('/file');`,
        ];
        for (const code of codes) {
            it(`should fail: ${code}`, () => {
                const errs = ruleErrors(lint(code));
                assert.strictEqual(errs.length, 1, `Expected 1 error for: ${code}`);
                assert.strictEqual(errs[0].messageId, 'requireDrift');
            });
        }
    });

    // =========================================================================
    // INVALID: Object property ASYNC aliases WITHOUT drift
    // =========================================================================
    describe('invalid: object property async aliases without drift', () => {
        const codes = [
            `titanUtils.fetch('/api');`,
            `titanUtils.read('/file');`,
            `dbHelpers.query('SELECT 1');`,
            `dbHelpers.exec('INSERT ...');`,
        ];
        for (const code of codes) {
            it(`should fail: ${code}`, () => {
                const errs = ruleErrors(lint(code));
                assert.strictEqual(errs.length, 1, `Expected 1 error for: ${code}`);
                assert.strictEqual(errs[0].messageId, 'requireDrift');
            });
        }
    });

    // =========================================================================
    // FALLBACK BEHAVIOUR
    // =========================================================================
    describe('fallback behaviour', () => {
        it('should NOT require drift for unknown Titan method (treated as sync)', () => {
            const errs = ruleErrors(lint(`t.unknown.newMethod();`));
            assert.strictEqual(errs.length, 0);
        });

        it('should NOT require drift for unknown Titan.* method', () => {
            const errs = ruleErrors(lint(`Titan.something.else();`));
            assert.strictEqual(errs.length, 0);
        });

        it('should NOT require drift for unknown alias (not in cache)', () => {
            const errs = ruleErrors(lint(`unknownAlias();`));
            assert.strictEqual(errs.length, 0);
        });
    });

    // =========================================================================
    // EDGE CASES
    // =========================================================================
    describe('edge cases', () => {
        it('should handle mixed direct + alias usage', () => {
            // Direct sync — OK
            let errs = ruleErrors(lint(`t.core.path.join('a', 'b');`));
            assert.strictEqual(errs.length, 0);

            // Aliased sync — OK
            errs = ruleErrors(lint(`pathJoin('a', 'b');`));
            assert.strictEqual(errs.length, 0);

            // Direct async without drift — FAIL
            errs = ruleErrors(lint(`t.fetch('/api');`));
            assert.strictEqual(errs.length, 1);

            // Aliased async without drift — FAIL
            errs = ruleErrors(lint(`fetch('/api');`));
            assert.strictEqual(errs.length, 1);
        });

        it('should not flag drift() call itself', () => {
            // drift(...) is the wrapper, not something that needs wrapping
            const errs = ruleErrors(lint(`drift(t.fetch('/api'));`));
            assert.strictEqual(errs.length, 0);
        });

        it('should handle chained calls gracefully', () => {
            // A method call on a result — not a Titan callee
            const errs = ruleErrors(lint(`t.core.path.join('a', 'b').toString();`));
            assert.strictEqual(errs.length, 0);
        });
    });
});