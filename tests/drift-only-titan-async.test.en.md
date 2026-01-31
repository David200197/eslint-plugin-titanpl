# Rule: `drift-only-titan-async` — Test Report

**Rule purpose:** Ensures that `drift()` is used **exclusively** with async Titan methods. Rejects any other usage: sync methods, non-Titan functions, literals, references without invocation, etc.

**Error principle:** _"If you're using drift(), it must wrap an async Titan call — nothing else."_

---

## Valid Cases (expected: 0 errors)

### 1. Direct async `t.*` methods with drift

```js
drift(t.fetch('/api'));
drift(t.core.fs.readFile('/file'));
drift(t.core.crypto.hash('data'));
drift(t.core.time.sleep(1000));
// ... 16 methods total
```

Verifies that all **core async methods** under `t.*` are accepted inside `drift()`. Covers filesystem, crypto, network, time, and session APIs.

### 2. Async `Titan.*` methods with drift

```js
drift(Titan.fetch('/api'));
drift(Titan.core.fs.readFile('/file'));
```

Same validation but using the `Titan` namespace alias instead of `t`.

### 3. Third-party async methods with drift (node_modules)

```js
drift(t.ws.connect('wss://example.com'));
drift(t.db.query('SELECT 1'));
drift(t.auth.login('user', 'pass'));
drift(t.cache.get('key'));
```

Confirms the rule recognizes async methods from third-party packages installed in `node_modules/` (`titan-websocket`, `titan-database`, `titan-auth`, `@scope/titan-cache`).

### 4. Destructured async aliases with drift

```js
drift(fetch('/api'));       // const { fetch } = t;
drift(readFile('/file'));   // const { readFile } = t.core.fs;
drift(wsConnect('wss://…'));// const { connect: wsConnect } = t.ws;
```

Tests that destructured aliases (with or without renaming) are correctly resolved to their original async Titan method.

### 5. Declare global async aliases with drift

```js
drift(globalFetch('/api'));     // declare global { const globalFetch: typeof t.fetch }
drift(globalReadFile('/file'));
drift(globalSleep(1000));
```

Validates aliases defined via `declare global` in `.d.ts` files.

### 6. Exported async aliases with drift

```js
drift(exportedFetch('/api'));   // export const exportedFetch = t.fetch;
drift(exportedDbQuery('SELECT 1'));
```

Validates aliases created through `export const` assignments.

### 7. Simple assignment async aliases with drift

```js
drift(myFetch('/api'));  // const myFetch = t.fetch;
drift(myHash('data'));   // const myHash = t.core.crypto.hash;
```

Validates aliases created through simple `const x = t.method` assignments.

### 8. Module assignment async aliases with drift

```js
drift(db.query('SELECT 1'));   // const db = t.db;
drift(fs.readFile('/file'));   // const fs = t.core.fs;
```

Tests the most complex alias pattern: a variable assigned to a Titan module, then a sub-method called on it. The rule must resolve `db.query` → `t.db.query` and recognize it as async.

### 9. Object property async aliases with drift

```js
drift(titanUtils.fetch('/api'));   // const titanUtils = { fetch: t.fetch }
drift(dbHelpers.query('SELECT 1'));// export const dbHelpers = { query: t.db.query }
```

Validates aliases stored as properties of plain objects.

---

## Invalid Cases (expected: 1 error each)

### 10. drift with sync `t.*` methods → `driftNotForSyncMethods`

```js
drift(t.core.path.join('a', 'b'));
drift(t.core.url.parse('http://example.com'));
drift(t.core.crypto.uuid());
drift(t.core.os.platform());
drift(t.core.buffer.toBase64('hi'));
drift(t.core.time.now());
drift(t.log('msg'));
// ... 26 methods total
```

The core assertion of this rule: `drift()` must not wrap synchronous methods. Covers path, url, crypto (sync subset), os, buffer, time (sync subset), proc, net, ls, cookies, and log.

### 11. drift with sync `Titan.*` methods → `driftNotForSyncMethods`

```js
drift(Titan.core.path.join('a', 'b'));
```

Same check using the `Titan` namespace.

### 12. drift with sync third-party methods → `driftNotForSyncMethods`

```js
drift(t.ws.isConnected());
drift(t.db.isConnected());
drift(t.auth.currentUser());
drift(t.cache.has('key'));
```

Sync methods from third-party packages are also rejected inside `drift()`.

### 13. drift with sync destructured aliases → `driftNotForSyncMethodsAlias`

```js
drift(pathJoin('a', 'b'));  // const { join: pathJoin } = t.core.path;
drift(log('message'));      // const { log } = t;
drift(uuid());              // const { uuid } = t.core.crypto;
drift(now());               // const { now } = t.core.time;
```

Detects sync methods even when accessed through destructured aliases. Uses the `driftNotForSyncMethodsAlias` message variant.

### 14. drift with sync declare global aliases → `driftNotForSyncMethodsAlias`

```js
drift(globalPathJoin('a', 'b'));
drift(globalLog('message'));
drift(globalNow());
```

Same detection through `declare global` aliases.

### 15. drift with sync exported aliases → `driftNotForSyncMethodsAlias`

```js
drift(exportedPathJoin('a', 'b'));
drift(exportedLog('message'));
```

Same detection through exported aliases.

### 16. drift with sync module alias sub-methods → `driftNotForSyncMethods` or `driftNotForSyncMethodsAlias`

```js
drift(myPath.join('a', 'b'));  // const myPath = t.core.path;
drift(db.isConnected());      // const db = t.db;
```

Resolves module aliases and detects that the called sub-method is synchronous.

### 17. drift with sync object property aliases → `driftNotForSyncMethods` or `driftNotForSyncMethodsAlias`

```js
drift(titanUtils.join('a', 'b')); // const titanUtils = { join: t.core.path.join }
```

Object property aliases pointing to sync methods are also rejected.

### 18. drift without argument → `driftRequiresArgument`

```js
drift();
```

`drift()` called with no arguments is always an error.

### 19. drift with method reference (not called) → `driftRequiresCall`

```js
drift(t.fetch);             // missing ()
drift(t.core.fs.readFile);  // missing ()
drift(Titan.fetch);         // missing ()
```

Passing a method reference without invoking it. The argument must be a **call expression**, not a member expression.

### 20. drift with alias reference (not called) → `driftRequiresCall`

```js
drift(fetch);          // const { fetch } = t; — missing ()
drift(readFile);       // missing ()
drift(globalFetch);    // missing ()
drift(exportedFetch);  // missing ()
drift(myFetch);        // missing ()
```

Same check for all alias types: destructured, global, exported, and simple assignment.

### 21. drift with module alias reference (not called) → `driftRequiresCall`

```js
drift(db.query);  // const db = t.db; — missing ()
```

Module alias member expression without invocation.

### 22. drift with non-Titan function → `driftOnlyForTitanAsync`

```js
drift(myFunction());
drift(console.log("test"));
drift(someModule.method());
drift(Math.random());
```

Any function call that doesn't resolve to a Titan method is rejected.

### 23. drift with unknown variable → `driftOnlyForTitanAsync`

```js
drift(someVariable);
drift(unknownRef);
drift(promise);
```

Identifiers that are not recognized as Titan aliases.

### 24. drift with function expressions → `driftOnlyForTitanAsync`

```js
drift(() => {});
drift(function() {});
```

Arrow functions and function expressions are not valid drift arguments.

### 25. drift with literals → `driftOnlyForTitanAsync`

```js
drift('string');
drift(123);
drift(true);
drift(null);
```

Primitive values are not valid drift arguments.

### 26. drift with objects/arrays → `driftOnlyForTitanAsync`

```js
drift({});
drift([]);
```

Object and array literals are not valid drift arguments.

---

## Fallback Behavior

### 27. Unknown Titan methods → treated as sync

```js
drift(t.unknown.newMethod());     // → driftNotForSyncMethods
drift(Titan.something.else());    // → driftNotForSyncMethods
```

Methods that exist under `t.*` or `Titan.*` but aren't found in the `.d.ts` cache are **treated as sync by default** and therefore rejected inside `drift()`. This is a safe-by-default approach.

---

## Edge Cases

### 28. Unknown non-Titan calls

```js
drift(unknownAlias());    // → driftOnlyForTitanAsync
drift(someLib.doStuff()); // → driftOnlyForTitanAsync
```

Functions that don't resolve to any Titan path are rejected with the generic "drift is only for Titan async" message.

---

## Error Message Summary

| messageId | Trigger |
|-----------|---------|
| `driftNotForSyncMethods` | `drift()` wraps a known sync Titan method (direct path) |
| `driftNotForSyncMethodsAlias` | `drift()` wraps a known sync Titan method (via alias) |
| `driftRequiresArgument` | `drift()` called with no arguments |
| `driftRequiresCall` | `drift()` argument is a reference, not a function call |
| `driftOnlyForTitanAsync` | `drift()` wraps a non-Titan expression (function, literal, unknown) |