/**
 * Async Method Detector
 * Detects if a Titan method is async using:
 * 1. DTS File Reader (reads .d.ts from node_modules)
 * 2. Permissive fallback
 */

import { checkWithDtsFile } from './dts-file-checker.js';
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
 * Check if a method path represents an async method
 * Uses cascade detection: DTS File → Fallback
 * 
 * @param {string} methodPath - Full method path (e.g., 't.ws.connect')
 * @param {Object} context - ESLint rule context
 * @param {Object} node - AST node of the call expression
 * @returns {DetectionResult}
 */
export function detectAsyncMethod(methodPath, context, node) {
    // Must be a Titan callee
    if (!isTitanCallee(methodPath)) {
        return { isAsync: false, source: null, returnType: null };
    }

    // Check cache first
    const cached = cache.get(methodPath);
    if (cached !== undefined) {
        return cached;
    }

    let result;

    // 1. Try DTS File Reader (reads .d.ts from node_modules)
    result = checkWithDtsFile(methodPath, context);
    if (result.isAsync !== null) {
        cache.set(methodPath, result);
        return result;
    }

    // 2. Final fallback: unknown Titan methods are treated as sync (permissive)
    result = { isAsync: false, source: 'fallback', returnType: null };
    cache.set(methodPath, result);
    return result;
}

/**
 * Check if a method is async (simple boolean check)
 * 
 * @param {string} methodPath - Full method path
 * @param {Object} context - ESLint rule context
 * @param {Object} node - AST node
 * @returns {boolean}
 */
export function isAsyncMethod(methodPath, context, node) {
    const result = detectAsyncMethod(methodPath, context, node);
    return result.isAsync === true;
}

/**
 * Clear the detection cache
 * Useful for testing or when files change
 */
export function clearCache() {
    cache.clear();
}

/**
 * Get cache statistics
 * @returns {{ size: number, hits: number, misses: number }}
 */
export function getCacheStats() {
    return cache.getStats();
}

export { AsyncMethodCache } from './cache.js';
export { clearDtsCache, getDtsCacheStats } from './dts-file-checker.js';