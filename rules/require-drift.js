import { isTitanAsyncMethod } from '../constants/titan-async-methods.js';
import { buildMemberPath, isDriftCall } from '../utils/ast-helpers.js';

/**
 * ESLint rule: require-drift
 * Requires drift() wrapper for async TitanPL native methods
 * 
 * ✓ drift(t.fetch('/api/data'))
 * ✗ t.fetch('/api/data')
 */
export const requireDrift = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Require drift() wrapper for async TitanPL native methods',
            recommended: true
        },
        schema: [],
        messages: {
            requireDrift: '"{{method}}" is async and must be wrapped with drift(). Use: drift({{method}}(...))'
        }
    },

    create(context) {
        return {
            CallExpression(node) {
                // Skip if this is the drift() call itself
                if (isDriftCall(node)) {
                    return;
                }

                // Skip if already wrapped in drift()
                if (isWrappedInDrift(node)) {
                    return;
                }

                const methodPath = buildMemberPath(node.callee);
                
                if (!methodPath) {
                    return;
                }

                if (isTitanAsyncMethod(methodPath)) {
                    context.report({
                        node,
                        messageId: 'requireDrift',
                        data: {
                            method: methodPath
                        }
                    });
                }
            }
        };
    }
};

/**
 * Check if the call is already wrapped inside drift()
 * Pattern: drift(t.fetch('/api')) where t.fetch('/api') is the argument
 * @param {Object} node - AST CallExpression node
 * @returns {boolean}
 */
function isWrappedInDrift(node) {
    const parent = node.parent;
    
    if (!parent || parent.type !== 'CallExpression') {
        return false;
    }

    // Check if parent is drift() and this node is its argument
    if (isDriftCall(parent) && parent.arguments.includes(node)) {
        return true;
    }
    
    return false;
}