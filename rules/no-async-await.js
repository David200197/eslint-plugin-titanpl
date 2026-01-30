/**
 * ESLint rule: no-async-await
 * Disallows the use of async/await and .then() in TitanPL
 * TitanPL uses drift() for async operations instead of native async/await
 * 
 * ✗ async function foo() {}
 * ✗ const foo = async () => {}
 * ✗ await somePromise
 * ✗ promise.then(callback)
 * ✗ promise.catch(callback)
 * ✗ promise.finally(callback)
 */
export const noAsyncAwait = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Disallow async/await and Promise methods (.then/.catch/.finally) in TitanPL. Use drift() instead.',
            recommended: true
        },
        schema: [],
        messages: {
            noAsync: 'async functions are not allowed in TitanPL. Use drift() for async operations.',
            noAwait: 'await is not allowed in TitanPL. Use drift() for async operations.',
            noThen: '.then() is not allowed in TitanPL. Use drift() for async operations.',
            noCatch: '.catch() is not allowed in TitanPL. Use drift() for error handling.',
            noFinally: '.finally() is not allowed in TitanPL. Use drift() for async operations.'
        }
    },

    create(context) {
        return {
            // Check for async function declarations: async function foo() {}
            FunctionDeclaration(node) {
                if (node.async) {
                    context.report({
                        node,
                        messageId: 'noAsync'
                    });
                }
            },

            // Check for async function expressions
            // const foo = async function() {}
            // Skip if parent is MethodDefinition (already reported there)
            FunctionExpression(node) {
                if (node.async) {
                    // Skip if already reported via MethodDefinition or Property
                    const parent = node.parent;
                    if (parent && (parent.type === 'MethodDefinition' ||
                        (parent.type === 'Property' && parent.method))) {
                        return;
                    }
                    context.report({
                        node,
                        messageId: 'noAsync'
                    });
                }
            },

            ArrowFunctionExpression(node) {
                if (node.async) {
                    context.report({
                        node,
                        messageId: 'noAsync'
                    });
                }
            },

            // Check for async method definitions in classes/objects
            // class Foo { async method() {} }
            MethodDefinition(node) {
                if (node.value && node.value.async) {
                    context.report({
                        node,
                        messageId: 'noAsync'
                    });
                }
            },

            // Check for async property methods in objects
            // const obj = { async method() {} }
            Property(node) {
                if (node.method && node.value && node.value.async) {
                    context.report({
                        node,
                        messageId: 'noAsync'
                    });
                }
            },

            // Check for await expressions: await somePromise
            AwaitExpression(node) {
                context.report({
                    node,
                    messageId: 'noAwait'
                });
            },

            // Check for .then(), .catch(), .finally() calls
            CallExpression(node) {
                if (node.callee.type !== 'MemberExpression') {
                    return;
                }

                const property = node.callee.property;

                // Handle both computed (obj['then']) and non-computed (obj.then) access
                const methodName = node.callee.computed
                    ? (property.type === 'Literal' ? property.value : null)
                    : property.name;

                if (methodName === 'then') {
                    context.report({
                        node,
                        messageId: 'noThen'
                    });
                } else if (methodName === 'catch') {
                    context.report({
                        node,
                        messageId: 'noCatch'
                    });
                } else if (methodName === 'finally') {
                    context.report({
                        node,
                        messageId: 'noFinally'
                    });
                }
            }
        };
    }
};