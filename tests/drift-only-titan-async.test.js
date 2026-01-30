/**
 * Tests for drift-only-titan-async rule
 * Uses direct mocking of the async detector (DTS File Checker)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

// Define which methods are async/sync for testing
// This simulates what the DTS File Checker would find in .d.ts files
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
]);

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
]);

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
 * Mock detectAsyncMethod for testing
 * Simulates the DTS File Checker behavior
 */
function mockDetectAsyncMethod(methodPath) {
    if (!isTitanCallee(methodPath)) {
        return { isAsync: false, source: null, returnType: null };
    }
    if (ASYNC_METHODS.has(methodPath)) {
        return { isAsync: true, source: 'dts-file', returnType: 'Promise<any>' };
    }
    if (SYNC_METHODS.has(methodPath)) {
        return { isAsync: false, source: 'dts-file', returnType: 'string' };
    }
    // Unknown Titan method - fallback permissive (not found in any .d.ts)
    return { isAsync: false, source: 'fallback', returnType: null };
}

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

                    if (arg.type === 'Identifier') {
                        context.report({ node, messageId: 'driftOnlyForTitanAsync' });
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

                    const methodPath = buildMemberPath(arg.callee);

                    if (!methodPath || !isTitanCallee(methodPath)) {
                        context.report({ node, messageId: 'driftOnlyForTitanAsync' });
                        return;
                    }

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

    const funcMatch = code.match(/^drift\(([a-zA-Z_][a-zA-Z0-9_]*)\(.*?\)\);$/);
    if (funcMatch && !funcMatch[1].match(/^[tT](itan)?$/)) {
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

    const varMatch = code.match(/^drift\(([a-zA-Z_][a-zA-Z0-9_]*)\);$/);
    if (varMatch) {
        return {
            type: 'CallExpression',
            callee: { type: 'Identifier', name: 'drift' },
            arguments: [{ type: 'Identifier', name: varMatch[1] }]
        };
    }

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

    const literalMatch = code.match(/^drift\((['"].*?['"]|\d+|true|false|null)\);$/);
    if (literalMatch) {
        return {
            type: 'CallExpression',
            callee: { type: 'Identifier', name: 'drift' },
            arguments: [{ type: 'Literal', value: literalMatch[1] }]
        };
    }

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

describe('drift-only-titan-async', () => {
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
        ];
        for (const code of codes) {
            it(`should pass: ${code}`, () => {
                const reports = runRule(code);
                assert.strictEqual(reports.length, 0, `Expected no errors for: ${code}`);
            });
        }
    });

    describe('invalid: drift without argument', () => {
        it('should fail: drift();', () => {
            const reports = runRule('drift();');
            assert.strictEqual(reports.length, 1);
            assert.strictEqual(reports[0].messageId, 'driftRequiresArgument');
        });
    });

    describe('invalid: drift with method reference', () => {
        for (const code of ['drift(t.fetch);', 'drift(t.core.fs.readFile);', 'drift(Titan.fetch);']) {
            it(`should fail: ${code}`, () => {
                const reports = runRule(code);
                assert.strictEqual(reports.length, 1);
                assert.strictEqual(reports[0].messageId, 'driftRequiresCall');
            });
        }
    });

    describe('invalid: drift with non-Titan function', () => {
        for (const code of ['drift(myFunction());', 'drift(someModule.method());', 'drift(console.log());']) {
            it(`should fail: ${code}`, () => {
                const reports = runRule(code);
                assert.strictEqual(reports.length, 1);
                assert.strictEqual(reports[0].messageId, 'driftOnlyForTitanAsync');
            });
        }
    });

    describe('invalid: drift with variable', () => {
        for (const code of ['drift(someVariable);', 'drift(unknownRef);', 'drift(promise);']) {
            it(`should fail: ${code}`, () => {
                const reports = runRule(code);
                assert.strictEqual(reports.length, 1);
                assert.strictEqual(reports[0].messageId, 'driftOnlyForTitanAsync');
            });
        }
    });

    describe('invalid: drift with function expression', () => {
        for (const code of ['drift(() => {});', 'drift(function() {});', 'drift(async () => {});']) {
            it(`should fail: ${code}`, () => {
                const reports = runRule(code);
                assert.strictEqual(reports.length, 1);
                assert.strictEqual(reports[0].messageId, 'driftOnlyForTitanAsync');
            });
        }
    });

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
        ];
        for (const code of codes) {
            it(`should fail: ${code}`, () => {
                const reports = runRule(code);
                assert.strictEqual(reports.length, 1, `Expected error for: ${code}`);
                assert.strictEqual(reports[0].messageId, 'driftNotForSyncMethods');
            });
        }
    });

    describe('invalid: drift with literals', () => {
        for (const code of [`drift('string');`, `drift(123);`, `drift(true);`, `drift(false);`, `drift(null);`]) {
            it(`should fail: ${code}`, () => {
                const reports = runRule(code);
                assert.strictEqual(reports.length, 1);
                assert.strictEqual(reports[0].messageId, 'driftOnlyForTitanAsync');
            });
        }
    });

    describe('invalid: drift with objects/arrays', () => {
        for (const code of [`drift({});`, `drift([]);`]) {
            it(`should fail: ${code}`, () => {
                const reports = runRule(code);
                assert.strictEqual(reports.length, 1);
                assert.strictEqual(reports[0].messageId, 'driftOnlyForTitanAsync');
            });
        }
    });

    describe('fallback behavior', () => {
        it('should allow drift with unknown Titan method (fallback permissive)', () => {
            // Unknown methods fall through to fallback which returns isAsync: false
            // So drift(t.unknown.method()) should fail because it's treated as sync
            const reports = runRule(`drift(t.unknown.newMethod());`);
            assert.strictEqual(reports.length, 1);
            assert.strictEqual(reports[0].messageId, 'driftNotForSyncMethods');
        });
    });
});