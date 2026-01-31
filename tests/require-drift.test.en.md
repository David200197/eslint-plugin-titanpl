# Rule: `require-drift` — Test Report

**Rule purpose:** Ensures that every async Titan method call is wrapped in `drift()`. Sync methods and non-Titan calls are ignored.

**Error principle:** _"If you're calling an async Titan method, it must be inside drift()."_

**Complementary rule:** This is the inverse of `drift-only-titan-async`. Together they enforce: async Titan calls ↔ drift() (bidirectional requirement).

---

## Valid Cases (expected: 0 errors)

### 1. Direct async methods WITH drift

```js
drift(t.fetch('/api/data'));
drift(Titan.fetch('/api/data'));
drift(t.core.fs.readFile('/path/to/file'));
drift(t.core.crypto.hash('data'));
drift(t.core.time.sleep(1000));
// ... 17 methods total
```

The rule's primary valid case: all async methods are correctly wrapped in `drift()`.

### 2. Titan namespace async methods WITH drift

```js
drift(Titan.core.fs.readFile('/file'));
drift(Titan.core.crypto.hash('data'));
```

Same validation using the `Titan` namespace.

### 3. Third-party async methods WITH drift

```js
drift(t.ws.connect('wss://example.com'));
drift(t.db.query('SELECT 1'));
drift(t.auth.login('user', 'pass'));
drift(t.cache.get('key'));
// ... 11 methods total
```

Third-party packages from `node_modules/` are also correctly handled when wrapped in `drift()`.

### 4. Sync methods WITHOUT drift (direct `t.*`)

```js
t.core.path.join('a', 'b');
t.core.url.parse('http://example.com');
t.core.crypto.uuid();
t.core.os.platform();
t.core.buffer.toBase64('hi');
t.core.time.now();
t.log('hello');
// ... 34 methods total
```

**Critical distinction:** Sync methods do NOT require `drift()`. The rule must correctly identify these as synchronous and leave them alone. This is the largest valid test set, covering path, url, crypto (sync subset), os, buffer, time (sync subset), proc, net, ls, cookies, and log.

### 5. Sync `Titan.*` methods WITHOUT drift

```js
Titan.core.path.join('a', 'b');
```

Same for the `Titan` namespace.

### 6. Sync third-party methods WITHOUT drift

```js
t.ws.isConnected();
t.db.isConnected();
t.auth.currentUser();
t.cache.has('key');
```

Sync methods from third-party packages are also correctly ignored.

### 7. Non-Titan calls

```js
myFunction();
someModule.method();
console.log('hello');
Math.random();
JSON.stringify({});
Array.isArray([]);
```

The rule only applies to Titan methods. Regular JavaScript calls are completely ignored.

### 8. Destructured SYNC aliases WITHOUT drift

```js
pathJoin('a', 'b');  // const { join: pathJoin } = t.core.path;
log('hello');        // const { log } = t;
now();               // const { now } = t.core.time;
uuid();              // const { uuid } = t.core.crypto;
```

Sync aliases used without `drift()` are valid — the rule resolves the alias, determines the method is sync, and allows it.

### 9. Declare global SYNC aliases WITHOUT drift

```js
globalPathJoin('a', 'b');
globalLog('message');
globalNow();
```

Same for `declare global` sync aliases.

### 10. Exported SYNC aliases WITHOUT drift

```js
exportedPathJoin('a', 'b');
exportedLog('message');
```

Same for exported sync aliases.

### 11. Destructured ASYNC aliases WITH drift

```js
drift(fetch('/api'));       // const { fetch } = t;
drift(readFile('/file'));   // const { readFile } = t.core.fs;
drift(wsConnect('wss://…'));// const { connect: wsConnect } = t.ws;
drift(dbQuery('SELECT 1'));
```

Async aliases correctly wrapped in `drift()`.

### 12. Declare global ASYNC aliases WITH drift

```js
drift(globalFetch('/api'));
drift(globalReadFile('/file'));
drift(globalSleep(1000));
```

Global async aliases correctly wrapped.

### 13. Exported ASYNC aliases WITH drift

```js
drift(exportedFetch('/api'));
drift(exportedReadFile('/file'));
drift(exportedDbQuery('SELECT 1'));
drift(exportedSleep(1000));
```

Exported async aliases correctly wrapped.

### 14. Simple assignment ASYNC aliases WITH drift

```js
drift(myFetch('/api'));  // const myFetch = t.fetch;
drift(myHash('data'));   // const myHash = t.core.crypto.hash;
```

Simple assignment async aliases correctly wrapped.

### 15. Module assignment aliases WITH drift

```js
drift(db.query('SELECT 1'));   // const db = t.db;
drift(fs.readFile('/file'));   // const fs = t.core.fs;
```

Module alias async sub-methods correctly wrapped. The rule resolves `db.query` → `t.db.query` → async → requires drift ✓.

### 16. Module assignment SYNC sub-methods WITHOUT drift

```js
myPath.join('a', 'b');   // const myPath = t.core.path;
db.isConnected();        // const db = t.db;
```

Module alias sync sub-methods without `drift()` are valid. The rule resolves `myPath.join` → `t.core.path.join` → sync → no drift needed.

### 17. Object property aliases WITH drift

```js
drift(titanUtils.fetch('/api'));
drift(titanUtils.read('/file'));
drift(dbHelpers.query('SELECT 1'));
drift(dbHelpers.exec('INSERT ...'));
```

Object property async aliases correctly wrapped.

### 18. Object property SYNC aliases WITHOUT drift

```js
titanUtils.join('a', 'b');  // const titanUtils = { join: t.core.path.join }
```

Object property sync aliases without `drift()` are valid.

---

## Invalid Cases (expected: 1 error each, messageId: `requireDrift`)

### 19. Direct async methods WITHOUT drift

```js
t.fetch('/api/data');
Titan.fetch('/api/data');
t.core.fs.readFile('/path/to/file');
t.core.crypto.hash('data');
t.core.time.sleep(1000);
Titan.core.fs.readFile('/file');
// ... 19 methods total
```

The core invalid case: async Titan methods called without `drift()` wrapper.

### 20. Third-party async methods WITHOUT drift

```js
t.ws.connect('wss://example.com');
t.db.query('SELECT 1');
t.auth.login('user', 'pass');
t.cache.get('key');
// ... 11 methods total
```

Third-party async methods also require `drift()`.

### 21. Destructured ASYNC aliases WITHOUT drift

```js
fetch('/api');
readFile('/file');
writeFile('/file', 'data');
sleep(1000);
wsConnect('wss://example.com');
dbQuery('SELECT 1');
```

The rule resolves each alias back to its Titan original, determines it's async, and flags the missing `drift()`.

### 22. Declare global ASYNC aliases WITHOUT drift

```js
globalFetch('/api');
globalReadFile('/file');
globalDbQuery('SELECT 1');
globalWsConnect('wss://example.com');
globalSleep(1000);
```

Global async aliases without `drift()` are flagged.

### 23. Exported ASYNC aliases WITHOUT drift

```js
exportedFetch('/api');
exportedReadFile('/file');
exportedDbQuery('SELECT 1');
exportedSleep(1000);
```

Exported async aliases without `drift()` are flagged.

### 24. Simple assignment ASYNC aliases WITHOUT drift

```js
myFetch('/api');   // const myFetch = t.fetch;
myHash('data');    // const myHash = t.core.crypto.hash;
```

Simple assignment async aliases without `drift()` are flagged.

### 25. Module assignment ASYNC sub-methods WITHOUT drift

```js
db.query('SELECT 1');    // const db = t.db;
fs.readFile('/file');    // const fs = t.core.fs;
```

The rule resolves `db.query` → `t.db.query` → async → missing drift → error.

### 26. Object property ASYNC aliases WITHOUT drift

```js
titanUtils.fetch('/api');
titanUtils.read('/file');
dbHelpers.query('SELECT 1');
dbHelpers.exec('INSERT ...');
```

Object property async aliases without `drift()` are flagged.

---

## Fallback Behavior

### 27. Unknown Titan methods → treated as sync (no error)

```js
t.unknown.newMethod();      // → 0 errors
Titan.something.else();     // → 0 errors
```

Methods under `t.*` or `Titan.*` that aren't found in the `.d.ts` cache are **treated as sync by default** and therefore do NOT require `drift()`. This avoids false positives for methods the rule doesn't know about.

### 28. Unknown aliases → no error

```js
unknownAlias();  // → 0 errors
```

Function calls that don't resolve to any Titan alias are ignored entirely.

---

## Edge Cases

### 29. Mixed direct + alias usage

```js
t.core.path.join('a', 'b');  // sync direct → OK (0 errors)
pathJoin('a', 'b');           // sync alias → OK (0 errors)
t.fetch('/api');              // async direct without drift → FAIL (1 error)
fetch('/api');                // async alias without drift → FAIL (1 error)
```

Verifies that the rule correctly handles a mix of sync/async and direct/alias in the same codebase.

### 30. drift() call itself is not flagged

```js
drift(t.fetch('/api'));  // → 0 errors
```

`drift()` is the wrapper function, not something that needs wrapping. The rule must not flag the outer `drift()` call.

### 31. Chained calls

```js
t.core.path.join('a', 'b').toString();  // → 0 errors
```

A method call on a result (`.toString()`) — the callee is the chained method, not a direct Titan call.

---

## Error Message Summary

| messageId | Trigger |
|-----------|---------|
| `requireDrift` | An async Titan method (direct or via any alias type) is called without being wrapped in `drift()` |

Unlike `drift-only-titan-async` which has 5 error types, this rule has a single error message. The logic is simpler: if it's async Titan → must have drift.