/**
 * Check if a callee starts with Titan globals (t or Titan)
 * @param {string} calleePath - The callee path
 * @returns {boolean}
 */
export function isTitanCallee(calleePath) {
    return calleePath.startsWith('t.') || calleePath.startsWith('Titan.');
}