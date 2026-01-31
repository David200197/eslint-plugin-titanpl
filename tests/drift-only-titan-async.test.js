import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { Linter } from 'eslint';
import { driftOnlyTitanAsync } from '../rules/drift-only-titan-async.js';
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
                'drift-only-titan-async': driftOnlyTitanAsync
            }
        }
    },
    rules: {
        'titanpl/drift-only-titan-async': 'error'
    },
    languageOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
    }
};

/**
 * Lint a single code string using the real rule, with filename pointing to
 * the temp project so the dts-file-checker finds the .d.ts files.
 *
 * @param {string} code
 * @returns {import('eslint').Linter.LintMessage[]}
 */
function lint(code) {
    const linter = new Linter({ cwd: project.root });
    return linter.verify(code, linterConfig, { filename: project.testFile });
}

/**
 * Get only errors from the drift-only-titan-async rule
 * @param {import('eslint').Linter.LintMessage[]} messages
 */
function ruleErrors(messages) {
    return messages.filter(m => m.ruleId === 'titanpl/drift-only-titan-async');
}

// =============================================================================
// LIFECYCLE
// =============================================================================

describe('drift-only-titan-async (real)', () => {
    before(() => {
        clearAllCaches();
        project = createTestProject();
    });

    after(() => {
        project.cleanup();
        clearAllCaches();
    });

    // =========================================================================
    // VALID: Direct async Titan methods with drift (declare namespace t)
    // =========================================================================
    describe('valid: direct async t.* methods with drift', () => {
        const codes = [
            `drift(t.fetch('/api'));`,
            `drift(t.core.fs.readFile('/file'));`,
            `drift(t.core.fs.writeFile('/file', 'data'));`,
            `drift(t.core.fs.remove('/file'));`,
            `drift(t.core.fs.mkdir('/dir'));`,
            `drift(t.core.fs.readdir('/dir'));`,
            `drift(t.core.fs.stat('/file'));`,
            `drift(t.core.fs.exists('/file'));`,
            `drift(t.core.crypto.hash('data'));`,
            `drift(t.core.crypto.encrypt('data', 'key'));`,
            `drift(t.core.crypto.decrypt('data', 'key'));`,
            `drift(t.core.crypto.hashKeyed('data', 'key'));`,
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
    // VALID: Titan namespace (declare namespace Titan)
    // =========================================================================
    describe('valid: async Titan.* methods with drift', () => {
        const codes = [
            `drift(Titan.fetch('/api'));`,
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
    // VALID: Third-party packages from node_modules
    // =========================================================================
    describe('valid: third-party async methods with drift (node_modules)', () => {
        const codes = [
            // titan-websocket (index.d.ts fallback)
            `drift(t.ws.connect('wss://example.com'));`,
            `drift(t.ws.send('hello'));`,
            `drift(t.ws.close());`,
            // titan-database ("types" field in package.json)
            `drift(t.db.query('SELECT 1'));`,
            `drift(t.db.execute('INSERT ...'));`,
            `drift(t.db.transaction(() => {}));`,
            // titan-auth (index.d.ts fallback)
            `drift(t.auth.login('user', 'pass'));`,
            `drift(t.auth.verify('token'));`,
            // scoped package @scope/titan-cache
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
    // VALID: Destructured ASYNC aliases with drift
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
    // VALID: Declare global ASYNC aliases with drift
    // =========================================================================
    describe('valid: declare global async aliases with drift', () => {
        const codes = [
            // declare global { const globalFetch: typeof t.fetch }
            `drift(globalFetch('/api'));`,
            // declare global { const globalReadFile: typeof t.core.fs.readFile }
            `drift(globalReadFile('/file'));`,
            // declare global { const globalDbQuery: typeof t.db.query }
            `drift(globalDbQuery('SELECT 1'));`,
            // declare global { const globalWsConnect: typeof t.ws.connect }
            `drift(globalWsConnect('wss://example.com'));`,
            // declare global { const globalSleep: typeof t.core.time.sleep }
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
    // VALID: Exported ASYNC aliases with drift
    // =========================================================================
    describe('valid: exported async aliases with drift', () => {
        const codes = [
            // export const exportedFetch = t.fetch;
            `drift(exportedFetch('/api'));`,
            // export const exportedReadFile = t.core.fs.readFile;
            `drift(exportedReadFile('/file'));`,
            // export const exportedDbQuery = t.db.query;
            `drift(exportedDbQuery('SELECT 1'));`,
            // export const exportedSleep = t.core.time.sleep;
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
    // VALID: Simple assignment ASYNC aliases with drift
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
    // VALID: Module assignment aliases with drift
    // e.g., const db = t.db; drift(db.query(...))
    // =========================================================================
    describe('valid: module assignment async aliases with drift', () => {
        const codes = [
            // const db = t.db; drift(db.query('SELECT 1'));
            `drift(db.query('SELECT 1'));`,
            // const fs = t.core.fs; drift(fs.readFile('/file'));
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
    // VALID: Object property aliases with drift
    // e.g., const utils = { fetch: t.fetch }; drift(utils.fetch(...))
    // =========================================================================
    describe('valid: object property async aliases with drift', () => {
        const codes = [
            // const titanUtils = { fetch: t.fetch };
            `drift(titanUtils.fetch('/api'));`,
            // const titanUtils = { read: t.core.fs.readFile };
            `drift(titanUtils.read('/file'));`,
            // export const dbHelpers = { query: t.db.query };
            `drift(dbHelpers.query('SELECT 1'));`,
            // export const dbHelpers = { exec: t.db.execute };
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
    // INVALID: drift with SYNC Titan methods (direct t.*)
    // =========================================================================
    describe('invalid: drift with sync t.* methods', () => {
        const codes = [
            `drift(t.core.path.join('a', 'b'));`,
            `drift(t.core.path.resolve('/dir', 'file'));`,
            `drift(t.core.path.dirname('/path'));`,
            `drift(t.core.path.basename('/path'));`,
            `drift(t.core.path.extname('file.txt'));`,
            `drift(t.core.url.parse('http://example.com'));`,
            `drift(t.core.url.format({}));`,
            `drift(t.core.crypto.uuid());`,
            `drift(t.core.crypto.randomBytes(32));`,
            `drift(t.core.crypto.compare('a', 'b'));`,
            `drift(t.core.os.platform());`,
            `drift(t.core.os.cpus());`,
            `drift(t.core.os.totalMemory());`,
            `drift(t.core.os.freeMemory());`,
            `drift(t.core.os.tmpdir());`,
            `drift(t.core.buffer.toBase64('hi'));`,
            `drift(t.core.buffer.fromBase64('aGk='));`,
            `drift(t.core.time.now());`,
            `drift(t.core.time.timestamp());`,
            `drift(t.core.proc.pid());`,
            `drift(t.core.proc.uptime());`,
            `drift(t.core.net.ip());`,
            `drift(t.core.ls.get('k'));`,
            `drift(t.core.ls.set('k', 'v'));`,
            `drift(t.core.cookies.get('token'));`,
            `drift(t.log('msg'));`,
        ];
        for (const code of codes) {
            it(`should fail (driftNotForSyncMethods): ${code}`, () => {
                const errs = ruleErrors(lint(code));
                assert.strictEqual(errs.length, 1, `Expected 1 error for: ${code}`);
                assert.strictEqual(errs[0].messageId, 'driftNotForSyncMethods');
            });
        }
    });

    // =========================================================================
    // INVALID: drift with sync Titan.* methods
    // =========================================================================
    describe('invalid: drift with sync Titan.* methods', () => {
        const codes = [
            `drift(Titan.core.path.join('a', 'b'));`,
        ];
        for (const code of codes) {
            it(`should fail (driftNotForSyncMethods): ${code}`, () => {
                const errs = ruleErrors(lint(code));
                assert.strictEqual(errs.length, 1, `Expected 1 error for: ${code}`);
                assert.strictEqual(errs[0].messageId, 'driftNotForSyncMethods');
            });
        }
    });

    // =========================================================================
    // INVALID: drift with sync third-party methods (node_modules)
    // =========================================================================
    describe('invalid: drift with sync third-party methods', () => {
        const codes = [
            `drift(t.ws.isConnected());`,
            `drift(t.db.isConnected());`,
            `drift(t.auth.currentUser());`,
            `drift(t.cache.has('key'));`,
        ];
        for (const code of codes) {
            it(`should fail (driftNotForSyncMethods): ${code}`, () => {
                const errs = ruleErrors(lint(code));
                assert.strictEqual(errs.length, 1, `Expected 1 error for: ${code}`);
                assert.strictEqual(errs[0].messageId, 'driftNotForSyncMethods');
            });
        }
    });

    // =========================================================================
    // INVALID: drift with SYNC destructured aliases
    // =========================================================================
    describe('invalid: drift with sync destructured aliases', () => {
        const codes = [
            // const { join: pathJoin } = t.core.path;
            `drift(pathJoin('a', 'b'));`,
            // const { log } = t;
            `drift(log('message'));`,
            // const { uuid } = t.core.crypto;
            `drift(uuid());`,
            // const { now } = t.core.time;
            `drift(now());`,
        ];
        for (const code of codes) {
            it(`should fail (driftNotForSyncMethodsAlias): ${code}`, () => {
                const errs = ruleErrors(lint(code));
                assert.strictEqual(errs.length, 1, `Expected 1 error for: ${code}`);
                assert.strictEqual(errs[0].messageId, 'driftNotForSyncMethodsAlias');
            });
        }
    });

    // =========================================================================
    // INVALID: drift with SYNC declare global aliases
    // =========================================================================
    describe('invalid: drift with sync declare global aliases', () => {
        const codes = [
            // declare global { const globalPathJoin: typeof t.core.path.join }
            `drift(globalPathJoin('a', 'b'));`,
            // declare global { const globalLog: typeof t.log }
            `drift(globalLog('message'));`,
            // declare global { const globalNow: typeof t.core.time.now }
            `drift(globalNow());`,
        ];
        for (const code of codes) {
            it(`should fail (driftNotForSyncMethodsAlias): ${code}`, () => {
                const errs = ruleErrors(lint(code));
                assert.strictEqual(errs.length, 1, `Expected 1 error for: ${code}`);
                assert.strictEqual(errs[0].messageId, 'driftNotForSyncMethodsAlias');
            });
        }
    });

    // =========================================================================
    // INVALID: drift with SYNC exported aliases
    // =========================================================================
    describe('invalid: drift with sync exported aliases', () => {
        const codes = [
            // export const exportedPathJoin = t.core.path.join;
            `drift(exportedPathJoin('a', 'b'));`,
            // export const exportedLog = t.log;
            `drift(exportedLog('message'));`,
        ];
        for (const code of codes) {
            it(`should fail (driftNotForSyncMethodsAlias): ${code}`, () => {
                const errs = ruleErrors(lint(code));
                assert.strictEqual(errs.length, 1, `Expected 1 error for: ${code}`);
                assert.strictEqual(errs[0].messageId, 'driftNotForSyncMethodsAlias');
            });
        }
    });

    // =========================================================================
    // INVALID: drift with SYNC module alias sub-methods
    // =========================================================================
    describe('invalid: drift with sync module alias sub-methods', () => {
        const codes = [
            // const myPath = t.core.path; drift(myPath.join(...))
            `drift(myPath.join('a', 'b'));`,
            // const db = t.db; drift(db.isConnected())
            `drift(db.isConnected());`,
        ];
        for (const code of codes) {
            it(`should fail (sync via module alias): ${code}`, () => {
                const errs = ruleErrors(lint(code));
                assert.strictEqual(errs.length, 1, `Expected 1 error for: ${code}`);
                assert.ok(
                    errs[0].messageId === 'driftNotForSyncMethodsAlias' ||
                    errs[0].messageId === 'driftNotForSyncMethods',
                    `Expected sync method error for: ${code}, got: ${errs[0].messageId}`
                );
            });
        }
    });

    // =========================================================================
    // INVALID: drift with SYNC object property aliases
    // =========================================================================
    describe('invalid: drift with sync object property aliases', () => {
        const codes = [
            // const titanUtils = { join: t.core.path.join }
            `drift(titanUtils.join('a', 'b'));`,
        ];
        for (const code of codes) {
            it(`should fail (sync via object alias): ${code}`, () => {
                const errs = ruleErrors(lint(code));
                assert.strictEqual(errs.length, 1, `Expected 1 error for: ${code}`);
                assert.ok(
                    errs[0].messageId === 'driftNotForSyncMethodsAlias' ||
                    errs[0].messageId === 'driftNotForSyncMethods',
                    `Expected sync method error for: ${code}, got: ${errs[0].messageId}`
                );
            });
        }
    });

    // =========================================================================
    // INVALID: drift without argument
    // =========================================================================
    describe('invalid: drift without argument', () => {
        it('should fail: drift();', () => {
            const errs = ruleErrors(lint('drift();'));
            assert.strictEqual(errs.length, 1);
            assert.strictEqual(errs[0].messageId, 'driftRequiresArgument');
        });
    });

    // =========================================================================
    // INVALID: drift with direct method reference (not called)
    // =========================================================================
    describe('invalid: drift with method reference (not a call)', () => {
        const codes = [
            'drift(t.fetch);',
            'drift(t.core.fs.readFile);',
            'drift(Titan.fetch);',
        ];
        for (const code of codes) {
            it(`should fail (driftRequiresCall): ${code}`, () => {
                const errs = ruleErrors(lint(code));
                assert.strictEqual(errs.length, 1, `Expected 1 error for: ${code}`);
                assert.strictEqual(errs[0].messageId, 'driftRequiresCall');
            });
        }
    });

    // =========================================================================
    // INVALID: drift with ALIAS reference (not called)
    // e.g., drift(fetch) instead of drift(fetch('/api'))
    // =========================================================================
    describe('invalid: drift with alias reference (not a call)', () => {
        const codes = [
            // const { fetch } = t;  drift(fetch) ← missing ()
            'drift(fetch);',
            // const { readFile } = t.core.fs;  drift(readFile) ← missing ()
            'drift(readFile);',
            // const { sleep } = t.core.time;  drift(sleep)
            'drift(sleep);',
            // declare global { const globalFetch: typeof t.fetch }  drift(globalFetch)
            'drift(globalFetch);',
            // export const exportedFetch = t.fetch;  drift(exportedFetch)
            'drift(exportedFetch);',
            // const myFetch = t.fetch;  drift(myFetch)
            'drift(myFetch);',
        ];
        for (const code of codes) {
            it(`should fail (driftRequiresCall): ${code}`, () => {
                const errs = ruleErrors(lint(code));
                assert.strictEqual(errs.length, 1, `Expected 1 error for: ${code}`);
                assert.strictEqual(errs[0].messageId, 'driftRequiresCall');
            });
        }
    });

    // =========================================================================
    // INVALID: drift with module alias MemberExpression reference (not called)
    // e.g., drift(db.query) instead of drift(db.query('...'))
    // =========================================================================
    describe('invalid: drift with module alias reference (not a call)', () => {
        const codes = [
            // const db = t.db;  drift(db.query) ← missing ()
            'drift(db.query);',
        ];
        for (const code of codes) {
            it(`should fail (driftRequiresCall): ${code}`, () => {
                const errs = ruleErrors(lint(code));
                assert.strictEqual(errs.length, 1, `Expected 1 error for: ${code}`);
                assert.strictEqual(errs[0].messageId, 'driftRequiresCall');
            });
        }
    });

    // =========================================================================
    // INVALID: drift with non-Titan function call
    // =========================================================================
    describe('invalid: drift with non-Titan function', () => {
        const codes = [
            'drift(myFunction());',
            'drift(console.log("test"));',
            'drift(someModule.method());',
            'drift(Math.random());',
        ];
        for (const code of codes) {
            it(`should fail (driftOnlyForTitanAsync): ${code}`, () => {
                const errs = ruleErrors(lint(code));
                assert.strictEqual(errs.length, 1, `Expected 1 error for: ${code}`);
                assert.strictEqual(errs[0].messageId, 'driftOnlyForTitanAsync');
            });
        }
    });

    // =========================================================================
    // INVALID: drift with unknown variable (not an alias)
    // =========================================================================
    describe('invalid: drift with unknown variable reference', () => {
        const codes = [
            'drift(someVariable);',
            'drift(unknownRef);',
            'drift(promise);',
        ];
        for (const code of codes) {
            it(`should fail (driftOnlyForTitanAsync): ${code}`, () => {
                const errs = ruleErrors(lint(code));
                assert.strictEqual(errs.length, 1, `Expected 1 error for: ${code}`);
                assert.strictEqual(errs[0].messageId, 'driftOnlyForTitanAsync');
            });
        }
    });

    // =========================================================================
    // INVALID: drift with function expressions
    // =========================================================================
    describe('invalid: drift with function expressions', () => {
        const codes = [
            'drift(() => {});',
            'drift(function() {});',
        ];
        for (const code of codes) {
            it(`should fail (driftOnlyForTitanAsync): ${code}`, () => {
                const errs = ruleErrors(lint(code));
                assert.strictEqual(errs.length, 1, `Expected 1 error for: ${code}`);
                assert.strictEqual(errs[0].messageId, 'driftOnlyForTitanAsync');
            });
        }
    });

    // =========================================================================
    // INVALID: drift with literals
    // =========================================================================
    describe('invalid: drift with literals', () => {
        const codes = [
            `drift('string');`,
            `drift(123);`,
            `drift(true);`,
            `drift(null);`,
        ];
        for (const code of codes) {
            it(`should fail (driftOnlyForTitanAsync): ${code}`, () => {
                const errs = ruleErrors(lint(code));
                assert.strictEqual(errs.length, 1, `Expected 1 error for: ${code}`);
                assert.strictEqual(errs[0].messageId, 'driftOnlyForTitanAsync');
            });
        }
    });

    // =========================================================================
    // INVALID: drift with objects/arrays
    // =========================================================================
    describe('invalid: drift with objects/arrays', () => {
        const codes = [
            `drift({});`,
            `drift([]);`,
        ];
        for (const code of codes) {
            it(`should fail (driftOnlyForTitanAsync): ${code}`, () => {
                const errs = ruleErrors(lint(code));
                assert.strictEqual(errs.length, 1, `Expected 1 error for: ${code}`);
                assert.strictEqual(errs[0].messageId, 'driftOnlyForTitanAsync');
            });
        }
    });

    // =========================================================================
    // FALLBACK: unknown Titan methods treated as sync (permissive)
    // =========================================================================
    describe('fallback: unknown Titan methods', () => {
        it('should fail drift with t.unknown.newMethod() — treated as sync', () => {
            const errs = ruleErrors(lint(`drift(t.unknown.newMethod());`));
            assert.strictEqual(errs.length, 1);
            assert.strictEqual(errs[0].messageId, 'driftNotForSyncMethods');
        });

        it('should fail drift with Titan.something.else() — treated as sync', () => {
            const errs = ruleErrors(lint(`drift(Titan.something.else());`));
            assert.strictEqual(errs.length, 1);
            assert.strictEqual(errs[0].messageId, 'driftNotForSyncMethods');
        });
    });

    // =========================================================================
    // EDGE CASES
    // =========================================================================
    describe('edge cases', () => {
        it('should reject drift with non-Titan unknown function call', () => {
            const errs = ruleErrors(lint(`drift(unknownAlias());`));
            assert.strictEqual(errs.length, 1);
            assert.strictEqual(errs[0].messageId, 'driftOnlyForTitanAsync');
        });

        it('should reject drift with non-Titan unknown module call', () => {
            const errs = ruleErrors(lint(`drift(someLib.doStuff());`));
            assert.strictEqual(errs.length, 1);
            assert.strictEqual(errs[0].messageId, 'driftOnlyForTitanAsync');
        });
    });
    // =========================================================================
    // VALID: Inline destructuring in the same code being linted
    // =========================================================================
    describe('valid: inline destructuring aliases', () => {
        it('should resolve inline const { fetch } = t', () => {
            const code = `
            const { fetch } = t;
            drift(fetch('/api'));
        `;
            const errs = ruleErrors(lint(code));
            assert.strictEqual(errs.length, 0, 'inline destructured alias should be resolved');
        });

        it('should resolve inline const { readFile } = t.core.fs', () => {
            const code = `
            const { readFile } = t.core.fs;
            drift(readFile('/file'));
        `;
            const errs = ruleErrors(lint(code));
            assert.strictEqual(errs.length, 0, 'inline destructured alias with path should be resolved');
        });

        it('should resolve inline const myFetch = t.fetch', () => {
            const code = `
            const myFetch = t.fetch;
            drift(myFetch('/api'));
        `;
            const errs = ruleErrors(lint(code));
            assert.strictEqual(errs.length, 0, 'inline simple assignment alias should be resolved');
        });

        it('should resolve inline const db = t.db; drift(db.query(...))', () => {
            const code = `
            const db = t.db;
            drift(db.query('SELECT 1'));
        `;
            const errs = ruleErrors(lint(code));
            assert.strictEqual(errs.length, 0, 'inline module alias should be resolved');
        });
    });
});