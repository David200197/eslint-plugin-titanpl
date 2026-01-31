/**
 * DTS File Checker - Complete Version
 * 
 * Reads .d.ts files to detect Titan async methods.
 * 
 * Supports ALL declaration styles:
 * 1. declare namespace t { ... }
 * 2. declare global { const t: TitanRuntimeUtils; interface TitanRuntimeUtils { ... } }
 * 3. Nested namespace references (TitanCore.FileSystem)
 * 
 * Alias Detection (ALL cases):
 * 1. Destructuring simple: const { fetch } = t
 * 2. Destructuring rename: const { fetch: myFetch } = t
 * 3. Destructuring path: const { readFile } = t.core.fs
 * 4. Simple assignment: const myFetch = t.fetch
 * 5. Module assignment: const db = t.db (then db.query() resolves to t.db.query)
 * 6. Export assignment: export const myFetch = t.fetch
 * 7. Export module: export const db = t.db
 * 8. Export object: export const db = { query: t.db.query }
 * 9. Object inline: const utils = { fetch: t.fetch }
 * 10. Declare global typeof: declare global { const myFetch: typeof t.fetch }
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
 */

/**
 * @typedef {Object} AliasInfo
 * @property {string} originalPath - Original Titan path (e.g., 't.fetch' or 't.db' for modules)
 * @property {'destructuring' | 'assignment' | 'export' | 'object-property' | 'declare-global'} source
 * @property {boolean} [isModule] - True if this alias points to a module (not a method)
 */

/**
 * Cache for parsed .d.ts files
 */
const dtsCache = {
    /** @type {Map<string, MethodInfo>} */
    methods: new Map(),
    /** @type {Map<string, AliasInfo>} */
    aliases: new Map(),
    /** @type {Map<string, Map<string, MethodInfo>>} */
    interfaces: new Map(),
    /** @type {boolean} */
    initialized: false,
    /** @type {string | null} */
    projectRoot: null,
    /** @type {string | null} */
    _lastParsedFile: null
};

/**
 * Null result when detection fails
 * @type {DetectionResult}
 */
const NULL_RESULT = { isAsync: null, source: null, returnType: null };

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
    '.cache',
    '.titan',
    'target'
]);

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Find project root by looking for package.json
 * @param {string} startPath
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
 * @param {string} packagePath
 * @returns {string | null}
 */
function getPackageDtsPath(packagePath) {
    const packageJsonPath = join(packagePath, 'package.json');

    if (!existsSync(packageJsonPath)) {
        return null;
    }

    try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

        if (packageJson.types) {
            const typesPath = resolve(packagePath, packageJson.types);
            if (existsSync(typesPath)) return typesPath;
        }

        if (packageJson.typings) {
            const typingsPath = resolve(packagePath, packageJson.typings);
            if (existsSync(typingsPath)) return typingsPath;
        }

        const indexDtsPath = join(packagePath, 'index.d.ts');
        if (existsSync(indexDtsPath)) return indexDtsPath;

        const distDtsPath = join(packagePath, 'dist', 'index.d.ts');
        if (existsSync(distDtsPath)) return distDtsPath;

        return null;
    } catch {
        return null;
    }
}

/**
 * Check if a return type indicates an async method
 * @param {string} returnType
 * @returns {boolean}
 */
function isAsyncReturnType(returnType) {
    if (!returnType) return false;
    const trimmed = returnType.trim();
    return trimmed.startsWith('Promise<') || trimmed.startsWith('Promise <');
}

/**
 * Check if a path starts with t. or Titan.
 * @param {string} path
 * @returns {boolean}
 */
function isTitanPath(path) {
    if (!path || typeof path !== 'string') return false;
    return path.startsWith('t.') || path.startsWith('Titan.');
}

// =============================================================================
// DTS PARSING - INTERFACES
// =============================================================================

/**
 * Parse interface methods and store them
 * @param {string} interfaceName
 * @param {string} content
 */
function parseInterfaceMethods(interfaceName, content) {
    const methods = new Map();

    // Match method signatures: methodName(params): ReturnType;
    const methodRegex = /(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)\s*:\s*([^;]+)/g;
    let match;

    while ((match = methodRegex.exec(content)) !== null) {
        const methodName = match[1];
        const returnType = match[3].trim();
        const isAsync = isAsyncReturnType(returnType);

        methods.set(methodName, {
            isAsync,
            returnType,
            isMethod: true
        });
    }

    // Match property references: propertyName: TypeName;
    const propertyRegex = /^\s*(\w+)\s*:\s*([\w.]+)\s*;?\s*$/gm;

    while ((match = propertyRegex.exec(content)) !== null) {
        const propName = match[1];
        const typeName = match[2].trim();

        if (methods.has(propName)) continue;

        methods.set(propName, {
            isAsync: false,
            returnType: typeName,
            isReference: true,
            referencedType: typeName
        });
    }

    dtsCache.interfaces.set(interfaceName, methods);
    return methods;
}

/**
 * Parse namespace content for interfaces
 * @param {string} content
 * @param {string} namespaceName
 */
function parseNamespace(content, namespaceName) {
    const interfaceRegex = /interface\s+(\w+)\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
    let match;

    while ((match = interfaceRegex.exec(content)) !== null) {
        const interfaceName = match[1];
        const interfaceBody = match[2];
        const fullName = `${namespaceName}.${interfaceName}`;
        parseInterfaceMethods(fullName, interfaceBody);
    }
}

/**
 * Resolve Titan interface to method paths
 * @param {string} prefix
 * @param {Map<string, any>} methods
 */
function resolveTitanInterface(prefix, methods) {
    for (const [methodName, info] of methods.entries()) {
        const fullPath = `${prefix}.${methodName}`;

        if (info.isReference && info.referencedType) {
            resolveNestedInterface(fullPath, info.referencedType);
        } else if (info.isMethod) {
            dtsCache.methods.set(fullPath, {
                isAsync: info.isAsync,
                returnType: info.returnType
            });
        }
    }
}

/**
 * Resolve nested interface references
 * @param {string} basePath
 * @param {string} typeName
 */
function resolveNestedInterface(basePath, typeName) {
    const interfaceMethods = dtsCache.interfaces.get(typeName);

    if (interfaceMethods) {
        for (const [methodName, info] of interfaceMethods.entries()) {
            const fullPath = `${basePath}.${methodName}`;

            if (info.isReference && info.referencedType) {
                resolveNestedInterface(fullPath, info.referencedType);
            } else if (info.isMethod) {
                dtsCache.methods.set(fullPath, {
                    isAsync: info.isAsync,
                    returnType: info.returnType
                });
            }
        }
    }
}

// =============================================================================
// DTS PARSING - DECLARE GLOBAL
// =============================================================================

/**
 * Parse declare global block
 * @param {string} content
 */
function parseDeclareGlobal(content) {
    // Find const t: TypeName or const Titan: TypeName
    const constRegex = /(?:const|var)\s+(t|Titan)\s*:\s*(\w+)/g;
    let match;
    const titanTypes = [];

    while ((match = constRegex.exec(content)) !== null) {
        const varName = match[1];
        const typeName = match[2];
        titanTypes.push({ varName, typeName });
    }

    // Parse all interfaces in the global block
    const interfaceRegex = /interface\s+(\w+)\s*(?:extends\s+[\w,\s.]+)?\s*\{([^{}]*(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}[^{}]*)*)\}/g;

    while ((match = interfaceRegex.exec(content)) !== null) {
        const interfaceName = match[1];
        const interfaceBody = match[2];
        parseInterfaceMethods(interfaceName, interfaceBody);
    }

    // Parse typeof references: const myFetch: typeof t.fetch
    const typeofRegex = /(?:const|var|let)\s+(\w+)\s*:\s*typeof\s+(t|Titan)\.(\w+(?:\.\w+)*)/g;

    while ((match = typeofRegex.exec(content)) !== null) {
        const aliasName = match[1];
        const sourceVar = match[2];
        const path = match[3];
        const originalPath = `${sourceVar}.${path}`;

        dtsCache.aliases.set(aliasName, {
            originalPath,
            source: 'declare-global',
            isModule: false
        });
    }

    // Resolve Titan types
    for (const { varName, typeName } of titanTypes) {
        const interfaceMethods = dtsCache.interfaces.get(typeName);
        if (interfaceMethods) {
            resolveTitanInterface(varName, interfaceMethods);
        }
    }
}

// =============================================================================
// DTS PARSING - NAMESPACES
// =============================================================================

/**
 * Parse traditional declare namespace t { ... }
 * @param {string} content
 * @param {string} prefix
 */
function parseNamespaceContent(content, prefix) {
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

    const syncMethodRegex = /(?:function\s+)?(\w+)\s*(?:<[^>]*>)?\s*\([^)]*\)\s*:\s*(?!Promise\s*<)(\w+(?:<[^;]+>)?)/g;

    while ((match = syncMethodRegex.exec(content)) !== null) {
        const methodName = match[1];
        const returnType = match[2].trim();
        const fullPath = `${prefix}.${methodName}`;

        if (!dtsCache.methods.has(fullPath)) {
            dtsCache.methods.set(fullPath, {
                isAsync: false,
                returnType
            });
        }
    }

    const nestedNamespaceRegex = /namespace\s+(\w+)\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;

    while ((match = nestedNamespaceRegex.exec(content)) !== null) {
        const nestedName = match[1];
        const nestedContent = match[2];
        const nestedPrefix = `${prefix}.${nestedName}`;
        parseNamespaceContent(nestedContent, nestedPrefix);
    }
}

// =============================================================================
// DTS FILE PARSING
// =============================================================================

/**
 * Parse a .d.ts file and extract Titan async methods
 * @param {string} filePath
 */
function parseDtsFile(filePath) {
    try {
        const content = readFileSync(filePath, 'utf-8');

        // 1. Parse namespaces first (like TitanCore)
        const namespaceRegex = /namespace\s+(\w+)\s*\{([^{}]*(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}[^{}]*)*)\}/g;
        let match;

        while ((match = namespaceRegex.exec(content)) !== null) {
            const namespaceName = match[1];
            const namespaceContent = match[2];

            if (namespaceName === 't' || namespaceName === 'Titan') {
                parseNamespaceContent(namespaceContent, namespaceName);
            } else {
                parseNamespace(namespaceContent, namespaceName);
            }
        }

        // 2. Parse declare global
        const declareGlobalRegex = /declare\s+global\s*\{([^{}]*(?:\{[^{}]*(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}[^{}]*)*\}[^{}]*)*)\}/g;

        while ((match = declareGlobalRegex.exec(content)) !== null) {
            const globalContent = match[1];
            parseDeclareGlobal(globalContent);
        }

        // 3. Parse traditional declare namespace t/Titan
        const titanNamespaceRegex = /declare\s+namespace\s+(t|Titan)\s*\{([^{}]*(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}[^{}]*)*)\}/g;

        while ((match = titanNamespaceRegex.exec(content)) !== null) {
            const namespaceName = match[1];
            const namespaceContent = match[2];
            parseNamespaceContent(namespaceContent, namespaceName);
        }

    } catch {
        // Ignore files that can't be read/parsed
    }
}

// =============================================================================
// SOURCE FILE PARSING - ALL ALIAS PATTERNS
// =============================================================================

/**
 * Parse ALL alias patterns from source files
 * @param {string} content
 */
function parseSourceFileAliases(content) {
    // Skip if no reference to Titan globals
    if (
        !content.includes('t.') &&
        !content.includes('Titan.') &&
        !content.includes('= t') &&
        !content.includes('=t')
    ) {
        return;
    }

    let match;

    // =========================================================================
    // 1. DESTRUCTURING: const { fetch } = t
    //                   const { fetch: myFetch } = t
    //                   const { readFile } = t.core.fs
    // =========================================================================

    // Pattern: const { props } = t or Titan
    const destructuringRegex = /(?:const|let|var)\s*\{([^}]+)\}\s*=\s*(t|Titan)(?:\.(\w+(?:\.\w+)*))?\s*[;\n]/g;

    while ((match = destructuringRegex.exec(content)) !== null) {
        const props = match[1];
        const sourceVar = match[2]; // t or Titan
        const path = match[3] || ''; // optional path like 'core.fs'
        const prefix = path ? `${sourceVar}.${path}` : sourceVar;

        // Parse each property
        const propList = props.split(',');
        for (const prop of propList) {
            const trimmed = prop.trim();
            if (!trimmed) continue;

            // Check for rename: original: alias
            const renameMatch = trimmed.match(/^(\w+)\s*:\s*(\w+)$/);
            if (renameMatch) {
                const originalName = renameMatch[1];
                const aliasName = renameMatch[2];
                const originalPath = `${prefix}.${originalName}`;

                // Check if it's a module (has sub-methods) or a method
                const isModule = hasSubMethods(originalPath);

                dtsCache.aliases.set(aliasName, {
                    originalPath,
                    source: 'destructuring',
                    isModule
                });
            } else {
                // Simple property: const { fetch } = t
                const simpleMatch = trimmed.match(/^(\w+)$/);
                if (simpleMatch) {
                    const propName = simpleMatch[1];
                    const originalPath = `${prefix}.${propName}`;
                    const isModule = hasSubMethods(originalPath);

                    dtsCache.aliases.set(propName, {
                        originalPath,
                        source: 'destructuring',
                        isModule
                    });
                }
            }
        }
    }

    // =========================================================================
    // 2. SIMPLE ASSIGNMENT: const myFetch = t.fetch
    //                       const db = t.db
    // =========================================================================

    const simpleAssignmentRegex = /(?:const|let|var)\s+(\w+)\s*=\s*(t|Titan)\.(\w+(?:\.\w+)*)\s*[;\n]/g;

    while ((match = simpleAssignmentRegex.exec(content)) !== null) {
        const aliasName = match[1];
        const sourceVar = match[2];
        const path = match[3];
        const originalPath = `${sourceVar}.${path}`;
        const isModule = hasSubMethods(originalPath);

        dtsCache.aliases.set(aliasName, {
            originalPath,
            source: 'assignment',
            isModule
        });
    }

    // =========================================================================
    // 3. EXPORT ASSIGNMENT: export const myFetch = t.fetch
    //                       export const db = t.db
    // =========================================================================

    const exportAssignmentRegex = /export\s+(?:const|let|var)\s+(\w+)\s*=\s*(t|Titan)\.(\w+(?:\.\w+)*)\s*[;\n]/g;

    while ((match = exportAssignmentRegex.exec(content)) !== null) {
        const aliasName = match[1];
        const sourceVar = match[2];
        const path = match[3];
        const originalPath = `${sourceVar}.${path}`;
        const isModule = hasSubMethods(originalPath);

        dtsCache.aliases.set(aliasName, {
            originalPath,
            source: 'export',
            isModule
        });
    }

    // =========================================================================
    // 4. EXPORT OBJECT: export const db = { query: t.db.query }
    //    OBJECT INLINE: const utils = { fetch: t.fetch }
    // =========================================================================

    // This regex captures object literals assigned to variables
    const objectAssignmentRegex = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*\{([^{}]+)\}\s*[;\n]/g;

    while ((match = objectAssignmentRegex.exec(content)) !== null) {
        const objectName = match[1];
        const objectContent = match[2];

        // Find properties that reference t.* or Titan.*
        const propRegex = /(\w+)\s*:\s*(t|Titan)\.(\w+(?:\.\w+)*)/g;
        let propMatch;

        while ((propMatch = propRegex.exec(objectContent)) !== null) {
            const propName = propMatch[1];
            const sourceVar = propMatch[2];
            const path = propMatch[3];
            const originalPath = `${sourceVar}.${path}`;

            // Register as: objectName.propName -> originalPath
            const aliasPath = `${objectName}.${propName}`;

            dtsCache.aliases.set(aliasPath, {
                originalPath,
                source: 'object-property',
                isModule: false
            });
        }
    }

    // =========================================================================
    // 5. EXPORT DESTRUCTURING: export { fetch } where fetch was assigned earlier
    //    This is handled by the above patterns since the variable needs to be
    //    declared first
    // =========================================================================
}

/**
 * Check if a path has sub-methods (is a module, not a direct method)
 * @param {string} path
 * @returns {boolean}
 */
function hasSubMethods(path) {
    // Check if any method starts with this path + '.'
    for (const methodPath of dtsCache.methods.keys()) {
        if (methodPath.startsWith(path + '.')) {
            return true;
        }
    }
    return false;
}

/**
 * Parse a source file for aliases
 * @param {string} filePath
 */
function parseSourceFile(filePath) {
    try {
        const content = readFileSync(filePath, 'utf-8');
        parseSourceFileAliases(content);
    } catch {
        // Ignore files that can't be read
    }
}

// =============================================================================
// DIRECTORY SCANNING
// =============================================================================

function scanDirectory(dirPath, depth = 0, maxDepth = 10) {
    // Two-pass scan: first .d.ts files (type definitions), then source files (aliases).
    // This ensures that hasSubMethods() has all method definitions available
    // when evaluating module alias isModule flags in source files.
    scanDirectoryPass(dirPath, 'dts', depth, maxDepth);
    scanDirectoryPass(dirPath, 'source', depth, maxDepth);
}

/**
 * Single-pass directory scan for a specific file type
 * @param {string} dirPath
 * @param {'dts' | 'source'} pass - Which file types to process
 * @param {number} depth
 * @param {number} maxDepth
 */
function scanDirectoryPass(dirPath, pass, depth = 0, maxDepth = 10) {
    if (depth > maxDepth) return;

    try {
        const entries = readdirSync(dirPath);

        for (const entry of entries) {
            if (entry.startsWith('.') || SKIP_DIRECTORIES.has(entry)) {
                continue;
            }

            const entryPath = join(dirPath, entry);

            try {
                const stat = statSync(entryPath);

                if (stat.isDirectory()) {
                    scanDirectoryPass(entryPath, pass, depth + 1, maxDepth);
                } else if (stat.isFile()) {
                    const ext = extname(entry);

                    if (pass === 'dts' && ext === '.ts' && entry.endsWith('.d.ts')) {
                        parseDtsFile(entryPath);
                    } else if (pass === 'source' && (ext === '.js' || (ext === '.ts' && !entry.endsWith('.d.ts')) || ext === '.mjs')) {
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
 * Process a single package
 * @param {string} packagePath
 */
function processPackage(packagePath) {
    const dtsPath = getPackageDtsPath(packagePath);
    if (dtsPath) {
        parseDtsFile(dtsPath);
    }
}

/**
 * Scan node_modules
 * @param {string} nodeModulesPath
 */
function scanNodeModules(nodeModulesPath) {
    if (!existsSync(nodeModulesPath)) return;

    try {
        const entries = readdirSync(nodeModulesPath);

        for (const entry of entries) {
            if (entry.startsWith('.') || entry === '.bin') continue;

            const entryPath = join(nodeModulesPath, entry);

            try {
                const stat = statSync(entryPath);
                if (!stat.isDirectory()) continue;

                if (entry.startsWith('@')) {
                    const scopedEntries = readdirSync(entryPath);
                    for (const scopedEntry of scopedEntries) {
                        const scopedPackagePath = join(entryPath, scopedEntry);
                        try {
                            const scopedStat = statSync(scopedPackagePath);
                            if (scopedStat.isDirectory()) {
                                processPackage(scopedPackagePath);
                            }
                        } catch { continue; }
                    }
                } else {
                    processPackage(entryPath);
                }
            } catch { continue; }
        }
    } catch {
        // Can't read node_modules
    }
}

// =============================================================================
// CACHE INITIALIZATION
// =============================================================================

/**
 * Initialize the cache
 * @param {string} projectRoot
 */
function initializeCache(projectRoot) {
    if (dtsCache.initialized && dtsCache.projectRoot === projectRoot) {
        return;
    }

    dtsCache.methods.clear();
    dtsCache.aliases.clear();
    dtsCache.interfaces.clear();
    dtsCache.projectRoot = projectRoot;

    // 1. Scan node_modules first (to get base definitions)
    const nodeModulesPath = join(projectRoot, 'node_modules');
    scanNodeModules(nodeModulesPath);

    // 2. Scan project for .d.ts files (to get local definitions)
    scanDirectory(projectRoot);

    // 3. Scan project again for source files (to get aliases)
    // Note: This is done in the same scanDirectory call above

    dtsCache.initialized = true;
}

// =============================================================================
// ALIAS RESOLUTION
// =============================================================================

/**
 * Resolve a method path that might be an alias
 * 
 * Handles:
 * - Direct paths: t.fetch -> t.fetch
 * - Simple aliases: myFetch -> t.fetch
 * - Module aliases: db.query -> t.db.query (where db = t.db)
 * - Object property aliases: utils.fetch -> t.fetch
 * 
 * @param {string} path
 * @returns {{ resolvedPath: string, methodInfo: MethodInfo | undefined }}
 */
function resolveMethodPath(path) {
    // 1. Check if it's a direct method path
    if (dtsCache.methods.has(path)) {
        return {
            resolvedPath: path,
            methodInfo: dtsCache.methods.get(path)
        };
    }

    // 2. Check if it's a direct alias (myFetch -> t.fetch)
    const directAlias = dtsCache.aliases.get(path);
    if (directAlias) {
        const methodInfo = dtsCache.methods.get(directAlias.originalPath);
        return {
            resolvedPath: directAlias.originalPath,
            methodInfo
        };
    }

    // 3. Check if it's a module alias path (db.query where db = t.db)
    //    Split the path and check if the first part is a module alias
    const parts = path.split('.');
    if (parts.length >= 2) {
        const firstPart = parts[0];
        const alias = dtsCache.aliases.get(firstPart);

        if (alias && alias.isModule) {
            // Reconstruct the full path
            const remainingPath = parts.slice(1).join('.');
            const fullPath = `${alias.originalPath}.${remainingPath}`;
            const methodInfo = dtsCache.methods.get(fullPath);

            return {
                resolvedPath: fullPath,
                methodInfo
            };
        }

        // 4. Check for object property aliases (utils.fetch -> t.fetch)
        const objectPropAlias = dtsCache.aliases.get(path);
        if (objectPropAlias) {
            const methodInfo = dtsCache.methods.get(objectPropAlias.originalPath);
            return {
                resolvedPath: objectPropAlias.originalPath,
                methodInfo
            };
        }
    }

    // 5. Not found
    return {
        resolvedPath: path,
        methodInfo: undefined
    };
}

/**
 * Parse aliases from the current file being linted (via ESLint context).
 * This handles inline aliases that the disk scanner might miss.
 * @param {Object} context - ESLint rule context
 */
function parseCurrentFileSource(context) {
    const filename = context.getFilename?.() || context.filename || '';
    if (dtsCache._lastParsedFile === filename) return;

    try {
        const sourceCode = context.sourceCode
            || (typeof context.getSourceCode === 'function' ? context.getSourceCode() : null);
        if (!sourceCode) return;

        const text = typeof sourceCode.getText === 'function' ? sourceCode.getText() : '';
        if (!text) return;

        parseSourceFileAliases(text);
        dtsCache._lastParsedFile = filename;
    } catch {
        // Ignore errors
    }
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Check if a method is async using .d.ts file definitions
 * 
 * @param {string} methodPath - Full method path or alias
 * @param {Object} context - ESLint rule context
 * @returns {DetectionResult}
 */
export function checkWithDtsFile(methodPath, context) {
    try {
        const filename = context.getFilename?.() || context.filename || '';
        const projectRoot = findProjectRoot(dirname(filename));

        if (!projectRoot) {
            return NULL_RESULT;
        }

        initializeCache(projectRoot);

        const { methodInfo } = resolveMethodPath(methodPath);

        if (methodInfo !== undefined) {
            return {
                isAsync: methodInfo.isAsync,
                source: 'dts-file',
                returnType: methodInfo.returnType
            };
        }

        return NULL_RESULT;

    } catch {
        return NULL_RESULT;
    }
}

/**
 * Check if a name is a known Titan alias
 * 
 * @param {string} name - Variable name to check
 * @param {Object} context - ESLint rule context
 * @returns {{ isAlias: boolean, originalPath: string | null, source: string | null, isModule: boolean }}
 */
export function checkForAlias(name, context) {
    try {
        const filename = context.getFilename?.() || context.filename || '';
        const projectRoot = findProjectRoot(dirname(filename));

        if (!projectRoot) {
            return { isAlias: false, originalPath: null, source: null, isModule: false };
        }

        initializeCache(projectRoot);
        parseCurrentFileSource(context)

        // 1. Direct alias lookup (myFetch -> t.fetch)
        const alias = dtsCache.aliases.get(name);
        if (alias) {
            return {
                isAlias: true,
                originalPath: alias.originalPath,
                source: alias.source,
                isModule: alias.isModule || false
            };
        }

        // 2. Module alias path resolution (db.query where db = t.db)
        const parts = name.split('.');
        if (parts.length >= 2) {
            const firstPart = parts[0];
            const moduleAlias = dtsCache.aliases.get(firstPart);
            if (moduleAlias && moduleAlias.isModule) {
                const remainingPath = parts.slice(1).join('.');
                const fullPath = `${moduleAlias.originalPath}.${remainingPath}`;
                return {
                    isAlias: true,
                    originalPath: fullPath,
                    source: moduleAlias.source,
                    isModule: true
                };
            }
        }

        return { isAlias: false, originalPath: null, source: null, isModule: false };

    } catch {
        return { isAlias: false, originalPath: null, source: null, isModule: false };
    }
}

/**
 * Resolve a method path (including module aliases)
 * 
 * Examples:
 * - t.fetch -> t.fetch
 * - myFetch -> t.fetch (if const myFetch = t.fetch)
 * - db.query -> t.db.query (if const db = t.db)
 * 
 * @param {string} methodPath
 * @param {Object} context
 * @returns {{ resolvedPath: string, wasAlias: boolean, isModule: boolean }}
 */
export function resolveAlias(methodPath, context) {
    try {
        const filename = context.getFilename?.() || context.filename || '';
        const projectRoot = findProjectRoot(dirname(filename));

        if (!projectRoot) {
            return { resolvedPath: methodPath, wasAlias: false, isModule: false };
        }

        initializeCache(projectRoot);
        parseCurrentFileSource(context);

        // Direct Titan path
        if (isTitanPath(methodPath)) {
            return { resolvedPath: methodPath, wasAlias: false, isModule: false };
        }

        const { resolvedPath, methodInfo } = resolveMethodPath(methodPath);

        if (resolvedPath !== methodPath && isTitanPath(resolvedPath)) {
            return {
                resolvedPath,
                wasAlias: true,
                isModule: methodInfo === undefined && hasSubMethods(resolvedPath)
            };
        }

        return { resolvedPath: methodPath, wasAlias: false, isModule: false };

    } catch {
        return { resolvedPath: methodPath, wasAlias: false, isModule: false };
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
 * Clear the DTS cache
 */
export function clearDtsCache() {
    dtsCache.methods.clear();
    dtsCache.aliases.clear();
    dtsCache.interfaces.clear();
    dtsCache.initialized = false;
    dtsCache.projectRoot = null;
    dtsCache._lastParsedFile = null;
}

/**
 * Get cache statistics
 * @returns {{ methodsSize: number, aliasesSize: number, interfacesSize: number, projectRoot: string | null }}
 */
export function getDtsCacheStats() {
    return {
        methodsSize: dtsCache.methods.size,
        aliasesSize: dtsCache.aliases.size,
        interfacesSize: dtsCache.interfaces.size,
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