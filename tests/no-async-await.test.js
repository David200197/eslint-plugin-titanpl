import { describe, it } from 'node:test';
import { RuleTester } from 'eslint';
import { noAsyncAwait } from '../rules/no-async-await.js';

const ruleTester = new RuleTester({
    languageOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        globals: {
            t: 'readonly',
            Titan: 'readonly',
            drift: 'readonly',
            console: 'readonly',
            fetch: 'readonly',
            promise: 'readonly',
            Promise: 'readonly',
            callback: 'readonly',
            success: 'readonly',
            error: 'readonly',
            errorHandler: 'readonly',
            cleanup: 'readonly',
            setLoading: 'readonly',
            data: 'readonly',
            bar: 'readonly',
            somePromise: 'readonly'
        }
    }
});

describe('no-async-await', () => {
    it('should disallow async/await and .then()/.catch()/.finally()', () => {
        ruleTester.run('no-async-await', noAsyncAwait, {
            valid: [
                // ============================================
                // Valid: Regular functions (not async)
                // ============================================
                `function foo() { return 1; }`,
                `function fetchData() { return drift(t.fetch('/api')); }`,
                `const foo = function() { return 1; };`,
                `const foo = () => 1;`,
                `const foo = (x) => x * 2;`,
                `const foo = (a, b) => { return a + b; };`,

                // ============================================
                // Valid: Regular method definitions (not async)
                // ============================================
                `class Foo { method() { return 1; } }`,
                `class API { fetch() { return drift(t.fetch('/api')); } }`,
                `class Service {
                    getData() { return drift(t.core.fs.readFile('/data')); }
                    processData(data) { return data.map(x => x * 2); }
                }`,

                // ============================================
                // Valid: Regular object methods (not async)
                // ============================================
                `const obj = { method() { return 1; } };`,
                `const api = { 
                    fetch(url) { return drift(t.fetch(url)); }
                };`,
                `const handlers = {
                    onClick() { console.log('clicked'); },
                    onSubmit() { return drift(t.fetch('/submit')); }
                };`,

                // ============================================
                // Valid: Using drift() - the correct approach
                // ============================================
                `drift(t.fetch('/api'));`,
                `const result = drift(t.core.fs.readFile('/file'));`,
                `function getData() {
                    const data = drift(t.fetch('/api'));
                    return data;
                }`,

                // ============================================
                // Valid: Regular method calls (not .then/.catch/.finally)
                // ============================================
                `console.log('hello');`,
                `array.map(x => x * 2);`,
                `str.split(',').join('-');`,
                `array.filter(x => x > 0).map(x => x * 2);`,
                `obj.method().another().final();`,
                `string.trim().toLowerCase().split(' ');`,

                // ============================================
                // Valid: Properties named 'then', 'catch', 'finally'
                // (but not called as methods)
                // ============================================
                `const obj = { then: 1, catch: 2, finally: 3 };`,
                `obj.then = callback;`,
                `obj.catch = errorHandler;`,
                `obj.finally = cleanup;`,
                `const then = 'value';`,
                `const catchValue = 'error';`,
                `const finallyValue = 'done';`,

                // ============================================
                // Valid: Variable names with promise-like names
                // ============================================
                `const thenResult = 1;`,
                `const catchError = 'error';`,
                `const finallyCleanup = () => {};`,
            ],
            invalid: [
                // ============================================
                // Invalid: Async function declarations
                // ============================================
                {
                    code: `async function foo() {}`,
                    errors: [{ messageId: 'noAsync' }]
                },
                {
                    code: `async function fetchData() { return data; }`,
                    errors: [{ messageId: 'noAsync' }]
                },
                {
                    code: `async function processItems(items) {
                        for (const item of items) {
                            console.log(item);
                        }
                    }`,
                    errors: [{ messageId: 'noAsync' }]
                },

                // ============================================
                // Invalid: Async function expressions
                // ============================================
                {
                    code: `const foo = async function() {};`,
                    errors: [{ messageId: 'noAsync' }]
                },
                {
                    code: `const fetchData = async function() { return data; };`,
                    errors: [{ messageId: 'noAsync' }]
                },
                {
                    code: `const handler = async function handler() { return 1; };`,
                    errors: [{ messageId: 'noAsync' }]
                },

                // ============================================
                // Invalid: Async arrow functions
                // ============================================
                {
                    code: `const foo = async () => {};`,
                    errors: [{ messageId: 'noAsync' }]
                },
                {
                    code: `const foo = async (x) => x * 2;`,
                    errors: [{ messageId: 'noAsync' }]
                },
                {
                    code: `const fetchData = async () => {
                        return data;
                    };`,
                    errors: [{ messageId: 'noAsync' }]
                },
                {
                    code: `const handler = async (event) => event.preventDefault();`,
                    errors: [{ messageId: 'noAsync' }]
                },
                {
                    code: `array.map(async (item) => item);`,
                    errors: [{ messageId: 'noAsync' }]
                },
                {
                    code: `items.forEach(async (item) => { console.log(item); });`,
                    errors: [{ messageId: 'noAsync' }]
                },

                // ============================================
                // Invalid: Async methods in classes
                // ============================================
                {
                    code: `class Foo { async method() {} }`,
                    errors: [{ messageId: 'noAsync' }]
                },
                {
                    code: `class API { async fetch() { return data; } }`,
                    errors: [{ messageId: 'noAsync' }]
                },
                {
                    code: `class Service {
                        async getData() { return data; }
                    }`,
                    errors: [{ messageId: 'noAsync' }]
                },
                {
                    code: `class Controller {
                        async handleRequest() {}
                        async handleResponse() {}
                    }`,
                    errors: [{ messageId: 'noAsync' }, { messageId: 'noAsync' }]
                },

                // ============================================
                // Invalid: Async methods in objects
                // ============================================
                {
                    code: `const obj = { async method() {} };`,
                    errors: [{ messageId: 'noAsync' }]
                },
                {
                    code: `const api = { async fetch() { return data; } };`,
                    errors: [{ messageId: 'noAsync' }]
                },
                {
                    code: `const handlers = {
                        async onClick() {},
                        async onSubmit() {}
                    };`,
                    errors: [{ messageId: 'noAsync' }, { messageId: 'noAsync' }]
                },

                // ============================================
                // Invalid: Await expressions
                // ============================================
                {
                    code: `async function foo() { await bar(); }`,
                    errors: [{ messageId: 'noAsync' }, { messageId: 'noAwait' }]
                },
                {
                    code: `async function foo() { const x = await bar(); }`,
                    errors: [{ messageId: 'noAsync' }, { messageId: 'noAwait' }]
                },
                {
                    code: `async function foo() {
                        const a = await bar();
                        const b = await bar();
                    }`,
                    errors: [{ messageId: 'noAsync' }, { messageId: 'noAwait' }, { messageId: 'noAwait' }]
                },
                {
                    code: `async () => await somePromise;`,
                    errors: [{ messageId: 'noAsync' }, { messageId: 'noAwait' }]
                },

                // ============================================
                // Invalid: .then() calls
                // ============================================
                {
                    code: `promise.then(callback);`,
                    errors: [{ messageId: 'noThen' }]
                },
                {
                    code: `fetch('/api').then(res => res.json());`,
                    errors: [{ messageId: 'noThen' }]
                },
                {
                    code: `somePromise.then(success, error);`,
                    errors: [{ messageId: 'noThen' }]
                },
                {
                    code: `Promise.resolve(1).then(x => x);`,
                    errors: [{ messageId: 'noThen' }]
                },
                {
                    code: `getData().then(data => process(data));`,
                    errors: [{ messageId: 'noThen' }]
                },

                // ============================================
                // Invalid: .catch() calls
                // ============================================
                {
                    code: `promise.catch(errorHandler);`,
                    errors: [{ messageId: 'noCatch' }]
                },
                {
                    code: `fetch('/api').catch(err => console.error(err));`,
                    errors: [{ messageId: 'noCatch' }]
                },
                {
                    code: `somePromise.catch(e => { throw e; });`,
                    errors: [{ messageId: 'noCatch' }]
                },

                // ============================================
                // Invalid: .finally() calls
                // ============================================
                {
                    code: `promise.finally(cleanup);`,
                    errors: [{ messageId: 'noFinally' }]
                },
                {
                    code: `fetch('/api').finally(() => setLoading(false));`,
                    errors: [{ messageId: 'noFinally' }]
                },
                {
                    code: `somePromise.finally(() => { console.log('done'); });`,
                    errors: [{ messageId: 'noFinally' }]
                },

                // ============================================
                // Invalid: Chained promise methods
                // Note: Errors reported in AST order (outermost first for chains)
                // ============================================
                {
                    code: `promise.then(success).catch(error);`,
                    errors: [{ messageId: 'noCatch' }, { messageId: 'noThen' }]
                },
                {
                    code: `promise.then(x => x).then(y => y).catch(e => e);`,
                    errors: [
                        { messageId: 'noCatch' },
                        { messageId: 'noThen' },
                        { messageId: 'noThen' }
                    ]
                },
                {
                    code: `fetch('/api').then(r => r.json()).then(d => d).catch(e => e).finally(() => {});`,
                    errors: [
                        { messageId: 'noFinally' },
                        { messageId: 'noCatch' },
                        { messageId: 'noThen' },
                        { messageId: 'noThen' }
                    ]
                },

                // ============================================
                // Invalid: Computed property access for promise methods
                // ============================================
                {
                    code: `promise['then'](callback);`,
                    errors: [{ messageId: 'noThen' }]
                },
                {
                    code: `promise['catch'](handler);`,
                    errors: [{ messageId: 'noCatch' }]
                },
                {
                    code: `promise['finally'](cleanup);`,
                    errors: [{ messageId: 'noFinally' }]
                },

                // ============================================
                // Invalid: Complex scenarios
                // ============================================
                {
                    code: `const result = promise.then(data => data.items);`,
                    errors: [{ messageId: 'noThen' }]
                },
                {
                    code: `function test() { return fetch('/api').then(r => r.json()); }`,
                    errors: [{ messageId: 'noThen' }]
                },
                {
                    code: `(async () => { await fetch('/api'); })();`,
                    errors: [{ messageId: 'noAsync' }, { messageId: 'noAwait' }]
                },
            ]
        });
    });
});