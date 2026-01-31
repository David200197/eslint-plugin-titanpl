/**
 * DTS File Checker - Enhanced Version
 * 
 * Reads .d.ts files to detect Titan async methods.
 * 
 * Features:
 * - Scans node_modules for packages with Titan type definitions
 * - Scans project files recursively for .d.ts files
 * - Detects destructuring: const { fetch } = t
 * - Detects declare global with Titan types
 * - Detects exports of Titan properties
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { resolve, join, dirname, extname } from 'path';

/**
 * @typedef {import('./index.js').DetectionResult} DetectionResult
 */

/**
 * @typedef {Object} MethodInfo
 * @property {boolean} isAsync - Whether the method is async
 * @property {string | null} returnType - The return type
 * @property {string} [aliasOf] - Original method path if this is an alias
 */

/**
 * @typedef {Object} AliasInfo
 * @property {string} originalPath - Original Titan path (e.g., 't.fetch')
 * @property {'destructuring' | 'declare-global' | 'export'} source - How the alias was created
 */

/**
 * Cache for parsed .d.ts files
 * @type {{ 
 *   methods: Map<string, MethodInfo>, 
 *   aliases: Map<string, AliasInfo>,
 *   initialized: boolean, 
 *   projectRoot: string | null 
 * }}
 */
const dtsCache = {
    methods: new Map(),
    aliases: new Map(),
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
 * Pattern to detect TitanCore type references
 */
const TITANCORE_TYPE_PATTERN = /TitanCore\.\w+/;

/**
 * Directories to skip when scanning project
 */
const SKIP_DIRECTORIES = new Set([
    'node_modules',
    '.git',
    '.svn',
    'dist',
    'build',
    'coverage',
    '.next',
    '.nuxt',
    '.output',
    'vendor',
    '__pycache__',
    '.cache'
]);

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
 * Parse destructuring patterns from source files
 * Detects: const { fetch, connect } = t
 *          const { fetch: myFetch } = t
 *          const { core: { fs } } = t
 * @param {string} content - File content
 * @param {string} filePath - Path to the file (for context)
 */
function parseDestructuringPatterns(content) {
    // Pattern: const { prop1, prop2 } = t or Titan
    // Also handles: const { prop: alias } = t
    const destructuringRegex = /(?:const|let|var)\s*\{([^}]+)\}\s*=\s*(t|Titan)\b/g;
    let match;
    
    while ((match = destructuringRegex.exec(content)) !== null) {
        const destructuredProps = match[1];
        const sourceVar = match[2]; // 't' or 'Titan'
        
        // Parse individual properties
        parseDestructuredProperties(destructuredProps, sourceVar);
    }
    
    // Pattern: const { nested: { prop } } = t.something
    const nestedDestructuringRegex = /(?:const|let|var)\s*\{([^}]+)\}\s*=\s*(t|Titan)\.(\w+(?:\.\w+)*)/g;
    
    while ((match = nestedDestructuringRegex.exec(content)) !== null) {
        const destructuredProps = match[1];
        const sourceVar = match[2];
        const path = match[3];
        const fullPrefix = `${sourceVar}.${path}`;
        
        parseDestructuredProperties(destructuredProps, fullPrefix);
    }
}

/**
 * Parse destructured properties string
 * @param {string} propsString - The properties string inside { }
 * @param {string} sourcePrefix - The source prefix (e.g., 't', 't.core')
 */
function parseDestructuredProperties(propsString, sourcePrefix) {
    // Split by comma, handling nested objects
    const props = splitDestructuredProps(propsString);
    
    for (const prop of props) {
        const trimmed = prop.trim();
        if (!trimmed) continue;
        
        // Check for rename: originalName: aliasName
        const renameMatch = trimmed.match(/^(\w+)\s*:\s*(\w+)$/);
        if (renameMatch) {
            const originalName = renameMatch[1];
            const aliasName = renameMatch[2];
            const originalPath = `${sourcePrefix}.${originalName}`;
            
            dtsCache.aliases.set(aliasName, {
                originalPath,
                source: 'destructuring'
            });
            continue;
        }
        
        // Check for nested destructuring: prop: { nested1, nested2 }
        const nestedMatch = trimmed.match(/^(\w+)\s*:\s*\{([^}]+)\}$/);
        if (nestedMatch) {
            const propName = nestedMatch[1];
            const nestedProps = nestedMatch[2];
            const nestedPrefix = `${sourcePrefix}.${propName}`;
            
            parseDestructuredProperties(nestedProps, nestedPrefix);
            continue;
        }
        
        // Simple property name
        const simpleMatch = trimmed.match(/^(\w+)$/);
        if (simpleMatch) {
            const propName = simpleMatch[1];
            const originalPath = `${sourcePrefix}.${propName}`;
            
            dtsCache.aliases.set(propName, {
                originalPath,
                source: 'destructuring'
            });
        }
    }
}

/**
 * Split destructured properties handling nested braces
 * @param {string} str - Properties string
 * @returns {string[]}
 */
function splitDestructuredProps(str) {
    const result = [];
    let current = '';
    let braceDepth = 0;
    
    for (const char of str) {
        if (char === '{') {
            braceDepth++;
            current += char;
        } else if (char === '}') {
            braceDepth--;
            current += char;
        } else if (char === ',' && braceDepth === 0) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    
    if (current.trim()) {
        result.push(current);
    }
    
    return result;
}

/**
 * Parse declare global blocks with Titan types
 * Detects: declare global { function fetch(): TitanCore.Response }
 *          declare global { const myFetch: typeof t.fetch }
 *          declare global { interface Window { fetch: TitanCore.Fetch } }
 * @param {string} content - File content
 */
function parseDeclareGlobal(content) {
    // Pattern: declare global { ... }
    const declareGlobalRegex = /declare\s+global\s*\{([^{}]*(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}[^{}]*)*)\}/g;
    let match;
    
    while ((match = declareGlobalRegex.exec(content)) !== null) {
        const globalContent = match[1];
        
        // Parse function declarations with TitanCore types
        parseDeclareGlobalFunctions(globalContent);
        
        // Parse const/var declarations with typeof t.xxx
        parseDeclareGlobalConsts(globalContent);
        
        // Parse interface properties with TitanCore types
        parseDeclareGlobalInterfaces(globalContent);
    }
}

/**
 * Parse function declarations in declare global
 * @param {string} content - Global block content
 */
function parseDeclareGlobalFunctions(content) {
    // Pattern: function name(...): TitanCore.Type or Promise<TitanCore.Type>
    const funcRegex = /function\s+(\w+)\s*(?:<[^>]*>)?\s*\([^)]*\)\s*:\s*((?:Promise\s*<)?TitanCore\.[^;]+>?)/g;
    let match;
    
    while ((match = funcRegex.exec(content)) !== null) {
        const funcName = match[1];
        const returnType = match[2].trim();
        const isAsync = returnType.startsWith('Promise');
        
        // Try to find the original Titan method by the function name
        const possiblePaths = [`t.${funcName}`, `Titan.${funcName}`];
        let originalPath = null;
        
        for (const path of possiblePaths) {
            if (dtsCache.methods.has(path)) {
                originalPath = path;
                break;
            }
        }
        
        dtsCache.aliases.set(funcName, {
            originalPath: originalPath || `t.${funcName}`,
            source: 'declare-global'
        });
        
        // Also register the method info if we don't have it
        if (!dtsCache.methods.has(`global.${funcName}`)) {
            dtsCache.methods.set(`global.${funcName}`, {
                isAsync,
                returnType,
                aliasOf: originalPath
            });
        }
    }
}

/**
 * Parse const declarations with typeof t.xxx in declare global
 * @param {string} content - Global block content
 */
function parseDeclareGlobalConsts(content) {
    // Pattern: const name: typeof t.something
    const constRegex = /(?:const|var|let)\s+(\w+)\s*:\s*typeof\s+(t|Titan)\.(\w+(?:\.\w+)*)/g;
    let match;
    
    while ((match = constRegex.exec(content)) !== null) {
        const constName = match[1];
        const sourceVar = match[2];
        const path = match[3];
        const originalPath = `${sourceVar}.${path}`;
        
        dtsCache.aliases.set(constName, {
            originalPath,
            source: 'declare-global'
        });
    }
    
    // Pattern: const name: TitanCore.Type
    const titanCoreConstRegex = /(?:const|var|let)\s+(\w+)\s*:\s*(TitanCore\.\w+)/g;
    
    while ((match = titanCoreConstRegex.exec(content)) !== null) {
        const constName = match[1];
        const titanType = match[2];
        
        // Extract the type name from TitanCore.TypeName
        const typeNameMatch = titanType.match(/TitanCore\.(\w+)/);
        if (typeNameMatch) {
            const typeName = typeNameMatch[1].toLowerCase();
            // Try to find matching method
            const possiblePaths = [`t.${typeName}`, `Titan.${typeName}`];
            
            for (const path of possiblePaths) {
                if (dtsCache.methods.has(path)) {
                    dtsCache.aliases.set(constName, {
                        originalPath: path,
                        source: 'declare-global'
                    });
                    break;
                }
            }
        }
    }
}

/**
 * Parse interface properties in declare global
 * @param {string} content - Global block content
 */
function parseDeclareGlobalInterfaces(content) {
    // Pattern: interface Name { prop: TitanCore.Type }
    const interfaceRegex = /interface\s+\w+\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
    let match;
    
    while ((match = interfaceRegex.exec(content)) !== null) {
        const interfaceContent = match[1];
        
        // Find properties with TitanCore types
        const propRegex = /(\w+)\s*:\s*((?:Promise\s*<)?TitanCore\.[^;,}]+)/g;
        let propMatch;
        
        while ((propMatch = propRegex.exec(interfaceContent)) !== null) {
            const propName = propMatch[1];
            const titanType = propMatch[2];
            const isAsync = titanType.startsWith('Promise');
            
            // Register as potential global
            if (!dtsCache.methods.has(`global.${propName}`)) {
                dtsCache.methods.set(`global.${propName}`, {
                    isAsync,
                    returnType: titanType
                });
            }
        }
    }
}

/**
 * Parse export statements for Titan properties
 * Detects: export { fetch } from where fetch = t.fetch
 *          export const fetch = t.fetch
 *          export { fetch: t.fetch }
 * @param {string} content - File content
 */
function parseExports(content) {
    // Pattern: export const name = t.something
    const exportConstRegex = /export\s+(?:const|let|var)\s+(\w+)\s*=\s*(t|Titan)\.(\w+(?:\.\w+)*)/g;
    let match;
    
    while ((match = exportConstRegex.exec(content)) !== null) {
        const exportName = match[1];
        const sourceVar = match[2];
        const path = match[3];
        const originalPath = `${sourceVar}.${path}`;
        
        dtsCache.aliases.set(exportName, {
            originalPath,
            source: 'export'
        });
    }
    
    // Pattern in .d.ts: export { name: t.something } or similar type exports
    // export type { Fetch as MyFetch } = typeof t.fetch
    const exportTypeRegex = /export\s+(?:type\s+)?\{\s*(\w+)(?:\s+as\s+(\w+))?\s*\}\s*(?:=|:)\s*(?:typeof\s+)?(t|Titan)\.(\w+(?:\.\w+)*)/g;
    
    while ((match = exportTypeRegex.exec(content)) !== null) {
        const originalName = match[1];
        const aliasName = match[2] || originalName;
        const sourceVar = match[3];
        const path = match[4];
        const originalPath = `${sourceVar}.${path}`;
        
        dtsCache.aliases.set(aliasName, {
            originalPath,
            source: 'export'
        });
    }
    
    // Pattern: export = t.something (module export)
    const exportEqualsRegex = /export\s*=\s*(t|Titan)\.(\w+(?:\.\w+)*)/g;
    
    while ((match = exportEqualsRegex.exec(content)) !== null) {
        const sourceVar = match[1];
        const path = match[2];
        const originalPath = `${sourceVar}.${path}`;
        
        // This exports the whole module as that Titan path
        dtsCache.aliases.set('default', {
            originalPath,
            source: 'export'
        });
    }
}

/**
 * Parse a .d.ts file and extract Titan async methods
 * @param {string} filePath - Path to .d.ts file
 */
function parseDtsFile(filePath) {
    try {
        const content = readFileSync(filePath, 'utf-8');
        
        // Always parse declare global blocks (they may reference TitanCore)
        if (content.includes('declare global')) {
            parseDeclareGlobal(content);
        }
        
        // Parse Titan namespace declarations
        if (TITAN_NAMESPACE_PATTERN.test(content)) {
            // Find all top-level Titan namespace declarations
            const topLevelRegex = /declare\s+namespace\s+(t|Titan)\s*\{([^{}]*(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}[^{}]*)*)\}/g;
            let match;
            
            while ((match = topLevelRegex.exec(content)) !== null) {
                const namespaceName = match[1]; // 't' or 'Titan'
                const namespaceContent = match[2];
                
                parseNamespaceContent(namespaceContent, namespaceName);
            }
        }
        
        // Parse export statements
        if (content.includes('export')) {
            parseExports(content);
        }
        
    } catch {
        // Ignore files that can't be read/parsed
    }
}

/**
 * Parse a source file (.js, .ts) for destructuring patterns
 * @param {string} filePath - Path to source file
 */
function parseSourceFile(filePath) {
    try {
        const content = readFileSync(filePath, 'utf-8');
        
        // Only parse if file references t or Titan
        if (!content.includes('= t') && !content.includes('= Titan') && 
            !content.includes('=t') && !content.includes('=Titan')) {
            return;
        }
        
        parseDestructuringPatterns(content);
        
    } catch {
        // Ignore files that can't be read/parsed
    }
}

/**
 * Recursively scan a directory for .d.ts and source files
 * @param {string} dirPath - Directory to scan
 * @param {number} depth - Current depth (to limit recursion)
 * @param {number} maxDepth - Maximum recursion depth
 */
function scanDirectory(dirPath, depth = 0, maxDepth = 10) {
    if (depth > maxDepth) {
        return;
    }
    
    try {
        const entries = readdirSync(dirPath);
        
        for (const entry of entries) {
            // Skip hidden files and directories to skip
            if (entry.startsWith('.') || SKIP_DIRECTORIES.has(entry)) {
                continue;
            }
            
            const entryPath = join(dirPath, entry);
            
            try {
                const stat = statSync(entryPath);
                
                if (stat.isDirectory()) {
                    // Recurse into subdirectory
                    scanDirectory(entryPath, depth + 1, maxDepth);
                } else if (stat.isFile()) {
                    const ext = extname(entry);
                    
                    if (ext === '.ts' && entry.endsWith('.d.ts')) {
                        // Parse .d.ts files
                        parseDtsFile(entryPath);
                    } else if (ext === '.js' || ext === '.ts' || ext === '.mjs') {
                        // Parse source files for destructuring patterns
                        parseSourceFile(entryPath);
                    }
                }
            } catch {
                continue;
            }
        }
    } catch {
        // Can't read directory
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
 * Initialize the DTS cache by scanning node_modules and project
 * @param {string} projectRoot - Project root directory
 */
function initializeCache(projectRoot) {
    if (dtsCache.initialized && dtsCache.projectRoot === projectRoot) {
        return;
    }
    
    dtsCache.methods.clear();
    dtsCache.aliases.clear();
    dtsCache.projectRoot = projectRoot;
    
    // 1. Scan node_modules first (to get base Titan definitions)
    const nodeModulesPath = join(projectRoot, 'node_modules');
    scanNodeModules(nodeModulesPath);
    
    // 2. Scan predefined local .d.ts paths (backwards compatible)
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
    
    // 3. Recursively scan the entire project for .d.ts files and source files
    scanDirectory(projectRoot);
    
    dtsCache.initialized = true;
}

/**
 * Resolve an alias to its original method info
 * @param {string} name - Alias name or method path
 * @returns {{ methodPath: string, methodInfo: MethodInfo | undefined }}
 */
function resolveAlias(name) {
    // Check if it's a direct method path
    if (dtsCache.methods.has(name)) {
        return {
            methodPath: name,
            methodInfo: dtsCache.methods.get(name)
        };
    }
    
    // Check if it's an alias
    const alias = dtsCache.aliases.get(name);
    if (alias) {
        const methodInfo = dtsCache.methods.get(alias.originalPath);
        return {
            methodPath: alias.originalPath,
            methodInfo
        };
    }
    
    // Check for global methods
    const globalPath = `global.${name}`;
    if (dtsCache.methods.has(globalPath)) {
        return {
            methodPath: globalPath,
            methodInfo: dtsCache.methods.get(globalPath)
        };
    }
    
    return {
        methodPath: name,
        methodInfo: undefined
    };
}

/**
 * Check if a method is async using .d.ts file definitions
 * 
 * @param {string} methodPath - Full method path (e.g., 't.ws.connect') or alias
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
        
        // Try to resolve the method path (including aliases)
        const { methodInfo } = resolveAlias(methodPath);
        
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
 * Check if a name is a known Titan alias (from destructuring, declare global, or export)
 * 
 * @param {string} name - Variable/function name to check
 * @param {Object} context - ESLint rule context
 * @returns {{ isAlias: boolean, originalPath: string | null, source: string | null }}
 */
export function checkForAlias(name, context) {
    try {
        const filename = context.getFilename?.() || context.filename || '';
        const projectRoot = findProjectRoot(dirname(filename));
        
        if (!projectRoot) {
            return { isAlias: false, originalPath: null, source: null };
        }
        
        initializeCache(projectRoot);
        
        const alias = dtsCache.aliases.get(name);
        if (alias) {
            return {
                isAlias: true,
                originalPath: alias.originalPath,
                source: alias.source
            };
        }
        
        return { isAlias: false, originalPath: null, source: null };
        
    } catch {
        return { isAlias: false, originalPath: null, source: null };
    }
}

/**
 * Get all known aliases
 * @returns {Map<string, AliasInfo>}
 */
export function getAliases() {
    return new Map(dtsCache.aliases);
}

/**
 * Clear the DTS cache (useful for testing or when files change)
 */
export function clearDtsCache() {
    dtsCache.methods.clear();
    dtsCache.aliases.clear();
    dtsCache.initialized = false;
    dtsCache.projectRoot = null;
}

/**
 * Get cache statistics
 * @returns {{ methodsSize: number, aliasesSize: number, projectRoot: string | null }}
 */
export function getDtsCacheStats() {
    return {
        methodsSize: dtsCache.methods.size,
        aliasesSize: dtsCache.aliases.size,
        projectRoot: dtsCache.projectRoot
    };
}

/**
 * Get all cached methods (for debugging)
 * @returns {Array<[string, MethodInfo]>}
 */
export function getDtsCacheEntries() {
    return Array.from(dtsCache.methods.entries());
}

/**
 * Get all cached aliases (for debugging)
 * @returns {Array<[string, AliasInfo]>}
 */
export function getAliasEntries() {
    return Array.from(dtsCache.aliases.entries());
}