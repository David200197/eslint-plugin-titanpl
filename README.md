# eslint-plugin-titanpl

ESLint plugin for [Titan Planet](https://titan-docs-ez.vercel.app/docs) projects. Enforces TitanPL-specific rules including blocking Node.js built-in modules, prohibiting async/await, and ensuring correct `drift()` usage.

## Installation

```bash
npm install eslint-plugin-titanpl --save-dev
```

## Usage

### Flat Config (ESLint 9+)

```javascript
// eslint.config.js
import { titanpl } from 'eslint-plugin-titanpl';

export default [
  titanpl,
  // ...other configs
];
```

### Custom Configuration

```javascript
// eslint.config.js
import plugin from 'eslint-plugin-titanpl';
import globals from 'globals';

export default [
  {
    files: ['app/**/*.js'],
    plugins: {
      titanpl: plugin
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.es2024,
        t: 'readonly',
        Titan: 'readonly',
        drift: 'readonly'
      }
    },
    rules: {
      'no-undef': 'error',
      'titanpl/no-node-builtins': 'error',
      'titanpl/no-async-await': 'error',
      'titanpl/drift-only-titan-async': 'error',
      'titanpl/require-drift': 'error'
    }
  }
];
```

---

## Rules

### `titanpl/no-node-builtins`

Disallows importing Node.js built-in modules that are not available in the TitanPL runtime.

#### ❌ Incorrect

```javascript
import fs from 'fs';
import { readFile } from 'node:fs';
import path from 'path';
```

#### ✅ Correct

```javascript
const content = drift(t.core.fs.readFile('config.json'));
const fullPath = t.core.path.join('dir', 'file.txt');
```

---

### `titanpl/no-async-await`

Disallows the use of `async`, `await`, `.then()`, `.catch()`, and `.finally()` in TitanPL. TitanPL uses `drift()` for async operations instead.

#### ❌ Incorrect

```javascript
async function fetchData() {
  const data = await fetch('/api');
  return data;
}

promise.then(callback).catch(errorHandler);
```

#### ✅ Correct

```javascript
function fetchData() {
  const data = drift(t.fetch('/api'));
  return data;
}
```

---

### `titanpl/drift-only-titan-async`

Ensures `drift()` is only used with **async** TitanPL native methods.

1. The argument must be a function call (not a reference or literal)
2. The method must be from `t` or `Titan` (including all alias types)
3. The method must be asynchronous (detected automatically from `.d.ts` files)

#### ❌ Incorrect

```javascript
// Non-Titan methods
drift(myFunction());
drift(console.log('test'));
drift(Math.random());

// Sync Titan methods (don't need drift)
drift(t.core.path.join('a', 'b'));
drift(t.core.url.parse('http://...'));
drift(t.core.crypto.uuid());
drift(t.core.os.platform());

// Sync aliases (don't need drift)
const { join } = t.core.path;
drift(join('a', 'b'));

// Sync module alias sub-methods (don't need drift)
const myPath = t.core.path;
drift(myPath.join('a', 'b'));

const db = t.db;
drift(db.isConnected());

// Method references without calling them
drift(t.fetch);              // Missing ()
drift(readFile);             // Missing ()
drift(db.query);             // Missing ()

// Literals and expressions
drift('string');
drift(123);
drift(() => {});
drift();                     // No argument
```

#### ✅ Correct

```javascript
// Direct async Titan methods
drift(t.fetch('/api'));
drift(t.core.fs.readFile('/file'));
drift(t.core.crypto.hash('data'));
drift(t.core.time.sleep(1000));

// Titan namespace
drift(Titan.fetch('/api'));
drift(Titan.core.fs.readFile('/file'));

// Destructured aliases
const { fetch } = t;
drift(fetch('/api'));

const { readFile } = t.core.fs;
drift(readFile('/file'));

// Declare global aliases
// declare global { const globalFetch: typeof t.fetch }
drift(globalFetch('/api'));

// Exported aliases
// export const exportedFetch = t.fetch;
drift(exportedFetch('/api'));

// Simple assignment aliases
const myFetch = t.fetch;
drift(myFetch('/api'));

// Module assignment aliases
const db = t.db;
drift(db.query('SELECT 1'));

const fs = t.core.fs;
drift(fs.readFile('/file'));

// Object property aliases
const utils = { fetch: t.fetch, read: t.core.fs.readFile };
drift(utils.fetch('/api'));
drift(utils.read('/file'));

// Third-party async methods
drift(t.ws.connect('wss://example.com'));
drift(t.cache.get('key'));
```

---

### `titanpl/require-drift`

Requires `drift()` wrapper for async TitanPL native methods. Complements `drift-only-titan-async` by catching unwrapped async calls.

#### ❌ Incorrect

```javascript
// Direct async without drift
t.fetch('/api/data');
t.core.fs.readFile('/file');
t.core.crypto.hash('data');

// Destructured aliases without drift
const { fetch } = t;
fetch('/api/data');

const { readFile } = t.core.fs;
readFile('/file');

// Simple assignment aliases without drift
const myFetch = t.fetch;
myFetch('/api');

// Module assignment aliases without drift
const db = t.db;
db.query('SELECT 1');

const fs = t.core.fs;
fs.readFile('/file');

// Object property aliases without drift
const helpers = { query: t.db.query };
helpers.query('SELECT 1');

// Third-party async without drift
t.ws.connect('wss://example.com');
t.cache.get('key');
```

#### ✅ Correct

```javascript
// Async methods with drift
drift(t.fetch('/api/data'));
drift(t.core.fs.readFile('/file'));
drift(t.core.crypto.hash('data'));

// Sync methods don't need drift
t.core.path.join('a', 'b');
t.core.crypto.uuid();
t.log('hello');

// All alias types with drift
const { fetch } = t;
drift(fetch('/api/data'));

const myFetch = t.fetch;
drift(myFetch('/api'));

const db = t.db;
drift(db.query('SELECT 1'));

const helpers = { query: t.db.query };
drift(helpers.query('SELECT 1'));

// Sync aliases don't need drift
const { join } = t.core.path;
join('a', 'b');

const myPath = t.core.path;
myPath.join('a', 'b');

const db = t.db;
db.isConnected();
```

---

## Async Method Detection

The plugin **automatically detects** whether a Titan method is async or sync by reading `.d.ts` files and scanning your project. **No configuration required.**

```
1. DTS File Reader     →  Scans node_modules for .d.ts files
                          Scans project recursively for .d.ts files
                          Finds "declare namespace t" or "declare namespace Titan"
                          Extracts methods that return Promise<T>
         ↓
2. Alias Detection     →  Detects 6 alias patterns:
                            • Destructuring:      const { fetch } = t
                            • Declare global:     declare global { const fetch: typeof t.fetch }
                            • Exports:            export const fetch = t.fetch
                            • Simple assignment:  const myFetch = t.fetch
                            • Module assignment:  const db = t.db  →  db.query()
                            • Object property:    const u = { fetch: t.fetch }  →  u.fetch()
         ↓ fallback
3. Permissive Fallback →  Unknown methods are treated as sync
```

### How It Works

When you run ESLint, the plugin automatically:

1. Scans `node_modules/` for packages with `.d.ts` files
2. Scans your project recursively for `.d.ts` and source files (two-pass: type definitions first, then source files)
3. Looks for `declare namespace t` or `declare namespace Titan` declarations
4. Extracts methods and checks if they return `Promise<...>`
5. Detects aliases from all 6 supported patterns
6. Caches the results for performance

### Example

```typescript
// node_modules/titan-websocket/index.d.ts
declare namespace t {
  namespace ws {
    function connect(url: string): Promise<WebSocket>;  // Detected as async
    function isConnected(): boolean;                     // Detected as sync
  }
}
```

The plugin will automatically detect `t.ws.connect` as async and `t.ws.isConnected` as sync.

---

## Alias Detection

The plugin detects when Titan methods are aliased and tracks them correctly. This works for six patterns:

### 1. Destructuring

```javascript
const { fetch } = t;
const { readFile, writeFile } = t.core.fs;
const { join: pathJoin } = t.core.path;

drift(fetch('/api'));           // ✅ fetch is alias of async t.fetch
drift(readFile('/file'));       // ✅ readFile is alias of async t.core.fs.readFile
pathJoin('a', 'b');             // ✅ pathJoin is alias of sync t.core.path.join (no drift needed)
drift(pathJoin('a', 'b'));      // ❌ Error: sync method doesn't need drift
```

### 2. Declare Global

```typescript
// types/globals.d.ts
declare global {
  function fetch(url: string): Promise<TitanCore.Response>;
  const myFetch: typeof t.fetch;
}
```

```javascript
drift(fetch('/api'));           // ✅ Global fetch detected as async
drift(myFetch('/api'));         // ✅ myFetch is alias of async t.fetch
```

### 3. Exports

```typescript
// utils/titan-helpers.ts
export const fetch = t.fetch;
export const readFile = t.core.fs.readFile;
export const pathJoin = t.core.path.join;
```

```javascript
drift(fetch('/api'));           // ✅ fetch is alias of async t.fetch
drift(readFile('/file'));       // ✅ readFile is alias of async t.core.fs.readFile
pathJoin('a', 'b');             // ✅ pathJoin is alias of sync method (no drift needed)
```

### 4. Simple Assignment

```javascript
const myFetch = t.fetch;
const myHash = t.core.crypto.hash;

drift(myFetch('/api'));         // ✅ myFetch is alias of async t.fetch
drift(myHash('data'));          // ✅ myHash is alias of async t.core.crypto.hash
```

### 5. Module Assignment

Assigns an entire Titan module to a variable. The plugin resolves sub-method calls on that variable.

```javascript
const db = t.db;
const fs = t.core.fs;
const myPath = t.core.path;

drift(db.query('SELECT 1'));   // ✅ db.query → t.db.query (async)
drift(fs.readFile('/file'));   // ✅ fs.readFile → t.core.fs.readFile (async)
myPath.join('a', 'b');         // ✅ myPath.join → t.core.path.join (sync, no drift needed)
db.isConnected();              // ✅ db.isConnected → t.db.isConnected (sync, no drift needed)

db.query('SELECT 1');          // ❌ Error: async method without drift
drift(myPath.join('a', 'b')); // ❌ Error: sync method doesn't need drift
```

### 6. Object Property

Assigns individual Titan methods as properties of a plain object.

```javascript
const titanUtils = { fetch: t.fetch, read: t.core.fs.readFile };
const dbHelpers = { query: t.db.query, exec: t.db.execute };

drift(titanUtils.fetch('/api'));    // ✅ titanUtils.fetch → t.fetch (async)
drift(dbHelpers.query('SELECT 1'));// ✅ dbHelpers.query → t.db.query (async)

titanUtils.fetch('/api');          // ❌ Error: async method without drift
```

---

## Project Scanning

The plugin scans your entire project for `.d.ts` files and source files to detect Titan types and aliases.

### Scanned Locations

| Source | What's Scanned |
|--------|----------------|
| `node_modules/` | Packages with `.d.ts` files containing Titan declarations |
| Project root | All `.d.ts` files recursively (scanned first for type definitions) |
| Source files | `.js`, `.ts`, `.mjs` files for alias patterns (scanned second) |

### Scanning Order

The plugin uses a **two-pass scan** to ensure correct detection:

1. **First pass:** All `.d.ts` files are parsed to build the complete method registry
2. **Second pass:** Source files (`.js`, `.ts`, `.mjs`) are parsed for alias patterns

This order guarantees that when the plugin encounters `const fs = t.core.fs` in a source file, it already knows all methods under `t.core.fs` and can correctly mark `fs` as a module alias.

### Skipped Directories

The following directories are automatically skipped:

- `node_modules/` (scanned separately for packages)
- `.git/`, `.svn/`
- `dist/`, `build/`
- `coverage/`
- `.next/`, `.nuxt/`, `.output/`
- `vendor/`
- `.cache/`

### Local Type Definitions

You can define types anywhere in your project. Common locations:

- `types/titan.d.ts`
- `src/types/titan.d.ts`
- `typings/titan.d.ts`
- `titan.d.ts`
- Any `.d.ts` file in your project

### Fallback Behavior

If a method is not found in any `.d.ts` file, it's treated as **sync** (permissive fallback). This means:

- No false positives for libraries without type definitions
- Add `.d.ts` files to enable accurate detection

---

## Third-Party Libraries

Third-party Titan libraries should include a `.d.ts` file to enable automatic async detection.

### For Library Authors

Create a `.d.ts` file and reference it in `package.json`:

```typescript
// index.d.ts
declare namespace t {
  namespace ws {
    function connect(url: string): Promise<WebSocket>;
    function send(data: string): Promise<void>;
    function close(): Promise<void>;
    function isConnected(): boolean;
  }
}
```

```json
// package.json
{
  "name": "titan-websocket",
  "types": "./index.d.ts"
}
```

### For Library Users

Just install the library. The plugin detects async methods automatically:

```bash
npm install titan-websocket
```

```javascript
// ✅ Plugin knows t.ws.connect is async
drift(t.ws.connect('ws://example.com'));

// ✅ Plugin knows t.ws.isConnected is sync
const connected = t.ws.isConnected();

// ✅ Works with all alias types
const { connect, isConnected } = t.ws;
drift(connect('ws://example.com'));
const connected = isConnected();

const ws = t.ws;
drift(ws.connect('ws://example.com'));
ws.isConnected();
```

---

## Configurations

### Default (`titanpl`)

Recommended configuration with all rules enabled:

```javascript
import { titanpl } from 'eslint-plugin-titanpl';

export default [titanpl];
```

Rules enabled:
- `no-node-builtins`: error
- `no-async-await`: error
- `drift-only-titan-async`: error
- `require-drift`: error

---

## Async vs Sync Titan Methods

### Core Async Methods (require `drift()`)

| Module | Methods |
|--------|---------|
| `t.fetch` / `Titan.fetch` | HTTP requests |
| `t.core.fs` | `readFile`, `writeFile`, `remove`, `mkdir`, `readdir`, `stat`, `exists` |
| `t.core.crypto` | `hash`, `encrypt`, `decrypt`, `hashKeyed` |
| `t.core.net` | `resolveDNS` |
| `t.core.time` | `sleep` |
| `t.core.session` | `get`, `set`, `delete`, `clear` |

### Core Sync Methods (do NOT need `drift()`)

| Module | Methods |
|--------|---------|
| `t.core.path` | `join`, `resolve`, `dirname`, `basename`, `extname` |
| `t.core.url` | `parse`, `format`, `SearchParams` |
| `t.core.crypto` | `uuid`, `randomBytes`, `compare` |
| `t.core.os` | `platform`, `cpus`, `totalMemory`, `freeMemory`, `tmpdir` |
| `t.core.buffer` | `fromBase64`, `toBase64`, `fromHex`, `toHex`, `fromUtf8`, `toUtf8` |
| `t.core.time` | `now`, `timestamp` |
| `t.core.proc` | `pid`, `uptime` |
| `t.core.net` | `ip` |
| `t.core.ls` | `get`, `set`, `remove`, `clear`, `keys` |
| `t.core.cookies` | `get`, `set`, `delete` |
| `t.log` | Logging |

> **Note:** These tables show the core Titan methods. Third-party libraries can extend `t` or `Titan` with additional methods. The plugin detects them automatically from `.d.ts` files.

---

## Error Messages

```
// no-node-builtins
"fs" is not available in TitanPL. Use t.core.fs instead.

// no-async-await
async functions are not allowed in TitanPL. Use drift() for async operations.
.then() is not allowed in TitanPL. Use drift() for async operations.

// drift-only-titan-async
drift() should only be used with Titan (t.* or Titan.*) async method calls.
drift() should not be used with sync Titan method "t.core.path.join". Remove the drift() wrapper.
drift() should not be used with sync Titan method "pathJoin". Remove the drift() wrapper.
drift() requires a function call as argument. Use drift(method(...)) instead of drift(method).
drift() requires an argument.

// require-drift
Async Titan method "t.fetch" must be wrapped in drift(). Use drift(t.fetch(...)) instead.
Async Titan method "fetch" must be wrapped in drift(). Use drift(fetch(...)) instead.
```

---

## Why This Plugin?

Titan Planet compiles your JavaScript/TypeScript into a native binary with an embedded V8 runtime. Unlike Node.js:

- **No Node.js Event Loop** — Request/Response model
- **No `require()`** — Use ES modules or bundled dependencies
- **No async/await** — Use `drift()` for async operations
- **True Isolation** — Each request is isolated
- **Native Performance** — Rust + V8 combination

This plugin helps catch incompatible code at lint time rather than runtime.

---

## Changelog

### v2.1.1

- **Six alias patterns**: Full support for destructuring, declare global, exports, simple assignment, module assignment, and object property aliases
- **Module alias resolution**: `const db = t.db; db.query()` correctly resolves to `t.db.query`
- **Object property aliases**: `const u = { fetch: t.fetch }; u.fetch()` correctly resolves
- **Two-pass scanning**: Type definitions (`.d.ts`) are loaded before source files to ensure correct module alias detection
- **Compound path resolution**: `checkForAlias("fs.readFile")` correctly resolves through module aliases (`fs` → `t.core.fs` → `t.core.fs.readFile`)

### v2.1.0

- **Project scanning**: Now scans entire project recursively for `.d.ts` files
- **Alias detection**: Detects destructuring (`const { fetch } = t`)
- **Declare global support**: Detects `declare global { const fetch: typeof t.fetch }`
- **Export detection**: Detects `export const fetch = t.fetch`
- **Improved reliability**: Better null handling in `isTitanCallee()`

### v2.0.0

- Initial DTS file checker for automatic async method detection
- Scans `node_modules/` for Titan type definitions

---

## License

ISC © [David200197](https://github.com/David200197)