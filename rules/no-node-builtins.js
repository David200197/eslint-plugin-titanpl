import { TITAN_ALTERNATIVES } from "../constants/titan-alternatives.js";

export const noNodeBuiltins = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Disallow Node.js built-in modules in TitanPL and suggest Titan alternatives',
            recommended: true
        },
        schema: [],
        messages: {
            notAvailable: '"{{name}}" is not available in TitanPL. {{suggestion}}',
            notAvailableNoAlt: '"{{name}}" is not available in TitanPL and has no direct alternative in Titan.'
        }
    },
    create(context) {
        const NODE_MODULES = new Set([
            'assert', 'async_hooks', 'buffer', 'child_process', 'cluster',
            'crypto', 'dgram', 'dns', 'events', 'fs', 'http', 'https',
            'module', 'net', 'os', 'path', 'perf_hooks', 'process', 'punycode',
            'querystring', 'readline', 'stream', 'string_decoder', 'timers',
            'tls', 'tty', 'url', 'util', 'v8', 'vm', 'worker_threads', 'zlib'
        ]);

        function getSuggestion(moduleName) {
            const titanAlt = TITAN_ALTERNATIVES[moduleName];

            if (!titanAlt) {
                return null;
            }

            if (typeof titanAlt === 'object' && titanAlt.alternative) {
                return `Use ${titanAlt.alternative} instead. ${titanAlt.description}.`;
            }

            if (typeof titanAlt === 'object' && titanAlt.description) {
                return titanAlt.description;
            }

            return null;
        }

        function checkSource(node, source) {
            const moduleName = source.replace(/^node:/, '');

            if (source.startsWith('node:') || NODE_MODULES.has(moduleName)) {
                const suggestion = getSuggestion(moduleName);

                if (suggestion) {
                    context.report({
                        node,
                        messageId: 'notAvailable',
                        data: {
                            name: source,
                            suggestion
                        }
                    });
                } else {
                    context.report({
                        node,
                        messageId: 'notAvailableNoAlt',
                        data: { name: source }
                    });
                }
            }
        }

        return {
            // import x from 'fs'
            ImportDeclaration(node) {
                checkSource(node.source, node.source.value);
            },
            // export { x } from 'fs'
            ExportNamedDeclaration(node) {
                if (node.source) {
                    checkSource(node.source, node.source.value);
                }
            },
            // export * from 'fs'
            ExportAllDeclaration(node) {
                checkSource(node.source, node.source.value);
            },
            // import('fs')
            ImportExpression(node) {
                if (node.source.type === 'Literal') {
                    checkSource(node.source, node.source.value);
                }
            }
        };
    }
};