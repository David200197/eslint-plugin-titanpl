/**
 * Test Project Setup
 * 
 * Creates a temporary project with real .d.ts files, source files with aliases,
 * and node_modules packages to test the dts-file-checker end-to-end.
 * 
 * Covers ALL detection variants:
 * 
 * .d.ts files:
 *   1. declare namespace t { ... }           — core methods (async + sync)
 *   2. declare namespace Titan { ... }       — alternative namespace
 *   3. declare global { const x: typeof t.y }— typeof aliases
 *   4. declare global { interface + const t } — interface-based type resolution
 *   5. Third-party packages in node_modules  — via "types" field, "typings", index.d.ts
 * 
 * Source files (.js / .ts):
 *   6. Destructuring: const { fetch } = t
 *   7. Destructuring rename: const { join: pathJoin } = t.core.path
 *   8. Simple assignment: const myFetch = t.fetch
 *   9. Module assignment: const db = t.db (then db.query → t.db.query)
 *  10. Export assignment: export const myFetch = t.fetch
 *  11. Object inline: const utils = { fetch: t.fetch }
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Create the full temp project and return paths + cleanup function
 * @returns {{ root: string, testFile: string, cleanup: () => void }}
 */
export function createTestProject() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eslint-titanpl-test-'));

    // =========================================================================
    // Directory structure
    // =========================================================================
    const dirs = [
        'app',
        'types',
        'src/helpers',
        'node_modules/titan-websocket',
        'node_modules/titan-database/types',
        'node_modules/titan-auth',
        'node_modules/@scope/titan-cache',
    ];
    for (const d of dirs) {
        fs.mkdirSync(path.join(root, d), { recursive: true });
    }

    // Dummy test file (used as filename for ESLint context)
    const testFile = path.join(root, 'app', 'test.js');
    fs.writeFileSync(testFile, '');

    // =========================================================================
    // Root package.json
    // =========================================================================
    write(root, 'package.json', JSON.stringify({
        name: 'test-titan-project',
        version: '1.0.0',
        type: 'module'
    }));

    // =========================================================================
    // VARIANT 1: declare namespace t — Core async + sync methods
    // =========================================================================
    write(root, 'types/titan-core.d.ts', `
declare namespace t {
    function fetch(url: string, options?: any): Promise<Response>;
    function log(msg: string): void;

    namespace core {
        namespace fs {
            function readFile(path: string): Promise<string>;
            function writeFile(path: string, content: string): Promise<void>;
            function remove(path: string): Promise<void>;
            function mkdir(path: string): Promise<void>;
            function readdir(path: string): Promise<string[]>;
            function stat(path: string): Promise<any>;
            function exists(path: string): Promise<boolean>;
        }
        namespace path {
            function join(...paths: string[]): string;
            function resolve(...paths: string[]): string;
            function dirname(p: string): string;
            function basename(p: string): string;
            function extname(p: string): string;
        }
        namespace crypto {
            function hash(data: string): Promise<string>;
            function encrypt(data: string, key: string): Promise<string>;
            function decrypt(data: string, key: string): Promise<string>;
            function hashKeyed(data: string, key: string): Promise<string>;
            function uuid(): string;
            function randomBytes(size: number): string;
            function compare(a: string, b: string): boolean;
        }
        namespace url {
            function parse(url: string): any;
            function format(obj: any): string;
        }
        namespace os {
            function platform(): string;
            function cpus(): number;
            function totalMemory(): number;
            function freeMemory(): number;
            function tmpdir(): string;
        }
        namespace net {
            function resolveDNS(hostname: string): Promise<string>;
            function ip(): string;
        }
        namespace time {
            function sleep(ms: number): Promise<void>;
            function now(): number;
            function timestamp(): string;
        }
        namespace buffer {
            function fromBase64(data: string): any;
            function toBase64(data: any): string;
            function fromHex(data: string): any;
            function toHex(data: any): string;
            function fromUtf8(data: string): any;
            function toUtf8(data: any): string;
        }
        namespace proc {
            function pid(): number;
            function uptime(): number;
        }
        namespace ls {
            function get(key: string): string;
            function set(key: string, value: string): void;
            function remove(key: string): void;
            function clear(): void;
            function keys(): string[];
        }
        namespace cookies {
            function get(name: string): string;
            function set(name: string, value: string): void;
        }
        namespace session {
            function get(key: string): Promise<string>;
            function set(key: string, value: string): Promise<void>;
        }
    }
}
`);

    // =========================================================================
    // VARIANT 2: declare namespace Titan — Alternative namespace
    // =========================================================================
    write(root, 'types/titan-alt.d.ts', `
declare namespace Titan {
    function fetch(url: string, options?: any): Promise<Response>;

    namespace core {
        namespace fs {
            function readFile(path: string): Promise<string>;
        }
        namespace path {
            function join(...paths: string[]): string;
        }
        namespace crypto {
            function hash(data: string): Promise<string>;
        }
    }
}
`);

    // =========================================================================
    // VARIANT 3: declare global — typeof aliases
    // =========================================================================
    write(root, 'types/titan-globals.d.ts', `
declare global {
    const globalFetch: typeof t.fetch;
    const globalReadFile: typeof t.core.fs.readFile;
    const globalPathJoin: typeof t.core.path.join;
    const globalDbQuery: typeof t.db.query;
    const globalLog: typeof t.log;
    const globalWsConnect: typeof t.ws.connect;
    const globalSleep: typeof t.core.time.sleep;
    const globalNow: typeof t.core.time.now;
}
`);

    // =========================================================================
    // VARIANT 4: declare global — interface-based type resolution
    // Declares const t: TitanRuntime with an interface tree
    // =========================================================================
    write(root, 'types/titan-interface.d.ts', `
interface TitanMail {
    send(to: string, body: string): Promise<void>;
    isConfigured(): boolean;
}

declare global {
    namespace t {
        const mail: TitanMail;
    }
}
`);

    // =========================================================================
    // VARIANT 5a: node_modules — titan-websocket (index.d.ts fallback)
    // =========================================================================
    write(root, 'node_modules/titan-websocket/package.json', JSON.stringify({
        name: 'titan-websocket',
        version: '1.0.0',
    }));
    write(root, 'node_modules/titan-websocket/index.d.ts', `
declare namespace t {
    namespace ws {
        function connect(url: string): Promise<WebSocket>;
        function send(data: string): Promise<void>;
        function close(): Promise<void>;
        function isConnected(): boolean;
    }
}
`);

    // =========================================================================
    // VARIANT 5b: node_modules — titan-database ("types" field in pkg)
    // =========================================================================
    write(root, 'node_modules/titan-database/package.json', JSON.stringify({
        name: 'titan-database',
        version: '1.0.0',
        types: './types/index.d.ts'
    }));
    write(root, 'node_modules/titan-database/types/index.d.ts', `
declare namespace t {
    namespace db {
        function query(sql: string): Promise<any[]>;
        function execute(sql: string): Promise<any>;
        function transaction(fn: Function): Promise<any>;
        function isConnected(): boolean;
    }
}
`);

    // =========================================================================
    // VARIANT 5c: node_modules — titan-auth (index.d.ts fallback)
    // =========================================================================
    write(root, 'node_modules/titan-auth/package.json', JSON.stringify({
        name: 'titan-auth',
        version: '1.0.0',
    }));
    write(root, 'node_modules/titan-auth/index.d.ts', `
declare namespace t {
    namespace auth {
        function login(user: string, pass: string): Promise<string>;
        function verify(token: string): Promise<boolean>;
        function currentUser(): string;
    }
}
`);

    // =========================================================================
    // VARIANT 5d: node_modules — scoped package @scope/titan-cache
    // =========================================================================
    write(root, 'node_modules/@scope/titan-cache/package.json', JSON.stringify({
        name: '@scope/titan-cache',
        version: '1.0.0',
    }));
    write(root, 'node_modules/@scope/titan-cache/index.d.ts', `
declare namespace t {
    namespace cache {
        function get(key: string): Promise<string>;
        function set(key: string, val: string, ttl?: number): Promise<void>;
        function del(key: string): Promise<boolean>;
        function has(key: string): boolean;
    }
}
`);

    // =========================================================================
    // VARIANT 6 + 7: Source file — destructuring aliases
    // =========================================================================
    write(root, 'src/helpers/destructured.js', `
// Simple destructuring
const { fetch } = t;
const { readFile, writeFile } = t.core.fs;
const { sleep } = t.core.time;
const { log } = t;

// Destructuring with rename
const { join: pathJoin } = t.core.path;
const { connect: wsConnect } = t.ws;
const { query: dbQuery } = t.db;
const { now } = t.core.time;
const { uuid } = t.core.crypto;
`);

    // =========================================================================
    // VARIANT 8 + 9: Source file — simple + module assignments
    // =========================================================================
    write(root, 'src/helpers/assignments.js', `
// Simple assignment (method)
const myFetch = t.fetch;
const myHash = t.core.crypto.hash;

// Module assignment (namespace)
const db = t.db;
const fs = t.core.fs;
const myPath = t.core.path;
`);

    // =========================================================================
    // VARIANT 10: Source file — export assignments
    // =========================================================================
    write(root, 'src/helpers/exports.js', `
export const exportedFetch = t.fetch;
export const exportedReadFile = t.core.fs.readFile;
export const exportedPathJoin = t.core.path.join;
export const exportedDbQuery = t.db.query;
export const exportedLog = t.log;
export const exportedSleep = t.core.time.sleep;
`);

    // =========================================================================
    // VARIANT 11: Source file — object inline
    // =========================================================================
    write(root, 'src/helpers/object-aliases.js', `
const titanUtils = { fetch: t.fetch, read: t.core.fs.readFile, join: t.core.path.join };
export const dbHelpers = { query: t.db.query, exec: t.db.execute };
`);

    return {
        root,
        testFile,
        cleanup() {
            fs.rmSync(root, { recursive: true, force: true });
        }
    };
}

// =========================================================================
// Helpers
// =========================================================================

function write(root, relativePath, content) {
    fs.writeFileSync(path.join(root, relativePath), content, 'utf-8');
}