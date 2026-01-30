/**
 * AST utility functions for ESLint rules
 */

/**
 * Build the full member path from a MemberExpression
 * e.g., t.core.fs.readFile → "t.core.fs.readFile"
 * 
 * @param {Object} node - AST node (MemberExpression or Identifier)
 * @returns {string|null} - Full path or null if invalid
 */
export function buildMemberPath(node) {
    if (!node) {
        return null;
    }

    if (node.type === 'Identifier') {
        return node.name;
    }

    if (node.type === 'MemberExpression') {
        const objectPath = buildMemberPath(node.object);
        const propertyName = getPropertyName(node);

        if (!objectPath || !propertyName) {
            return null;
        }

        return `${objectPath}.${propertyName}`;
    }

    return null;
}

/**
 * Extract property name from a MemberExpression
 * Handles both computed (obj['prop']) and non-computed (obj.prop) access
 * 
 * @param {Object} memberExpr - AST MemberExpression node
 * @returns {string|null}
 */
export function getPropertyName(memberExpr) {
    if (!memberExpr || memberExpr.type !== 'MemberExpression') {
        return null;
    }

    if (memberExpr.computed) {
        // obj['prop'] or obj[variable]
        return memberExpr.property.type === 'Literal'
            ? String(memberExpr.property.value)
            : null;
    }

    // obj.prop
    return memberExpr.property.name || null;
}

/**
 * Check if an identifier is one of the Titan globals
 * @param {string} name - Identifier name
 * @returns {boolean}
 */
export function isTitanGlobal(name) {
    return name === 't' || name === 'Titan';
}

/**
 * Get the root identifier of a member expression
 * e.g., t.core.fs.readFile → "t"
 * 
 * @param {Object} node - AST node
 * @returns {string|null}
 */
export function getRootIdentifier(node) {
    if (!node) {
        return null;
    }

    if (node.type === 'Identifier') {
        return node.name;
    }

    if (node.type === 'MemberExpression') {
        return getRootIdentifier(node.object);
    }

    return null;
}

/**
 * Check if a call expression is a drift() call
 * @param {Object} node - AST CallExpression node
 * @returns {boolean}
 */
export function isDriftCall(node) {
    if (!node || node.type !== 'CallExpression') {
        return false;
    }

    const callee = node.callee;
    
    return callee.type === 'Identifier' && callee.name === 'drift';
}