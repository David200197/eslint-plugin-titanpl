/**
 * Tests for drift-only-titan-async rule
 * Uses direct mocking of the async detector (DTS File Checker)
 * 
 * Includes tests for:
 * - Direct Titan method calls
 * - Destructured aliases: const { fetch } = t
 * - Declare global aliases: declare global { const fetch: typeof t.fetch }
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
    't.core.crypto.hashKeyed',
    't.core.net.resolveDNS',
    't.core.time.sleep',
    't.core.session.get',
    't.core.session.set',
    't.core.session.delete',
    't.core.session.clear',
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
    't.core.path.basename',
    't.core.path.extname',
    'Titan.core.path.join',
    't.core.url.parse',
    't.core.url.format',
    't.core.crypto.uuid',
    't.core.crypto.randomBytes',
    't.core.crypto.compare',
    't.core.os.platform',
    't.core.os.cpus',
    't.core.os.totalMemory',
    't.core.os.freeMemory',
    't.core.os.tmpdir',
    't.core.buffer.toBase64',
    't.core.buffer.fromBase64',
    't.core.buffer.toHex',
    't.core.buffer.fromHex',
    't.core.buffer.toUtf8',
    't.core.buffer.fromUtf8',
    't.core.time.now',
    't.core.time.timestamp',
    't.core.proc.pid',
    't.core.proc.uptime',
    't.core.net.ip',
    't.core.ls.get',
    't.core.ls.set',
    't.core.ls.remove',
    't.core.ls.clear',
    't.core.ls.keys',
    't.core.cookies.get',
    't.core.cookies.set',
    't.core.cookies.delete',
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
    // Destructuring aliases
    ['fetch', { originalPath: 't.fetch', source: 'destructuring' }],
    ['readFile', { originalPath: 't.core.fs.readFile', source: 'destructuring' }],
    ['writeFile', { originalPath: 't.core.fs.writeFile', source: 'destructuring' }],
    ['pathJoin', { originalPath: 't.core.path.join', source: 'destructuring' }],
    ['sleep', { originalPath: 't.core.time.sleep', source: 'destructuring' }],
    ['log', { originalPath: 't.log', source: 'destructuring' }],
    ['wsConnect', { originalPath: 't.ws.connect', source: 'destructuring' }],

    // Declare global aliases
    ['globalFetch', { originalPath: 't.fetch', source: 'declare-global' }],
    ['globalReadFile', { originalPath: 't.core.fs.readFile', source: 'declare-global' }],
    ['globalPathJoin', { originalPath: 't.core.path.join', source: 'declare-global' }],

    // Export aliases
    ['exportedFetch', { originalPath: 't.fetch', source: 'export' }],
    ['exportedReadFile', { originalPath: 't.core.fs.readFile', source: 'export' }],
    ['exportedPathJoin', { originalPath: 't.core.path.join', source: 'export' }],
    ['dbQuery', { originalPath: 't.db.query', source: 'export' }],
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
                    if (node.callee.type !== 'Identifier' || node.callee.name !== 'drift') {
                        return;
                    }

                    if (node.arguments.length === 0) {
                        context.report({ node, messageId: 'driftRequiresArgument' });
                        return;
                    }

                    const arg = node.arguments[0];

                    if (arg.type === 'Literal' ||
                        arg.type === 'ObjectExpression' ||
                        arg.type === 'ArrayExpression' ||
                        arg.type === 'ArrowFunctionExpression' ||
                        arg.type === 'FunctionExpression') {
                        context.report({ node, messageId: 'driftOnlyForTitanAsync' });
                        return;
                    }

                    // Handle identifier that could be an alias
                    if (arg.type === 'Identifier') {
                        const { isTitan } = checkTitanCallee(arg.name);
                        if (!isTitan) {
                            context.report({ node, messageId: 'driftOnlyForTitanAsync' });
                        } else {
                            // It's a Titan alias but not a call
                            context.report({
                                node,
                                messageId: 'driftRequiresCall',
                                data: { method: arg.name }
                            });
                        }
                        return;
                    }

                    if (arg.type === 'MemberExpression') {
                        const methodPath = buildMemberPath(arg);
                        context.report({
                            node,
                            messageId: 'driftRequiresCall',
                            data: { method: methodPath }
                        });
                        return;
                    }

                    if (arg.type !== 'CallExpression') {
                        context.report({ node, messageId: 'driftOnlyForTitanAsync' });
                        return;
                    }

                    // Get the callee - could be Identifier (alias) or MemberExpression
                    let methodPath;
                    if (arg.callee.type === 'Identifier') {
                        methodPath = arg.callee.name;
                    } else {
                        methodPath = buildMemberPath(arg.callee);
                    }

                    // Check if it's a Titan method (direct or via alias)
                    const { isTitan, resolvedPath } = checkTitanCallee(methodPath);

                    if (!isTitan) {
                        context.report({ node, messageId: 'driftOnlyForTitanAsync' });
                        return;
                    }

                    // Check if async using resolved path
                    const detection = mockDetectAsyncMethod(methodPath);

                    if (!detection.isAsync) {
                        context.report({
                            node,
                            messageId: 'driftNotForSyncMethods',
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
    if (code === 'drift();') {
        return {
            type: 'CallExpression',
            callee: { type: 'Identifier', name: 'drift' },
            arguments: []
        };
    }

    // drift(aliasRef) - reference to alias without calling
    const aliasRefMatch = code.match(/^drift\(([a-zA-Z_][a-zA-Z0-9_]*)\);$/);
    if (aliasRefMatch && ALIASES.has(aliasRefMatch[1])) {
        return {
            type: 'CallExpression',
            callee: { type: 'Identifier', name: 'drift' },
            arguments: [{ type: 'Identifier', name: aliasRefMatch[1] }]
        };
    }

    // drift(alias()) - alias function call
    const aliasCallMatch = code.match(/^drift\(([a-zA-Z_][a-zA-Z0-9_]*)\(.*?\)\);$/);
    if (aliasCallMatch && ALIASES.has(aliasCallMatch[1])) {
        return {
            type: 'CallExpression',
            callee: { type: 'Identifier', name: 'drift' },
            arguments: [{
                type: 'CallExpression',
                callee: { type: 'Identifier', name: aliasCallMatch[1] },
                arguments: []
            }]
        };
    }

    // drift(t.method) - reference without call
    const refMatch = code.match(/^drift\(([tT](?:itan)?(?:\.[a-zA-Z_][a-zA-Z0-9_]*)+)\);$/);
    if (refMatch) {
        const parts = refMatch[1].split('.');
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
            callee: { type: 'Identifier', name: 'drift' },
            arguments: [node]
        };
    }

    // drift(t.method()) - Titan call
    const titanCallMatch = code.match(/^drift\(([tT](?:itan)?(?:\.[a-zA-Z_][a-zA-Z0-9_]*)+)\(.*?\)\);$/);
    if (titanCallMatch) {
        const parts = titanCallMatch[1].split('.');
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
            callee: { type: 'Identifier', name: 'drift' },
            arguments: [{
                type: 'CallExpression',
                callee: node,
                arguments: []
            }]
        };
    }

    // drift(func()) - non-Titan function call
    const funcMatch = code.match(/^drift\(([a-zA-Z_][a-zA-Z0-9_]*)\(.*?\)\);$/);
    if (funcMatch && !funcMatch[1].match(/^[tT](itan)?$/) && !ALIASES.has(funcMatch[1])) {
        return {
            type: 'CallExpression',
            callee: { type: 'Identifier', name: 'drift' },
            arguments: [{
                type: 'CallExpression',
                callee: { type: 'Identifier', name: funcMatch[1] },
                arguments: []
            }]
        };
    }

    // drift(module.method()) - non-Titan module call
    const moduleMatch = code.match(/^drift\(([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)\(.*?\)\);$/);
    if (moduleMatch && !moduleMatch[1].match(/^[tT](itan)?$/)) {
        return {
            type: 'CallExpression',
            callee: { type: 'Identifier', name: 'drift' },
            arguments: [{
                type: 'CallExpression',
                callee: {
                    type: 'MemberExpression',
                    object: { type: 'Identifier', name: moduleMatch[1] },
                    property: { type: 'Identifier', name: moduleMatch[2] }
                },
                arguments: []
            }]
        };
    }

    // drift(variable) - variable reference
    const varMatch = code.match(/^drift\(([a-zA-Z_][a-zA-Z0-9_]*)\);$/);
    if (varMatch) {
        return {
            type: 'CallExpression',
            callee: { type: 'Identifier', name: 'drift' },
            arguments: [{ type: 'Identifier', name: varMatch[1] }]
        };
    }

    // drift(() => {}) or drift(function() {})
    if (code.includes('() =>') || code.includes('function()')) {
        return {
            type: 'CallExpression',
            callee: { type: 'Identifier', name: 'drift' },
            arguments: [{
                type: code.includes('=>') ? 'ArrowFunctionExpression' : 'FunctionExpression',
                async: code.includes('async')
            }]
        };
    }

    // drift(literal)
    const literalMatch = code.match(/^drift\((['"].*?['"]|\d+|true|false|null)\);$/);
    if (literalMatch) {
        return {
            type: 'CallExpression',
            callee: { type: 'Identifier', name: 'drift' },
            arguments: [{ type: 'Literal', value: literalMatch[1] }]
        };
    }

    // drift({}) or drift([])
    if (code === 'drift({});') {
        return {
            type: 'CallExpression',
            callee: { type: 'Identifier', name: 'drift' },
            arguments: [{ type: 'ObjectExpression', properties: [] }]
        };
    }
    if (code === 'drift([]);') {
        return {
            type: 'CallExpression',
            callee: { type: 'Identifier', name: 'drift' },
            arguments: [{ type: 'ArrayExpression', elements: [] }]
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

describe('drift-only-titan-async', () => {

    // =========================================================================
    // VALID: Direct Titan async methods with drift
    // =========================================================================
    describe('valid: async Titan methods with drift', () => {
        const codes = [
            `drift(t.fetch('/api'));`,
            `drift(Titan.fetch('/api'));`,
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
            `drift(t.core.net.resolveDNS('example.com'));`,
            `drift(t.core.time.sleep(1000));`,
            `drift(t.core.session.get('key'));`,
            `drift(t.core.session.set('key', 'value'));`,
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
    // VALID: Destructured aliases with drift (async methods)
    // =========================================================================
    describe('valid: destructured async aliases with drift', () => {
        const codes = [
            // const { fetch } = t; drift(fetch('/api'));
            `drift(fetch('/api'));`,
            // const { readFile } = t.core.fs; drift(readFile('/file'));
            `drift(readFile('/file'));`,
            // const { writeFile } = t.core.fs; drift(writeFile('/file', 'data'));
            `drift(writeFile('/file', 'data'));`,
            // const { sleep } = t.core.time; drift(sleep(1000));
            `drift(sleep(1000));`,
            // const { connect: wsConnect } = t.ws; drift(wsConnect('wss://...'));
            `drift(wsConnect('wss://example.com'));`,
        ];
        for (const code of codes) {
            it(`should pass: ${code}`, () => {
                const reports = runRule(code);
                assert.strictEqual(reports.length, 0, `Expected no errors for: ${code}`);
            });
        }
    });

    // =========================================================================
    // VALID: Declare global aliases with drift (async methods)
    // =========================================================================
    describe('valid: declare global async aliases with drift', () => {
        const codes = [
            // declare global { const globalFetch: typeof t.fetch }
            `drift(globalFetch('/api'));`,
            // declare global { const globalReadFile: typeof t.core.fs.readFile }
            `drift(globalReadFile('/file'));`,
        ];
        for (const code of codes) {
            it(`should pass: ${code}`, () => {
                const reports = runRule(code);
                assert.strictEqual(reports.length, 0, `Expected no errors for: ${code}`);
            });
        }
    });

    // =========================================================================
    // VALID: Export aliases with drift (async methods)
    // =========================================================================
    describe('valid: exported async aliases with drift', () => {
        const codes = [
            // export const exportedFetch = t.fetch;
            `drift(exportedFetch('/api'));`,
            // export const exportedReadFile = t.core.fs.readFile;
            `drift(exportedReadFile('/file'));`,
            // export const dbQuery = t.db.query;
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
    // INVALID: drift without argument
    // =========================================================================
    describe('invalid: drift without argument', () => {
        it('should fail: drift();', () => {
            const reports = runRule('drift();');
            assert.strictEqual(reports.length, 1);
            assert.strictEqual(reports[0].messageId, 'driftRequiresArgument');
        });
    });

    // =========================================================================
    // INVALID: drift with method reference (not called)
    // =========================================================================
    describe('invalid: drift with method reference', () => {
        const codes = [
            'drift(t.fetch);',
            'drift(t.core.fs.readFile);',
            'drift(Titan.fetch);',
        ];
        for (const code of codes) {
            it(`should fail: ${code}`, () => {
                const reports = runRule(code);
                assert.strictEqual(reports.length, 1);
                assert.strictEqual(reports[0].messageId, 'driftRequiresCall');
            });
        }
    });

    // =========================================================================
    // INVALID: drift with alias reference (not called)
    // =========================================================================
    describe('invalid: drift with alias reference (not called)', () => {
        const codes = [
            // const { fetch } = t; drift(fetch); // missing ()
            'drift(fetch);',
            // const { readFile } = t.core.fs; drift(readFile);
            'drift(readFile);',
        ];
        for (const code of codes) {
            it(`should fail: ${code}`, () => {
                const reports = runRule(code);
                assert.strictEqual(reports.length, 1);
                assert.strictEqual(reports[0].messageId, 'driftRequiresCall');
            });
        }
    });

    // =========================================================================
    // INVALID: drift with non-Titan function
    // =========================================================================
    describe('invalid: drift with non-Titan function', () => {
        const codes = [
            'drift(myFunction());',
            'drift(someModule.method());',
            'drift(console.log());',
        ];
        for (const code of codes) {
            it(`should fail: ${code}`, () => {
                const reports = runRule(code);
                assert.strictEqual(reports.length, 1);
                assert.strictEqual(reports[0].messageId, 'driftOnlyForTitanAsync');
            });
        }
    });

    // =========================================================================
    // INVALID: drift with unknown variable
    // =========================================================================
    describe('invalid: drift with variable', () => {
        const codes = [
            'drift(someVariable);',
            'drift(unknownRef);',
            'drift(promise);',
        ];
        for (const code of codes) {
            it(`should fail: ${code}`, () => {
                const reports = runRule(code);
                assert.strictEqual(reports.length, 1);
                assert.strictEqual(reports[0].messageId, 'driftOnlyForTitanAsync');
            });
        }
    });

    // =========================================================================
    // INVALID: drift with function expression
    // =========================================================================
    describe('invalid: drift with function expression', () => {
        const codes = [
            'drift(() => {});',
            'drift(function() {});',
            'drift(async () => {});',
        ];
        for (const code of codes) {
            it(`should fail: ${code}`, () => {
                const reports = runRule(code);
                assert.strictEqual(reports.length, 1);
                assert.strictEqual(reports[0].messageId, 'driftOnlyForTitanAsync');
            });
        }
    });

    // =========================================================================
    // INVALID: drift with SYNC Titan methods (direct)
    // =========================================================================
    describe('invalid: drift with SYNC Titan methods', () => {
        const codes = [
            `drift(t.core.path.join('a', 'b'));`,
            `drift(t.core.path.resolve('/dir', 'file'));`,
            `drift(t.core.path.dirname('/path'));`,
            `drift(t.core.path.basename('/path'));`,
            `drift(t.core.path.extname('file.txt'));`,
            `drift(Titan.core.path.join('a', 'b'));`,
            `drift(t.core.url.parse('http://example.com'));`,
            `drift(t.core.crypto.uuid());`,
            `drift(t.core.crypto.randomBytes(32));`,
            `drift(t.core.crypto.compare('a', 'b'));`,
            `drift(t.core.os.platform());`,
            `drift(t.core.os.cpus());`,
            `drift(t.core.buffer.toBase64('hello'));`,
            `drift(t.core.time.now());`,
            `drift(t.core.time.timestamp());`,
            `drift(t.core.proc.pid());`,
            `drift(t.core.net.ip());`,
            `drift(t.core.ls.get('key'));`,
            `drift(t.core.ls.set('key', 'val'));`,
            `drift(t.core.cookies.get('token'));`,
            `drift(t.log('message'));`,
        ];
        for (const code of codes) {
            it(`should fail: ${code}`, () => {
                const reports = runRule(code);
                assert.strictEqual(reports.length, 1, `Expected error for: ${code}`);
                assert.strictEqual(reports[0].messageId, 'driftNotForSyncMethods');
            });
        }
    });

    // =========================================================================
    // INVALID: drift with SYNC aliases (destructured)
    // =========================================================================
    describe('invalid: drift with SYNC destructured aliases', () => {
        const codes = [
            // const { join: pathJoin } = t.core.path; drift(pathJoin('a', 'b'));
            `drift(pathJoin('a', 'b'));`,
            // const { log } = t; drift(log('msg'));
            `drift(log('message'));`,
        ];
        for (const code of codes) {
            it(`should fail: ${code}`, () => {
                const reports = runRule(code);
                assert.strictEqual(reports.length, 1, `Expected error for: ${code}`);
                assert.strictEqual(reports[0].messageId, 'driftNotForSyncMethods');
            });
        }
    });

    // =========================================================================
    // INVALID: drift with SYNC aliases (declare global)
    // =========================================================================
    describe('invalid: drift with SYNC declare global aliases', () => {
        const codes = [
            // declare global { const globalPathJoin: typeof t.core.path.join }
            `drift(globalPathJoin('a', 'b'));`,
        ];
        for (const code of codes) {
            it(`should fail: ${code}`, () => {
                const reports = runRule(code);
                assert.strictEqual(reports.length, 1, `Expected error for: ${code}`);
                assert.strictEqual(reports[0].messageId, 'driftNotForSyncMethods');
            });
        }
    });

    // =========================================================================
    // INVALID: drift with SYNC aliases (export)
    // =========================================================================
    describe('invalid: drift with SYNC exported aliases', () => {
        const codes = [
            // export const exportedPathJoin = t.core.path.join;
            `drift(exportedPathJoin('a', 'b'));`,
        ];
        for (const code of codes) {
            it(`should fail: ${code}`, () => {
                const reports = runRule(code);
                assert.strictEqual(reports.length, 1, `Expected error for: ${code}`);
                assert.strictEqual(reports[0].messageId, 'driftNotForSyncMethods');
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
            `drift(false);`,
            `drift(null);`,
        ];
        for (const code of codes) {
            it(`should fail: ${code}`, () => {
                const reports = runRule(code);
                assert.strictEqual(reports.length, 1);
                assert.strictEqual(reports[0].messageId, 'driftOnlyForTitanAsync');
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
            it(`should fail: ${code}`, () => {
                const reports = runRule(code);
                assert.strictEqual(reports.length, 1);
                assert.strictEqual(reports[0].messageId, 'driftOnlyForTitanAsync');
            });
        }
    });

    // =========================================================================
    // FALLBACK BEHAVIOR
    // =========================================================================
    describe('fallback behavior', () => {
        it('should fail drift with unknown Titan method (fallback permissive = sync)', () => {
            // Unknown methods fall through to fallback which returns isAsync: false
            // So drift(t.unknown.method()) should fail because it's treated as sync
            const reports = runRule(`drift(t.unknown.newMethod());`);
            assert.strictEqual(reports.length, 1);
            assert.strictEqual(reports[0].messageId, 'driftNotForSyncMethods');
        });
    });
});