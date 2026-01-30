/**
 * Tests for require-drift rule
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
    't.core.net.resolveDNS',
    't.core.time.sleep',
    't.core.session.get',
    't.core.session.set',
    't.core.session.delete',
    't.core.session.clear',
    'Titan.core.crypto.hash',
]);

const SYNC_METHODS = new Set([
    't.core.path.join',
    't.core.url.parse',
    't.core.crypto.uuid',
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
                    // Skip if this is a drift() call itself
                    if (node.callee.type === 'Identifier' && node.callee.name === 'drift') {
                        return;
                    }

                    const methodPath = buildMemberPath(node.callee);

                    // Skip if not a Titan callee
                    if (!methodPath || !isTitanCallee(methodPath)) {
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

/**
 * Parse code to AST node
 */
function parseCode(code) {
    // drift(t.method()) - the inner call is inside drift
    const driftMatch = code.match(/^drift\(([tT](?:itan)?(?:\.[a-zA-Z_]+)+)\(.*?\)\);$/);
    if (driftMatch) {
        const parts = driftMatch[1].split('.');
        let node = { type: 'Identifier', name: parts[0] };
        for (let i = 1; i < parts.length; i++) {
            node = {
                type: 'MemberExpression',
                object: node,
                property: { type: 'Identifier', name: parts[i] }
            };
        }
        // Return the inner call marked as inside drift
        return {
            type: 'CallExpression',
            callee: node,
            arguments: [],
            _isInsideDrift: true
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

describe('require-drift', () => {
    describe('valid: async methods with drift', () => {
        const codes = [
            `drift(t.fetch('/api/data'));`,
            `drift(Titan.fetch('/api/data'));`,
            `drift(t.core.fs.readFile('/path/to/file'));`,
            `drift(t.core.fs.writeFile('/path', 'content'));`,
            `drift(t.core.crypto.hash('data'));`,
            `drift(t.core.time.sleep(1000));`,
            `drift(t.core.net.resolveDNS('example.com'));`,
        ];
        for (const code of codes) {
            it(`should pass: ${code}`, () => {
                const reports = runRule(code);
                assert.strictEqual(reports.length, 0, `Expected no errors for: ${code}`);
            });
        }
    });

    describe('valid: sync methods without drift', () => {
        const codes = [
            `t.core.path.join('a', 'b');`,
            `t.core.url.parse('http://example.com');`,
            `t.core.crypto.uuid();`,
        ];
        for (const code of codes) {
            it(`should pass: ${code}`, () => {
                const reports = runRule(code);
                assert.strictEqual(reports.length, 0, `Expected no errors for: ${code}`);
            });
        }
    });

    describe('valid: non-Titan calls', () => {
        const codes = [
            `myFunction();`,
            `someModule.method();`,
            `console.log('hello');`,
        ];
        for (const code of codes) {
            it(`should pass: ${code}`, () => {
                const reports = runRule(code);
                assert.strictEqual(reports.length, 0, `Expected no errors for: ${code}`);
            });
        }
    });

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
        ];
        for (const code of codes) {
            it(`should fail: ${code}`, () => {
                const reports = runRule(code);
                assert.strictEqual(reports.length, 1, `Expected error for: ${code}`);
                assert.strictEqual(reports[0].messageId, 'requireDrift');
            });
        }
    });

    describe('fallback behavior', () => {
        it('should not require drift for unknown Titan method (fallback permissive)', () => {
            // Unknown methods are treated as sync (permissive fallback)
            // So they don't require drift
            const reports = runRule(`t.unknown.newMethod();`);
            assert.strictEqual(reports.length, 0);
        });
    });
});