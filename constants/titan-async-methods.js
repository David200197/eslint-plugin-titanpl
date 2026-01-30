/**
 * Native TitanPL async methods that require drift() wrapper
 * These methods return promises and must be called via drift(t.method)
 */
export const TITAN_ASYNC_METHODS = new Set([
    // HTTP / Network
    't.fetch',
    'Titan.fetch',
    
    // File System (async operations)
    't.core.fs.readFile',
    't.core.fs.writeFile',
    't.core.fs.remove',
    't.core.fs.mkdir',
    't.core.fs.readdir',
    't.core.fs.stat',
    't.core.fs.exists',
    'Titan.core.fs.readFile',
    'Titan.core.fs.writeFile',
    'Titan.core.fs.remove',
    'Titan.core.fs.mkdir',
    'Titan.core.fs.readdir',
    'Titan.core.fs.stat',
    'Titan.core.fs.exists',
    
    // Crypto (async operations)
    't.core.crypto.hash',
    't.core.crypto.encrypt',
    't.core.crypto.decrypt',
    't.core.crypto.hashKeyed',
    'Titan.core.crypto.hash',
    'Titan.core.crypto.encrypt',
    'Titan.core.crypto.decrypt',
    'Titan.core.crypto.hashKeyed',
    
    // Network
    't.core.net.resolveDNS',
    'Titan.core.net.resolveDNS',
    
    // Time
    't.core.time.sleep',
    'Titan.core.time.sleep',
    
    // Session
    't.core.session.get',
    't.core.session.set',
    't.core.session.delete',
    't.core.session.clear',
    'Titan.core.session.get',
    'Titan.core.session.set',
    'Titan.core.session.delete',
    'Titan.core.session.clear',
]);

/**
 * Check if a method path represents a Titan async method
 * @param {string} methodPath - Full method path (e.g., 't.fetch', 't.core.fs.readFile')
 * @returns {boolean}
 */
export function isTitanAsyncMethod(methodPath) {
    return TITAN_ASYNC_METHODS.has(methodPath);
}

/**
 * Check if a callee starts with Titan globals (t or Titan)
 * @param {string} calleePath - The callee path
 * @returns {boolean}
 */
export function isTitanCallee(calleePath) {
    return calleePath.startsWith('t.') || calleePath.startsWith('Titan.');
}