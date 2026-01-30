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
2. The method must be asynchronous

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

### Async Methods (require `drift()`)

| Module | Methods |
|--------|---------|
| `t.fetch` / `Titan.fetch` | HTTP requests |
| `t.core.fs` | `readFile`, `writeFile`, `remove`, `mkdir`, `readdir`, `stat`, `exists` |
| `t.core.crypto` | `hash`, `encrypt`, `decrypt`, `hashKeyed` |
| `t.core.net` | `resolveDNS` |
| `t.core.time` | `sleep` |
| `t.core.session` | `get`, `set`, `delete`, `clear` |

### Sync Methods (do NOT need `drift()`)

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

---

## Error Messages

```
// no-node-builtins
"fs" is not available in TitanPL. Use t.core.fs instead.

// no-async-await
async functions are not allowed in TitanPL. Use drift() for async operations.
.then() is not allowed in TitanPL. Use drift() for async operations.

// drift-only-titan-async
drift() should only be used with async TitanPL methods. "t.core.path.join" is a sync method and does not require drift().

// require-drift
"t.fetch" is async and must be wrapped with drift(). Use: drift(t.fetch(...))
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