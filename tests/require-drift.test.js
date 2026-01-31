/**
 * Tests for require-drift rule
 * Uses direct mocking of the async detector (DTS File Checker)
 * 
 * Includes tests for:
 * - Direct Titan method calls
 * - Destructured aliases: const { fetch } = t
 * - Declare global aliases: declare global { const myFetch: typeof t.fetch }
 * - Export aliases: export const fetch = t.fetch
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

// =============================================================================
// MOCK DATA - Simulates what DTS File Checker would find
// =============================================================================

/**
 * Async methods found in .d.ts files
 */
const ASYNC_METHODS = new Set([
    't.fetch',
    'Titan.fetch',
    't.core.fs.readFile',
    't.core.fs.writeFile',
    't.core.fs.remove',
    't.core.fs.mkdir',
    't.core.fs.readdir',
    't.core.fs.stat',
    't.core.fs.exists',
    'Titan.core.fs.readFile',
    't.core.crypto.hash',
    't.core.crypto.encrypt',
    't.core.crypto.decrypt',
    't.core.net.resolveDNS',
    't.core.time.sleep',
    't.core.session.get',
    't.core.session.set',
    't.core.session.delete',
    't.core.session.clear',
    'Titan.core.crypto.hash',
    't.ws.connect',
    't.db.query',
]);

/**
 * Sync methods found in .d.ts files
 */
const SYNC_METHODS = new Set([
    't.core.path.join',
    't.core.path.resolve',
    't.core.path.dirname',
    't.core.url.parse',
    't.core.crypto.uuid',
    't.core.time.now',
    't.core.time.timestamp',
    't.core.net.ip',
    't.core.ls.get',
    't.core.ls.set',
    't.log',
]);

/**
 * Aliases detected from:
 * - Destructuring: const { fetch } = t
 * - Declare global: declare global { const myFetch: typeof t.fetch }
 * - Exports: export const fetch = t.fetch
 * 
 * Map<aliasName, { originalPath, source }>
 */
const ALIASES = new Map([
    // Destructuring aliases - ASYNC
    ['fetch', { originalPath: 't.fetch', source: 'destructuring' }],
    ['readFile', { originalPath: 't.core.fs.readFile', source: 'destructuring' }],
    ['writeFile', { originalPath: 't.core.fs.writeFile', source: 'destructuring' }],
    ['sleep', { originalPath: 't.core.time.sleep', source: 'destructuring' }],
    ['wsConnect', { originalPath: 't.ws.connect', source: 'destructuring' }],
    ['dbQuery', { originalPath: 't.db.query', source: 'destructuring' }],
    
    // Destructuring aliases - SYNC
    ['pathJoin', { originalPath: 't.core.path.join', source: 'destructuring' }],
    ['log', { originalPath: 't.log', source: 'destructuring' }],
    ['now', { originalPath: 't.core.time.now', source: 'destructuring' }],
    
    // Declare global aliases - ASYNC
    ['globalFetch', { originalPath: 't.fetch', source: 'declare-global' }],
    ['globalReadFile', { originalPath: 't.core.fs.readFile', source: 'declare-global' }],
    ['globalDbQuery', { originalPath: 't.db.query', source: 'declare-global' }],
    
    // Declare global aliases - SYNC
    ['globalPathJoin', { originalPath: 't.core.path.join', source: 'declare-global' }],
    ['globalLog', { originalPath: 't.log', source: 'declare-global' }],
    
    // Export aliases - ASYNC
    ['exportedFetch', { originalPath: 't.fetch', source: 'export' }],
    ['exportedReadFile', { originalPath: 't.core.fs.readFile', source: 'export' }],
    ['exportedDbQuery', { originalPath: 't.db.query', source: 'export' }],
    
    // Export aliases - SYNC
    ['exportedPathJoin', { originalPath: 't.core.path.join', source: 'export' }],
    ['exportedLog', { originalPath: 't.log', source: 'export' }],
]);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Build member path from AST node
 */
function buildMemberPath(node) {
    if (!node) return null;
    if (node.type === 'Identifier') return node.name;
    if (node.type === 'MemberExpression') {
        const obj = buildMemberPath(node.object);
        const prop = node.property?.name;
        return obj && prop ? `${obj}.${prop}` : null;
    }
    return null;
}

/**
 * Check if path is Titan callee
 */
function isTitanCallee(path) {
    return path && (path.startsWith('t.') || path.startsWith('Titan.'));
}

/**
 * Resolve alias to original Titan path
 * @param {string} name - Method name or path
 * @returns {{ resolvedPath: string, wasAlias: boolean, aliasSource: string | null }}
 */
function resolveAlias(name) {
    // Direct Titan path
    if (isTitanCallee(name)) {
        return { resolvedPath: name, wasAlias: false, aliasSource: null };
    }
    
    // Check for alias
    const alias = ALIASES.get(name);
    if (alias) {
        return { 
            resolvedPath: alias.originalPath, 
            wasAlias: true, 
            aliasSource: alias.source 
        };
    }
    
    return { resolvedPath: name, wasAlias: false, aliasSource: null };
}

/**
 * Mock detectAsyncMethod for testing
 * Simulates the DTS File Checker behavior with alias resolution
 */
function mockDetectAsyncMethod(methodPath) {
    // First resolve any alias
    const { resolvedPath } = resolveAlias(methodPath);
    
    if (!isTitanCallee(resolvedPath)) {
        return { isAsync: false, source: null, returnType: null };
    }
    if (ASYNC_METHODS.has(resolvedPath)) {
        return { isAsync: true, source: 'dts-file', returnType: 'Promise<any>' };
    }
    if (SYNC_METHODS.has(resolvedPath)) {
        return { isAsync: false, source: 'dts-file', returnType: 'string' };
    }
    // Unknown Titan method - fallback permissive (not found in any .d.ts)
    return { isAsync: false, source: 'fallback', returnType: null };
}

/**
 * Check if a callee is or resolves to a Titan method
 */
function checkTitanCallee(calleePath) {
    if (isTitanCallee(calleePath)) {
        return { isTitan: true, resolvedPath: calleePath };
    }
    
    const { resolvedPath, wasAlias } = resolveAlias(calleePath);
    if (wasAlias && isTitanCallee(resolvedPath)) {
        return { isTitan: true, resolvedPath };
    }
    
    return { isTitan: false, resolvedPath: null };
}

// =============================================================================
// RULE IMPLEMENTATION (for testing)
// =============================================================================

/**
 * Create rule implementation for testing
 */
function createRule() {
    return {
        create(context) {
            return {
                CallExpression(node) {
                    // Skip if this is a drift() call itself
                    if (node.callee.type === 'Identifier' && node.callee.name === 'drift') {
                        return;
                    }

                    // Get method path - could be Identifier (alias) or MemberExpression
                    let methodPath;
                    if (node.callee.type === 'Identifier') {
                        methodPath = node.callee.name;
                    } else {
                        methodPath = buildMemberPath(node.callee);
                    }

                    if (!methodPath) {
                        return;
                    }

                    // Check if it's a Titan callee (direct or via alias)
                    const { isTitan, resolvedPath } = checkTitanCallee(methodPath);

                    // Skip if not a Titan callee
                    if (!isTitan) {
                        return;
                    }

                    // Check if already inside drift()
                    if (node._isInsideDrift) {
                        return;
                    }

                    // Check if it's an async method
                    const detection = mockDetectAsyncMethod(methodPath);

                    if (detection.isAsync) {
                        context.report({
                            node,
                            messageId: 'requireDrift',
                            data: { method: methodPath }
                        });
                    }
                }
            };
        }
    };
}

// =============================================================================
// PARSER
// =============================================================================

/**
 * Parse code to AST node
 */
function parseCode(code) {
    // drift(t.method()) or drift(alias()) - the inner call is inside drift
    const driftTitanMatch = code.match(/^drift\(([tT](?:itan)?(?:\.[a-zA-Z_]+)+)\(.*?\)\);$/);
    if (driftTitanMatch) {
        const parts = driftTitanMatch[1].split('.');
        let node = { type: 'Identifier', name: parts[0] };
        for (let i = 1; i < parts.length; i++) {
            node = {
                type: 'MemberExpression',
                object: node,
                property: { type: 'Identifier', name: parts[i] }
            };
        }
        return {
            type: 'CallExpression',
            callee: node,
            arguments: [],
            _isInsideDrift: true
        };
    }

    // drift(alias()) - alias inside drift
    const driftAliasMatch = code.match(/^drift\(([a-zA-Z_][a-zA-Z0-9_]*)\(.*?\)\);$/);
    if (driftAliasMatch && ALIASES.has(driftAliasMatch[1])) {
        return {
            type: 'CallExpression',
            callee: { type: 'Identifier', name: driftAliasMatch[1] },
            arguments: [],
            _isInsideDrift: true
        };
    }

    // alias() - NOT wrapped in drift
    const aliasMatch = code.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\(.*?\);$/);
    if (aliasMatch && ALIASES.has(aliasMatch[1])) {
        return {
            type: 'CallExpression',
            callee: { type: 'Identifier', name: aliasMatch[1] },
            arguments: [],
            _isInsideDrift: false
        };
    }

    // t.method() or Titan.method() - NOT wrapped in drift
    const titanMatch = code.match(/^([tT](?:itan)?(?:\.[a-zA-Z_]+)+)\(.*?\);$/);
    if (titanMatch) {
        const parts = titanMatch[1].split('.');
        let node = { type: 'Identifier', name: parts[0] };
        for (let i = 1; i < parts.length; i++) {
            node = {
                type: 'MemberExpression',
                object: node,
                property: { type: 'Identifier', name: parts[i] }
            };
        }
        return {
            type: 'CallExpression',
            callee: node,
            arguments: [],
            _isInsideDrift: false
        };
    }

    // Regular function call
    const funcMatch = code.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\(.*?\);$/);
    if (funcMatch) {
        return {
            type: 'CallExpression',
            callee: { type: 'Identifier', name: funcMatch[1] },
            arguments: [],
            _isInsideDrift: false
        };
    }

    // Module.method() call
    const moduleMatch = code.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)\(.*?\);$/);
    if (moduleMatch) {
        return {
            type: 'CallExpression',
            callee: {
                type: 'MemberExpression',
                object: { type: 'Identifier', name: moduleMatch[1] },
                property: { type: 'Identifier', name: moduleMatch[2] }
            },
            arguments: [],
            _isInsideDrift: false
        };
    }

    return null;
}

function runRule(code) {
    const reports = [];
    const context = { report: (d) => reports.push(d) };
    const node = parseCode(code);
    if (!node) throw new Error(`Could not parse: ${code}`);
    const rule = createRule();
    rule.create(context).CallExpression(node);
    return reports;
}

// =============================================================================
// TESTS
// =============================================================================

describe('require-drift', () => {
    
    // =========================================================================
    // VALID: Direct async methods WITH drift
    // =========================================================================
    describe('valid: async methods with drift', () => {
        const codes = [
            `drift(t.fetch('/api/data'));`,
            `drift(Titan.fetch('/api/data'));`,
            `drift(t.core.fs.readFile('/path/to/file'));`,
            `drift(t.core.fs.writeFile('/path', 'content'));`,
            `drift(t.core.crypto.hash('data'));`,
            `drift(t.core.time.sleep(1000));`,
            `drift(t.core.net.resolveDNS('example.com'));`,
            `drift(t.ws.connect('wss://example.com'));`,
            `drift(t.db.query('SELECT 1'));`,
        ];
        for (const code of codes) {
            it(`should pass: ${code}`, () => {
                const reports = runRule(code);
                assert.strictEqual(reports.length, 0, `Expected no errors for: ${code}`);
            });
        }
    });

    // =========================================================================
    // VALID: Destructured async aliases WITH drift
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
                const reports = runRule(code);
                assert.strictEqual(reports.length, 0, `Expected no errors for: ${code}`);
            });
        }
    });

    // =========================================================================
    // VALID: Declare global async aliases WITH drift
    // =========================================================================
    describe('valid: declare global async aliases with drift', () => {
        const codes = [
            // declare global { const globalFetch: typeof t.fetch }
            `drift(globalFetch('/api'));`,
            // declare global { const globalReadFile: typeof t.core.fs.readFile }
            `drift(globalReadFile('/file'));`,
            // declare global { const globalDbQuery: typeof t.db.query }
            `drift(globalDbQuery('SELECT 1'));`,
        ];
        for (const code of codes) {
            it(`should pass: ${code}`, () => {
                const reports = runRule(code);
                assert.strictEqual(reports.length, 0, `Expected no errors for: ${code}`);
            });
        }
    });

    // =========================================================================
    // VALID: Exported async aliases WITH drift
    // =========================================================================
    describe('valid: exported async aliases with drift', () => {
        const codes = [
            // export const exportedFetch = t.fetch;
            `drift(exportedFetch('/api'));`,
            // export const exportedReadFile = t.core.fs.readFile;
            `drift(exportedReadFile('/file'));`,
            // export const exportedDbQuery = t.db.query;
            `drift(exportedDbQuery('SELECT 1'));`,
        ];
        for (const code of codes) {
            it(`should pass: ${code}`, () => {
                const reports = runRule(code);
                assert.strictEqual(reports.length, 0, `Expected no errors for: ${code}`);
            });
        }
    });

    // =========================================================================
    // VALID: Sync methods WITHOUT drift
    // =========================================================================
    describe('valid: sync methods without drift', () => {
        const codes = [
            `t.core.path.join('a', 'b');`,
            `t.core.url.parse('http://example.com');`,
            `t.core.crypto.uuid();`,
            `t.core.time.now();`,
            `t.log('message');`,
        ];
        for (const code of codes) {
            it(`should pass: ${code}`, () => {
                const reports = runRule(code);
                assert.strictEqual(reports.length, 0, `Expected no errors for: ${code}`);
            });
        }
    });

    // =========================================================================
    // VALID: Sync destructured aliases WITHOUT drift
    // =========================================================================
    describe('valid: sync destructured aliases without drift', () => {
        const codes = [
            // const { join: pathJoin } = t.core.path;
            `pathJoin('a', 'b');`,
            // const { log } = t;
            `log('message');`,
            // const { now } = t.core.time;
            `now();`,
        ];
        for (const code of codes) {
            it(`should pass: ${code}`, () => {
                const reports = runRule(code);
                assert.strictEqual(reports.length, 0, `Expected no errors for: ${code}`);
            });
        }
    });

    // =========================================================================
    // VALID: Sync declare global aliases WITHOUT drift
    // =========================================================================
    describe('valid: sync declare global aliases without drift', () => {
        const codes = [
            // declare global { const globalPathJoin: typeof t.core.path.join }
            `globalPathJoin('a', 'b');`,
            // declare global { const globalLog: typeof t.log }
            `globalLog('message');`,
        ];
        for (const code of codes) {
            it(`should pass: ${code}`, () => {
                const reports = runRule(code);
                assert.strictEqual(reports.length, 0, `Expected no errors for: ${code}`);
            });
        }
    });

    // =========================================================================
    // VALID: Sync exported aliases WITHOUT drift
    // =========================================================================
    describe('valid: sync exported aliases without drift', () => {
        const codes = [
            // export const exportedPathJoin = t.core.path.join;
            `exportedPathJoin('a', 'b');`,
            // export const exportedLog = t.log;
            `exportedLog('message');`,
        ];
        for (const code of codes) {
            it(`should pass: ${code}`, () => {
                const reports = runRule(code);
                assert.strictEqual(reports.length, 0, `Expected no errors for: ${code}`);
            });
        }
    });

    // =========================================================================
    // VALID: Non-Titan calls
    // =========================================================================
    describe('valid: non-Titan calls', () => {
        const codes = [
            `myFunction();`,
            `someModule.method();`,
            `console.log('hello');`,
            `Math.random();`,
            `JSON.stringify({});`,
        ];
        for (const code of codes) {
            it(`should pass: ${code}`, () => {
                const reports = runRule(code);
                assert.strictEqual(reports.length, 0, `Expected no errors for: ${code}`);
            });
        }
    });

    // =========================================================================
    // INVALID: Direct async methods WITHOUT drift
    // =========================================================================
    describe('invalid: async methods without drift', () => {
        const codes = [
            `t.fetch('/api/data');`,
            `Titan.fetch('/api/data');`,
            `t.core.fs.readFile('/path/to/file');`,
            `t.core.fs.writeFile('/path', 'content');`,
            `t.core.fs.remove('/path');`,
            `t.core.fs.mkdir('/dir');`,
            `t.core.fs.readdir('/dir');`,
            `t.core.fs.stat('/file');`,
            `t.core.fs.exists('/file');`,
            `t.core.crypto.hash('data');`,
            `t.core.crypto.encrypt('data', 'key');`,
            `t.core.crypto.decrypt('data', 'key');`,
            `t.core.net.resolveDNS('example.com');`,
            `t.core.time.sleep(1000);`,
            `t.core.session.get('key');`,
            `t.core.session.set('key', 'value');`,
            `Titan.core.fs.readFile('/file');`,
            `Titan.core.crypto.hash('data');`,
            `t.ws.connect('wss://example.com');`,
            `t.db.query('SELECT 1');`,
        ];
        for (const code of codes) {
            it(`should fail: ${code}`, () => {
                const reports = runRule(code);
                assert.strictEqual(reports.length, 1, `Expected error for: ${code}`);
                assert.strictEqual(reports[0].messageId, 'requireDrift');
            });
        }
    });

    // =========================================================================
    // INVALID: Destructured async aliases WITHOUT drift
    // =========================================================================
    describe('invalid: destructured async aliases without drift', () => {
        const codes = [
            // const { fetch } = t;
            `fetch('/api');`,
            // const { readFile } = t.core.fs;
            `readFile('/file');`,
            // const { writeFile } = t.core.fs;
            `writeFile('/file', 'data');`,
            // const { sleep } = t.core.time;
            `sleep(1000);`,
            // const { connect: wsConnect } = t.ws;
            `wsConnect('wss://example.com');`,
            // const { query: dbQuery } = t.db;
            `dbQuery('SELECT 1');`,
        ];
        for (const code of codes) {
            it(`should fail: ${code}`, () => {
                const reports = runRule(code);
                assert.strictEqual(reports.length, 1, `Expected error for: ${code}`);
                assert.strictEqual(reports[0].messageId, 'requireDrift');
            });
        }
    });

    // =========================================================================
    // INVALID: Declare global async aliases WITHOUT drift
    // =========================================================================
    describe('invalid: declare global async aliases without drift', () => {
        const codes = [
            // declare global { const globalFetch: typeof t.fetch }
            `globalFetch('/api');`,
            // declare global { const globalReadFile: typeof t.core.fs.readFile }
            `globalReadFile('/file');`,
            // declare global { const globalDbQuery: typeof t.db.query }
            `globalDbQuery('SELECT 1');`,
        ];
        for (const code of codes) {
            it(`should fail: ${code}`, () => {
                const reports = runRule(code);
                assert.strictEqual(reports.length, 1, `Expected error for: ${code}`);
                assert.strictEqual(reports[0].messageId, 'requireDrift');
            });
        }
    });

    // =========================================================================
    // INVALID: Exported async aliases WITHOUT drift
    // =========================================================================
    describe('invalid: exported async aliases without drift', () => {
        const codes = [
            // export const exportedFetch = t.fetch;
            `exportedFetch('/api');`,
            // export const exportedReadFile = t.core.fs.readFile;
            `exportedReadFile('/file');`,
            // export const exportedDbQuery = t.db.query;
            `exportedDbQuery('SELECT 1');`,
        ];
        for (const code of codes) {
            it(`should fail: ${code}`, () => {
                const reports = runRule(code);
                assert.strictEqual(reports.length, 1, `Expected error for: ${code}`);
                assert.strictEqual(reports[0].messageId, 'requireDrift');
            });
        }
    });

    // =========================================================================
    // FALLBACK BEHAVIOR
    // =========================================================================
    describe('fallback behavior', () => {
        it('should not require drift for unknown Titan method (fallback permissive)', () => {
            // Unknown methods are treated as sync (permissive fallback)
            // So they don't require drift
            const reports = runRule(`t.unknown.newMethod();`);
            assert.strictEqual(reports.length, 0);
        });

        it('should not require drift for unknown alias (not in ALIASES map)', () => {
            // unknownAlias is not in ALIASES, so it's treated as non-Titan
            const reports = runRule(`unknownAlias();`);
            assert.strictEqual(reports.length, 0);
        });
    });

    // =========================================================================
    // EDGE CASES
    // =========================================================================
    describe('edge cases', () => {
        it('should handle mixed usage in same file context', () => {
            // This simulates: user has both direct and aliased calls
            // Direct sync - OK
            let reports = runRule(`t.core.path.join('a', 'b');`);
            assert.strictEqual(reports.length, 0);

            // Aliased sync - OK
            reports = runRule(`pathJoin('a', 'b');`);
            assert.strictEqual(reports.length, 0);

            // Direct async without drift - FAIL
            reports = runRule(`t.fetch('/api');`);
            assert.strictEqual(reports.length, 1);

            // Aliased async without drift - FAIL
            reports = runRule(`fetch('/api');`);
            assert.strictEqual(reports.length, 1);
        });
    });
});