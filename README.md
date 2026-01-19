# @titanpl/eslint-plugin-titanpl

ESLint plugin for [Titan Planet](https://titan-docs-ez.vercel.app/docs) projects. Enforces TitanPL-specific rules including blocking Node.js built-in modules that are not available in the TitanPL runtime.

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
        Titan: 'readonly'
      }
    },
    rules: {
      'no-undef': 'error',
      'titanpl/no-node-builtins': 'error'
    }
  }
];
```

## Rules

### `titanpl/no-node-builtins`

Disallows importing Node.js built-in modules that are not available in the TitanPL runtime.

Titan Planet is **not** a Node.js framework—it's a Rust server that speaks JavaScript/TypeScript. This means standard Node.js modules like `fs`, `path`, `http`, etc., are not available. Instead, Titan provides its own high-performance APIs through the `t` global object.

#### ❌ Incorrect

```javascript
import fs from 'fs';
import { readFile } from 'node:fs';
import path from 'path';
import crypto from 'crypto';
import http from 'http';

const data = await import('fs');
export { join } from 'path';
```

#### ✅ Correct

```javascript
// Use Titan's built-in APIs
const content = t.core.fs.readFile('config.json');
const fullPath = t.core.path.join('dir', 'file.txt');
const hash = t.core.crypto.hash('sha256', 'data');
const response = await t.fetch('https://api.example.com');

// External packages are allowed
import { something } from 'lodash';
import utils from './utils.js';
```

## Titan Alternatives

When you try to use a Node.js module, the plugin will suggest the appropriate Titan alternative:

| Node.js Module | Titan Alternative | Description |
|----------------|-------------------|-------------|
| `fs` | `t.core.fs` | File system operations |
| `path` | `t.core.path` | Path manipulation utilities |
| `crypto` | `t.core.crypto` | Cryptographic utilities (hash, uuid, randomBytes) |
| `os` | `t.core.os` | Operating system information |
| `url` | `t.core.url` | URL parsing and manipulation |
| `querystring` | `t.core.url.SearchParams` | Query string handling |
| `timers` | `t.core.time` | Time utilities (sleep, now, timestamp) |
| `process` | `t.core.proc` | Process information (pid, uptime) |
| `dns` | `t.core.net.resolveDNS()` | DNS resolution |
| `net` | `t.core.net` | Network utilities |
| `http` / `https` | `t.fetch()` | HTTP client via Titan fetch API |
| `buffer` | `ArrayBuffer/TypedArray` | Use standard Web APIs |

### Modules Without Alternatives

The following Node.js modules have **no direct alternative** in Titan and will show a different error message:

`assert`, `async_hooks`, `child_process`, `cluster`, `dgram`, `events`, `module`, `perf_hooks`, `punycode`, `readline`, `stream`, `string_decoder`, `tls`, `tty`, `util`, `v8`, `vm`, `worker_threads`, `zlib`

## Error Messages

The plugin provides helpful error messages with suggestions:

```
// With alternative:
"fs" is not available in TitanPL. Use t.core.fs instead. File system operations.

"http" is not available in TitanPL. Use t.fetch() instead. HTTP client via Titan fetch API.

// Without alternative:
"child_process" is not available in TitanPL and has no direct alternative in Titan.
```

## Titan Core API Quick Reference

```javascript
// File System
t.core.fs.readFile(path)
t.core.fs.writeFile(path, content)
t.core.fs.exists(path)
t.core.fs.mkdir(path)
t.core.fs.remove(path)
t.core.fs.readdir(path)
t.core.fs.stat(path)

// Path
t.core.path.join(...parts)
t.core.path.resolve(...parts)
t.core.path.dirname(path)
t.core.path.basename(path)
t.core.path.extname(path)

// Crypto
t.core.crypto.hash(algo, data)    // 'sha256', 'sha512', 'md5'
t.core.crypto.randomBytes(size)
t.core.crypto.uuid()
t.core.crypto.compare(hash, target)

// OS
t.core.os.platform()
t.core.os.cpus()
t.core.os.totalMemory()
t.core.os.freeMemory()
t.core.os.tmpdir()

// Network
t.core.net.resolveDNS(hostname)
t.core.net.ip()

// Process
t.core.proc.pid()
t.core.proc.uptime()

// Time
t.core.time.sleep(ms)
t.core.time.now()
t.core.time.timestamp()

// URL
t.core.url.parse(urlString)
t.core.url.format(urlObject)
new t.core.url.SearchParams(query)

// HTTP (global)
t.fetch(url, options)
```

## Why This Plugin?

Titan Planet compiles your JavaScript/TypeScript into a native binary with an embedded V8 runtime. Unlike Node.js:

- **No Node.js Event Loop** — Request/Response model
- **No `require()`** — Use ES modules or bundled dependencies
- **True Isolation** — Each request is isolated
- **Native Performance** — Rust + V8 combination

This plugin helps catch incompatible code at lint time rather than runtime.

## Related

- [Titan Planet Documentation](https://titan-docs-ez.vercel.app/docs)
- [@titanpl/core](https://www.npmjs.com/package/@titanpl/core) - Core Standard Library

## License

ISC © [David200197](https://github.com/David200197)