import { buildMemberPath, isDriftCall } from '../utils/ast-helpers.js';
import { isAsyncMethod } from '../utils/async-detector/index.js';
import { isTitanCallee } from '../utils/is-titan-callee.js';

/**
 * ESLint rule: drift-only-titan-async
 * Ensures drift() is only used with ASYNC TitanPL native methods.
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
            driftNotForSyncMethods: 'drift() should only be used with async TitanPL methods. "{{method}}" is a sync method and does not require drift().'
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
                    if (argument.type === 'MemberExpression') {
                        const methodPath = buildMemberPath(argument);
                        if (methodPath && isTitanCallee(methodPath)) {
                            context.report({
                                node,
                                messageId: 'driftRequiresCall',
                                data: { method: methodPath }
                            });
                            return;
                        }
                    }

                    reportInvalidDriftUsage(context, node, getArgumentPreview(argument));
                    return;
                }

                // Get the method path from the CallExpression's callee
                const methodPath = buildMemberPath(argument.callee);

                // If we can't determine the path (e.g., variable reference)
                if (!methodPath) {
                    reportInvalidDriftUsage(context, node, getArgumentPreview(argument));
                    return;
                }

                // First check: must be a Titan callee (t.* or Titan.*)
                if (!isTitanCallee(methodPath)) {
                    reportInvalidDriftUsage(context, node, methodPath);
                    return;
                }

                // Second check: must be an ASYNC Titan method
                // Pass context and argument node for type detection
                if (!isAsyncMethod(methodPath, context, argument)) {
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