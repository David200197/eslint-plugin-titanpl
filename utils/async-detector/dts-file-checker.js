/**
 * DTS File Checker for async method detection
 * Reads .d.ts files directly from node_modules to detect async Titan methods
 * Works without requiring TypeScript configuration
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { resolve, join, dirname } from 'path';

/**
 * @typedef {import('./index.js').DetectionResult} DetectionResult
 */

/**
 * Cache for parsed .d.ts files
 * @type {{ methods: Map<string, { isAsync: boolean, returnType: string | null }>, initialized: boolean, projectRoot: string | null }}
 */
const dtsCache = {
    methods: new Map(),
    initialized: false,
    projectRoot: null
};

/**
 * Null result when detection fails
 * @type {DetectionResult}
 */
const NULL_RESULT = { isAsync: null, source: null, returnType: null };

/**
 * Pattern to detect Titan namespace declarations
 */
const TITAN_NAMESPACE_PATTERN = /declare\s+namespace\s+(t|Titan)\s*\{/;

/**
 * Find project root by looking for package.json
 * @param {string} startPath - Starting path to search from
 * @returns {string | null}
 */
function findProjectRoot(startPath) {
    let currentPath = startPath;
    const root = resolve('/');
    
    while (currentPath !== root) {
        const packageJsonPath = join(currentPath, 'package.json');
        if (existsSync(packageJsonPath)) {
            return currentPath;
        }
        currentPath = dirname(currentPath);
    }
    
    return null;
}

/**
 * Get the .d.ts file path for a package
 * Checks: package.json "types" field, "typings" field, or index.d.ts
 * @param {string} packagePath - Path to the package in node_modules
 * @returns {string | null}
 */
function getPackageDtsPath(packagePath) {
    const packageJsonPath = join(packagePath, 'package.json');
    
    if (!existsSync(packageJsonPath)) {
        return null;
    }
    
    try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        
        // Check "types" field first (standard)
        if (packageJson.types) {
            const typesPath = resolve(packagePath, packageJson.types);
            if (existsSync(typesPath)) {
                return typesPath;
            }
        }
        
        // Check "typings" field (legacy)
        if (packageJson.typings) {
            const typingsPath = resolve(packagePath, packageJson.typings);
            if (existsSync(typingsPath)) {
                return typingsPath;
            }
        }
        
        // Fallback: check for index.d.ts
        const indexDtsPath = join(packagePath, 'index.d.ts');
        if (existsSync(indexDtsPath)) {
            return indexDtsPath;
        }
        
        // Check dist/index.d.ts (common pattern)
        const distDtsPath = join(packagePath, 'dist', 'index.d.ts');
        if (existsSync(distDtsPath)) {
            return distDtsPath;
        }
        
        return null;
    } catch {
        return null;
    }
}

/**
 * Parse a namespace block and extract async methods
 * @param {string} content - Namespace content
 * @param {string} prefix - Current namespace prefix (e.g., 't', 't.core')
 */
function parseNamespaceContent(content, prefix) {
    // Find async methods (return Promise<...>)
    const asyncMethodRegex = /(?:function\s+)?(\w+)\s*(?:<[^>]*>)?\s*\([^)]*\)\s*:\s*(Promise\s*<[^;]+>)/g;
    let match;
    
    while ((match = asyncMethodRegex.exec(content)) !== null) {
        const methodName = match[1];
        const returnType = match[2].trim();
        const fullPath = `${prefix}.${methodName}`;
        
        dtsCache.methods.set(fullPath, {
            isAsync: true,
            returnType
        });
    }
    
    // Find sync methods (return type is NOT Promise)
    const syncMethodRegex = /(?:function\s+)?(\w+)\s*(?:<[^>]*>)?\s*\([^)]*\)\s*:\s*(?!Promise\s*<)(\w+(?:<[^;]+>)?)/g;
    
    while ((match = syncMethodRegex.exec(content)) !== null) {
        const methodName = match[1];
        const returnType = match[2].trim();
        const fullPath = `${prefix}.${methodName}`;
        
        // Don't overwrite if already detected as async
        if (!dtsCache.methods.has(fullPath)) {
            dtsCache.methods.set(fullPath, {
                isAsync: false,
                returnType
            });
        }
    }
    
    // Recursively parse nested namespaces
    const nestedNamespaceRegex = /namespace\s+(\w+)\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
    
    while ((match = nestedNamespaceRegex.exec(content)) !== null) {
        const nestedName = match[1];
        const nestedContent = match[2];
        const nestedPrefix = `${prefix}.${nestedName}`;
        
        parseNamespaceContent(nestedContent, nestedPrefix);
    }
}

/**
 * Parse a .d.ts file and extract Titan async methods
 * @param {string} filePath - Path to .d.ts file
 */
function parseDtsFile(filePath) {
    try {
        const content = readFileSync(filePath, 'utf-8');
        
        // Check if file contains Titan namespace declarations
        if (!TITAN_NAMESPACE_PATTERN.test(content)) {
            return;
        }
        
        // Find all top-level Titan namespace declarations
        const topLevelRegex = /declare\s+namespace\s+(t|Titan)\s*\{([^{}]*(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}[^{}]*)*)\}/g;
        let match;
        
        while ((match = topLevelRegex.exec(content)) !== null) {
            const namespaceName = match[1]; // 't' or 'Titan'
            const namespaceContent = match[2];
            
            parseNamespaceContent(namespaceContent, namespaceName);
        }
    } catch {
        // Ignore files that can't be read/parsed
    }
}

/**
 * Process a single package to extract Titan type definitions
 * @param {string} packagePath - Path to package directory
 */
function processPackage(packagePath) {
    const dtsPath = getPackageDtsPath(packagePath);
    
    if (dtsPath) {
        parseDtsFile(dtsPath);
    }
}

/**
 * Scan node_modules for packages with Titan type definitions
 * @param {string} nodeModulesPath - Path to node_modules
 */
function scanNodeModules(nodeModulesPath) {
    if (!existsSync(nodeModulesPath)) {
        return;
    }
    
    try {
        const entries = readdirSync(nodeModulesPath);
        
        for (const entry of entries) {
            // Skip hidden files and common non-package directories
            if (entry.startsWith('.') || entry === '.bin') {
                continue;
            }
            
            const entryPath = join(nodeModulesPath, entry);
            
            try {
                const stat = statSync(entryPath);
                
                if (!stat.isDirectory()) {
                    continue;
                }
                
                // Handle scoped packages (@scope/package)
                if (entry.startsWith('@')) {
                    const scopedEntries = readdirSync(entryPath);
                    for (const scopedEntry of scopedEntries) {
                        const scopedPackagePath = join(entryPath, scopedEntry);
                        try {
                            const scopedStat = statSync(scopedPackagePath);
                            if (scopedStat.isDirectory()) {
                                processPackage(scopedPackagePath);
                            }
                        } catch {
                            continue;
                        }
                    }
                } else {
                    processPackage(entryPath);
                }
            } catch {
                continue;
            }
        }
    } catch {
        // Can't read node_modules
    }
}

/**
 * Initialize the DTS cache by scanning node_modules
 * @param {string} projectRoot - Project root directory
 */
function initializeCache(projectRoot) {
    if (dtsCache.initialized && dtsCache.projectRoot === projectRoot) {
        return;
    }
    
    dtsCache.methods.clear();
    dtsCache.projectRoot = projectRoot;
    
    // Scan node_modules
    const nodeModulesPath = join(projectRoot, 'node_modules');
    scanNodeModules(nodeModulesPath);
    
    // Also scan for local .d.ts files in common locations
    const localDtsPaths = [
        join(projectRoot, 'types', 'titan.d.ts'),
        join(projectRoot, 'src', 'types', 'titan.d.ts'),
        join(projectRoot, 'typings', 'titan.d.ts'),
        join(projectRoot, 'titan.d.ts')
    ];
    
    for (const dtsPath of localDtsPaths) {
        if (existsSync(dtsPath)) {
            parseDtsFile(dtsPath);
        }
    }
    
    dtsCache.initialized = true;
}

/**
 * Check if a method is async using .d.ts file definitions
 * 
 * @param {string} methodPath - Full method path (e.g., 't.ws.connect')
 * @param {Object} context - ESLint rule context
 * @returns {DetectionResult}
 */
export function checkWithDtsFile(methodPath, context) {
    try {
        // Get project root from context
        const filename = context.getFilename?.() || context.filename || '';
        const projectRoot = findProjectRoot(dirname(filename));
        
        if (!projectRoot) {
            return NULL_RESULT;
        }
        
        // Initialize cache if needed
        initializeCache(projectRoot);
        
        // Look up method in cache
        const methodInfo = dtsCache.methods.get(methodPath);
        
        if (methodInfo !== undefined) {
            return {
                isAsync: methodInfo.isAsync,
                source: 'dts-file',
                returnType: methodInfo.returnType
            };
        }
        
        // Method not found in any .d.ts file
        return NULL_RESULT;
        
    } catch {
        return NULL_RESULT;
    }
}

/**
 * Clear the DTS cache (useful for testing or when files change)
 */
export function clearDtsCache() {
    dtsCache.methods.clear();
    dtsCache.initialized = false;
    dtsCache.projectRoot = null;
}

/**
 * Get cache statistics
 * @returns {{ size: number, projectRoot: string | null }}
 */
export function getDtsCacheStats() {
    return {
        size: dtsCache.methods.size,
        projectRoot: dtsCache.projectRoot
    };
}

/**
 * Get all cached methods (for debugging)
 * @returns {Array<[string, { isAsync: boolean, returnType: string | null }]>}
 */
export function getDtsCacheEntries() {
    return Array.from(dtsCache.methods.entries());
}