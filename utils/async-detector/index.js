/**
 * Async Method Detector - Enhanced Version
 * 
 * Detects if a Titan method is async using:
 * 1. DTS File Reader (reads .d.ts from node_modules and project)
 * 2. Alias resolution (destructuring, declare global, exports)
 * 3. Permissive fallback
 */

import { checkWithDtsFile, checkForAlias, clearDtsCache as clearDtsFileCacheInternal, getDtsCacheStats } from './dts-file-checker.js';
import { AsyncMethodCache } from './cache.js';
import { isTitanCallee } from '../is-titan-callee.js';

const cache = new AsyncMethodCache();

/**
 * Detection result with source information
 * @typedef {Object} DetectionResult
 * @property {boolean | null} isAsync - Whether the method is async (null if unknown)
 * @property {'dts-file' | 'fallback' | null} source - Detection source
 * @property {string | null} returnType - Detected return type (if available)
 */

/**
 * Alias detection result
 * @typedef {Object} AliasResult
 * @property {boolean} isAlias - Whether the name is a known alias
 * @property {string | null} originalPath - Original Titan path
 * @property {'destructuring' | 'declare-global' | 'export' | null} source - Alias source
 */

/**
 * Resolve a method name that might be an alias to its original Titan path
 * 
 * @param {string} methodName - Method name (could be alias or full path)
 * @param {Object} context - ESLint rule context
 * @returns {{ resolvedPath: string, wasAlias: boolean, aliasSource: string | null }}
 */
export function resolveMethodPath(methodName, context) {
    // If it already starts with t. or Titan., it's a direct path
    if (isTitanCallee(methodName)) {
        return {
            resolvedPath: methodName,
            wasAlias: false,
            aliasSource: null
        };
    }
    
    // Check if it's a known alias
    const aliasInfo = checkForAlias(methodName, context);
    
    if (aliasInfo.isAlias && aliasInfo.originalPath) {
        return {
            resolvedPath: aliasInfo.originalPath,
            wasAlias: true,
            aliasSource: aliasInfo.source
        };
    }
    
    // Not an alias, return as-is
    return {
        resolvedPath: methodName,
        wasAlias: false,
        aliasSource: null
    };
}

/**
 * Check if a method path represents an async method
 * Uses cascade detection: Alias Resolution → DTS File → Fallback
 * 
 * @param {string} methodPath - Full method path (e.g., 't.ws.connect') or alias name
 * @param {Object} context - ESLint rule context
 * @param {Object} node - AST node of the call expression
 * @returns {DetectionResult}
 */
export function detectAsyncMethod(methodPath, context, node) {
    // First, try to resolve if it's an alias
    const { resolvedPath, wasAlias } = resolveMethodPath(methodPath, context);
    
    // Use the resolved path for detection
    const pathToCheck = resolvedPath;
    
    // Must be a Titan callee (after alias resolution)
    if (!isTitanCallee(pathToCheck)) {
        return { isAsync: false, source: null, returnType: null };
    }

    // Check cache first
    const cached = cache.get(pathToCheck);
    if (cached !== undefined) {
        return cached;
    }

    let result;

    // 1. Try DTS File Reader (reads .d.ts from node_modules and project)
    result = checkWithDtsFile(pathToCheck, context);
    if (result.isAsync !== null) {
        cache.set(pathToCheck, result);
        
        // Also cache the alias if used
        if (wasAlias && methodPath !== pathToCheck) {
            cache.set(methodPath, result);
        }
        
        return result;
    }

    // 2. Final fallback: unknown Titan methods are treated as sync (permissive)
    result = { isAsync: false, source: 'fallback', returnType: null };
    cache.set(pathToCheck, result);
    
    if (wasAlias && methodPath !== pathToCheck) {
        cache.set(methodPath, result);
    }
    
    return result;
}

/**
 * Check if a method is async (simple boolean check)
 * Handles both direct Titan paths and aliases
 * 
 * @param {string} methodPath - Full method path or alias
 * @param {Object} context - ESLint rule context
 * @param {Object} node - AST node
 * @returns {boolean}
 */
export function isAsyncMethod(methodPath, context, node) {
    const result = detectAsyncMethod(methodPath, context, node);
    return result.isAsync === true;
}

/**
 * Check if a name is a Titan alias (from destructuring, declare global, or export)
 * 
 * @param {string} name - Variable/function name to check
 * @param {Object} context - ESLint rule context
 * @returns {AliasResult}
 */
export function isTitanAlias(name, context) {
    return checkForAlias(name, context);
}

/**
 * Check if a callee is or resolves to a Titan method
 * This combines the original isTitanCallee with alias checking
 * 
 * @param {string} calleePath - The callee path or name
 * @param {Object} context - ESLint rule context  
 * @returns {{ isTitan: boolean, resolvedPath: string | null }}
 */
export function checkTitanCallee(calleePath, context) {
    // Direct Titan path
    if (isTitanCallee(calleePath)) {
        return {
            isTitan: true,
            resolvedPath: calleePath
        };
    }
    
    // Check for alias
    const { resolvedPath, wasAlias } = resolveMethodPath(calleePath, context);
    
    if (wasAlias && isTitanCallee(resolvedPath)) {
        return {
            isTitan: true,
            resolvedPath
        };
    }
    
    return {
        isTitan: false,
        resolvedPath: null
    };
}

/**
 * Clear the detection cache
 * Useful for testing or when files change
 */
export function clearCache() {
    cache.clear();
}

/**
 * Clear both detection cache and DTS cache
 */
export function clearAllCaches() {
    cache.clear();
    clearDtsFileCacheInternal();
}

/**
 * Get cache statistics
 * @returns {{ size: number, hits: number, misses: number }}
 */
export function getCacheStats() {
    return cache.getStats();
}

export { AsyncMethodCache } from './cache.js';
export { clearDtsCache, getDtsCacheStats, getAliases, getAliasEntries } from './dts-file-checker.js';