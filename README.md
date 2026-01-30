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

1. The method must be from `t` or `Titan`
2. The method must be asynchronous (detected automatically from `.d.ts` files)

#### ❌ Incorrect

```javascript
// Non-Titan methods
drift(myFunction());
drift(console.log('test'));

// Sync Titan methods (don't need drift)
drift(t.core.path.join('a', 'b'));     // path.join is sync
drift(t.core.url.parse('http://...'));  // url.parse is sync
drift(t.core.crypto.uuid());            // uuid is sync
drift(t.core.os.platform());            // os.platform is sync
```

#### ✅ Correct

```javascript
// Async Titan methods
drift(t.fetch('/api'));
drift(t.core.fs.readFile('/file'));
drift(t.core.fs.writeFile('/file', 'data'));
drift(t.core.crypto.hash('data'));
drift(t.core.time.sleep(1000));
drift(t.core.net.resolveDNS('example.com'));
drift(t.core.session.get('key'));
```

---

### `titanpl/require-drift`

Requires `drift()` wrapper for async TitanPL native methods. Complements `drift-only-titan-async` by catching unwrapped async calls.

#### ❌ Incorrect

```javascript
t.fetch('/api/data');              // Missing drift()
t.core.fs.readFile('/file');       // Missing drift()
t.core.crypto.hash('data');        // Missing drift()
```

#### ✅ Correct

```javascript
drift(t.fetch('/api/data'));
drift(t.core.fs.readFile('/file'));
drift(t.core.crypto.hash('data'));

// Sync methods don't need drift
t.core.path.join('a', 'b');
t.core.crypto.uuid();
```

---

## Async Method Detection

The plugin **automatically detects** whether a Titan method is async or sync by reading `.d.ts` files. **No configuration required.**

```
1. DTS File Reader  →  Scans node_modules for .d.ts files
                       Finds "declare namespace t" or "declare namespace Titan"
                       Extracts methods that return Promise<T>
         ↓ fallback
2. Permissive Fallback  →  Unknown methods are treated as sync
```

### How It Works

When you install a Titan library, the plugin automatically:

1. Scans `node_modules/` for packages with `.d.ts` files
2. Looks for `declare namespace t` or `declare namespace Titan` declarations
3. Extracts methods and checks if they return `Promise<...>`
4. Caches the results for performance

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

### Local Type Definitions

You can also define types locally in your project. The plugin scans these locations:

- `types/titan.d.ts`
- `src/types/titan.d.ts`
- `typings/titan.d.ts`
- `titan.d.ts`

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

// require-drift
Async Titan method "t.fetch" must be wrapped in drift(). Use drift(t.fetch(...)) instead.
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

## License

ISC © [David200197](https://github.com/David200197)
