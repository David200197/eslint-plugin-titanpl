import { buildMemberPath, isDriftCall } from '../utils/ast-helpers.js';
import { isAsyncMethod, checkTitanCallee } from '../utils/async-detector/index.js';

/**
 * ESLint rule: drift-only-titan-async
 * Ensures drift() is only used with ASYNC TitanPL native methods.
 * 
 * Supports:
 * - Direct paths: drift(t.fetch('/api'))
 * - Aliases: drift(fetch('/api'))         where const { fetch } = t
 * - Module aliases: drift(db.query(...))  where const db = t.db
 * - Object aliases: drift(utils.fetch())  where const utils = { fetch: t.fetch }
 * - Declare global: drift(globalFetch())  where typeof t.fetch
 * - Export aliases: drift(exportedFetch()) where export const exportedFetch = t.fetch
 */
export const driftOnlyTitanAsync = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Ensure drift() is only used with async TitanPL native methods (t.* or Titan.*)',
            recommended: true
        },
        schema: [],
        messages: {
            driftOnlyForTitanAsync: 'drift() should only be used with async TitanPL native methods (t.* or Titan.*). "{{arg}}" is not a recognized async Titan method.',
            driftRequiresArgument: 'drift() requires an async TitanPL method call as argument.',
            driftRequiresCall: 'drift() requires a method call as argument, not a reference. Use: drift({{method}}(...))',
            driftNotForSyncMethods: 'drift() should only be used with async TitanPL methods. "{{method}}" is a sync method and does not require drift().',
            driftNotForSyncMethodsAlias: 'drift() should only be used with async TitanPL methods. "{{alias}}" (resolves to {{resolved}}) is a sync method and does not require drift().'
        }
    },

    create(context) {
        return {
            CallExpression(node) {
                if (!isDriftCall(node)) {
                    return;
                }

                // Check if drift has an argument
                if (node.arguments.length === 0) {
                    context.report({
                        node,
                        messageId: 'driftRequiresArgument'
                    });
                    return;
                }

                const argument = node.arguments[0];

                // drift() argument must be a CallExpression (a method call)
                if (argument.type !== 'CallExpression') {
                    // Check if it's a MemberExpression (method reference without call)
                    // e.g., drift(t.fetch) or drift(db.query) where db = t.db
                    if (argument.type === 'MemberExpression') {
                        const methodPath = buildMemberPath(argument);
                        if (methodPath) {
                            const { isTitan } = checkTitanCallee(methodPath, context);
                            if (isTitan) {
                                context.report({
                                    node,
                                    messageId: 'driftRequiresCall',
                                    data: { method: methodPath }
                                });
                                return;
                            }
                        }
                    }

                    // Check if it's an Identifier that is a Titan alias (reference without call)
                    // e.g., drift(fetch) where const { fetch } = t
                    if (argument.type === 'Identifier') {
                        const { isTitan } = checkTitanCallee(argument.name, context);
                        if (isTitan) {
                            context.report({
                                node,
                                messageId: 'driftRequiresCall',
                                data: { method: argument.name }
                            });
                            return;
                        }
                    }

                    reportInvalidDriftUsage(context, node, getArgumentPreview(argument));
                    return;
                }

                // Get the method path from the CallExpression's callee
                const methodPath = buildMemberPath(argument.callee);

                // If we can't determine the path (e.g., computed property)
                if (!methodPath) {
                    reportInvalidDriftUsage(context, node, getArgumentPreview(argument));
                    return;
                }

                // Check if it's a Titan callee — direct OR via alias resolution
                const { isTitan, resolvedPath } = checkTitanCallee(methodPath, context);

                if (!isTitan) {
                    reportInvalidDriftUsage(context, node, methodPath);
                    return;
                }

                // Check if it's an ASYNC Titan method (using the resolved path)
                if (!isAsyncMethod(resolvedPath, context, argument)) {
                    // Different message if it was resolved via alias
                    if (resolvedPath !== methodPath) {
                        context.report({
                            node,
                            messageId: 'driftNotForSyncMethodsAlias',
                            data: {
                                alias: methodPath,
                                resolved: resolvedPath
                            }
                        });
                    } else {
                        context.report({
                            node,
                            messageId: 'driftNotForSyncMethods',
                            data: { method: methodPath }
                        });
                    }
                }
            }
        };
    }
};

/**
 * Report invalid drift usage with appropriate message
 * @param {Object} context - ESLint context
 * @param {Object} node - AST node
 * @param {string} argPreview - Preview of the invalid argument
 */
function reportInvalidDriftUsage(context, node, argPreview) {
    context.report({
        node,
        messageId: 'driftOnlyForTitanAsync',
        data: { arg: argPreview }
    });
}

/**
 * Get a preview string of an argument for error messages
 * @param {Object} argument - AST node
 * @returns {string}
 */
function getArgumentPreview(argument) {
    if (!argument) {
        return '<empty>';
    }

    switch (argument.type) {
        case 'Identifier':
            return argument.name;

        case 'Literal':
            return String(argument.value);

        case 'CallExpression':
            return buildMemberPath(argument.callee) || '<function call>';

        case 'MemberExpression':
            return buildMemberPath(argument) || '<member access>';

        case 'ArrowFunctionExpression':
        case 'FunctionExpression':
            return '<function>';

        default:
            return '<expression>';
    }
}