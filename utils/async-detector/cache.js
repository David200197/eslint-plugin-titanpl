/**
 * Cache for async method detection results
 * Improves performance by avoiding repeated detection for the same method
 */

/**
 * @typedef {import('./index.js').DetectionResult} DetectionResult
 */

export class AsyncMethodCache {
    constructor() {
        /** @type {Map<string, DetectionResult>} */
        this._cache = new Map();
        
        /** @type {number} */
        this._hits = 0;
        
        /** @type {number} */
        this._misses = 0;
    }

    /**
     * Get cached result for a method path
     * @param {string} methodPath - Full method path
     * @returns {DetectionResult | undefined}
     */
    get(methodPath) {
        const result = this._cache.get(methodPath);
        
        if (result !== undefined) {
            this._hits++;
        } else {
            this._misses++;
        }
        
        return result;
    }

    /**
     * Cache a detection result
     * @param {string} methodPath - Full method path
     * @param {DetectionResult} result - Detection result
     */
    set(methodPath, result) {
        this._cache.set(methodPath, result);
    }

    /**
     * Check if a method path is cached
     * @param {string} methodPath - Full method path
     * @returns {boolean}
     */
    has(methodPath) {
        return this._cache.has(methodPath);
    }

    /**
     * Remove a method from cache
     * @param {string} methodPath - Full method path
     * @returns {boolean} - True if the method was in cache
     */
    delete(methodPath) {
        return this._cache.delete(methodPath);
    }

    /**
     * Clear all cached results
     */
    clear() {
        this._cache.clear();
        this._hits = 0;
        this._misses = 0;
    }

    /**
     * Get cache statistics
     * @returns {{ size: number, hits: number, misses: number, hitRate: number }}
     */
    getStats() {
        const total = this._hits + this._misses;
        const hitRate = total > 0 ? this._hits / total : 0;
        
        return {
            size: this._cache.size,
            hits: this._hits,
            misses: this._misses,
            hitRate: Math.round(hitRate * 100) / 100
        };
    }

    /**
     * Get all cached entries (for debugging)
     * @returns {Array<[string, DetectionResult]>}
     */
    entries() {
        return Array.from(this._cache.entries());
    }

    /**
     * Get all cached method paths
     * @returns {string[]}
     */
    keys() {
        return Array.from(this._cache.keys());
    }

    /**
     * Bulk set multiple results
     * @param {Array<[string, DetectionResult]>} entries
     */
    setMany(entries) {
        for (const [methodPath, result] of entries) {
            this._cache.set(methodPath, result);
        }
    }
}

/**
 * Create a scoped cache that auto-clears on file change
 * Useful for per-file caching in ESLint
 */
export class ScopedAsyncMethodCache extends AsyncMethodCache {
    constructor() {
        super();
        /** @type {string | null} */
        this._currentFile = null;
    }

    /**
     * Set current file scope - clears cache if file changed
     * @param {string} filename - Current file being linted
     */
    setScope(filename) {
        if (this._currentFile !== filename) {
            this.clear();
            this._currentFile = filename;
        }
    }

    /**
     * Get current file scope
     * @returns {string | null}
     */
    getScope() {
        return this._currentFile;
    }
}