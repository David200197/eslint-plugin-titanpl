# Regla: `require-drift` — Reporte de Tests

**Propósito de la regla:** Asegura que toda llamada a un método async de Titan esté envuelta en `drift()`. Los métodos sync y las llamadas no-Titan se ignoran.

**Principio de error:** _"Si estás llamando un método async de Titan, debe estar dentro de drift()."_

**Regla complementaria:** Esta es la inversa de `drift-only-titan-async`. Juntas imponen: llamadas async Titan ↔ drift() (requisito bidireccional).

---

## Casos Válidos (esperado: 0 errores)

### 1. Métodos async directos CON drift

```js
drift(t.fetch('/api/data'));
drift(Titan.fetch('/api/data'));
drift(t.core.fs.readFile('/path/to/file'));
drift(t.core.crypto.hash('data'));
drift(t.core.time.sleep(1000));
// ... 17 métodos en total
```

El caso válido principal de la regla: todos los métodos async están correctamente envueltos en `drift()`.

### 2. Métodos async del namespace Titan CON drift

```js
drift(Titan.core.fs.readFile('/file'));
drift(Titan.core.crypto.hash('data'));
```

Misma validación usando el namespace `Titan`.

### 3. Métodos async de terceros CON drift

```js
drift(t.ws.connect('wss://example.com'));
drift(t.db.query('SELECT 1'));
drift(t.auth.login('user', 'pass'));
drift(t.cache.get('key'));
// ... 11 métodos en total
```

Los paquetes de terceros de `node_modules/` también se manejan correctamente cuando están envueltos en `drift()`.

### 4. Métodos sync SIN drift (directos `t.*`)

```js
t.core.path.join('a', 'b');
t.core.url.parse('http://example.com');
t.core.crypto.uuid();
t.core.os.platform();
t.core.buffer.toBase64('hi');
t.core.time.now();
t.log('hello');
// ... 34 métodos en total
```

**Distinción crítica:** Los métodos sync NO requieren `drift()`. La regla debe identificarlos correctamente como síncronos y dejarlos pasar. Este es el conjunto de tests válidos más grande, cubriendo path, url, crypto (subconjunto sync), os, buffer, time (subconjunto sync), proc, net, ls, cookies y log.

### 5. Métodos sync `Titan.*` SIN drift

```js
Titan.core.path.join('a', 'b');
```

Igual para el namespace `Titan`.

### 6. Métodos sync de terceros SIN drift

```js
t.ws.isConnected();
t.db.isConnected();
t.auth.currentUser();
t.cache.has('key');
```

Los métodos sync de paquetes de terceros también se ignoran correctamente.

### 7. Llamadas no-Titan

```js
myFunction();
someModule.method();
console.log('hello');
Math.random();
JSON.stringify({});
Array.isArray([]);
```

La regla solo aplica a métodos de Titan. Las llamadas regulares de JavaScript se ignoran completamente.

### 8. Aliases SYNC desestructurados SIN drift

```js
pathJoin('a', 'b');  // const { join: pathJoin } = t.core.path;
log('hello');        // const { log } = t;
now();               // const { now } = t.core.time;
uuid();              // const { uuid } = t.core.crypto;
```

Los aliases sync usados sin `drift()` son válidos — la regla resuelve el alias, determina que el método es sync y lo permite.

### 9. Aliases SYNC de declare global SIN drift

```js
globalPathJoin('a', 'b');
globalLog('message');
globalNow();
```

Igual para aliases sync de `declare global`.

### 10. Aliases SYNC exportados SIN drift

```js
exportedPathJoin('a', 'b');
exportedLog('message');
```

Igual para aliases sync exportados.

### 11. Aliases ASYNC desestructurados CON drift

```js
drift(fetch('/api'));       // const { fetch } = t;
drift(readFile('/file'));   // const { readFile } = t.core.fs;
drift(wsConnect('wss://…'));// const { connect: wsConnect } = t.ws;
drift(dbQuery('SELECT 1'));
```

Aliases async correctamente envueltos en `drift()`.

### 12. Aliases ASYNC de declare global CON drift

```js
drift(globalFetch('/api'));
drift(globalReadFile('/file'));
drift(globalSleep(1000));
```

Aliases async globales correctamente envueltos.

### 13. Aliases ASYNC exportados CON drift

```js
drift(exportedFetch('/api'));
drift(exportedReadFile('/file'));
drift(exportedDbQuery('SELECT 1'));
drift(exportedSleep(1000));
```

Aliases async exportados correctamente envueltos.

### 14. Aliases ASYNC por asignación simple CON drift

```js
drift(myFetch('/api'));  // const myFetch = t.fetch;
drift(myHash('data'));   // const myHash = t.core.crypto.hash;
```

Aliases async por asignación simple correctamente envueltos.

### 15. Aliases de asignación de módulo CON drift

```js
drift(db.query('SELECT 1'));   // const db = t.db;
drift(fs.readFile('/file'));   // const fs = t.core.fs;
```

Sub-métodos async de alias de módulo correctamente envueltos. La regla resuelve `db.query` → `t.db.query` → async → requiere drift ✓.

### 16. Sub-métodos SYNC de alias de módulo SIN drift

```js
myPath.join('a', 'b');   // const myPath = t.core.path;
db.isConnected();        // const db = t.db;
```

Sub-métodos sync de alias de módulo sin `drift()` son válidos. La regla resuelve `myPath.join` → `t.core.path.join` → sync → no necesita drift.

### 17. Aliases de propiedad de objeto CON drift

```js
drift(titanUtils.fetch('/api'));
drift(titanUtils.read('/file'));
drift(dbHelpers.query('SELECT 1'));
drift(dbHelpers.exec('INSERT ...'));
```

Aliases async de propiedad de objeto correctamente envueltos.

### 18. Aliases SYNC de propiedad de objeto SIN drift

```js
titanUtils.join('a', 'b');  // const titanUtils = { join: t.core.path.join }
```

Aliases sync de propiedad de objeto sin `drift()` son válidos.

---

## Casos Inválidos (esperado: 1 error cada uno, messageId: `requireDrift`)

### 19. Métodos async directos SIN drift

```js
t.fetch('/api/data');
Titan.fetch('/api/data');
t.core.fs.readFile('/path/to/file');
t.core.crypto.hash('data');
t.core.time.sleep(1000);
Titan.core.fs.readFile('/file');
// ... 19 métodos en total
```

El caso inválido central: métodos async de Titan llamados sin el wrapper `drift()`.

### 20. Métodos async de terceros SIN drift

```js
t.ws.connect('wss://example.com');
t.db.query('SELECT 1');
t.auth.login('user', 'pass');
t.cache.get('key');
// ... 11 métodos en total
```

Los métodos async de terceros también requieren `drift()`.

### 21. Aliases ASYNC desestructurados SIN drift

```js
fetch('/api');
readFile('/file');
writeFile('/file', 'data');
sleep(1000);
wsConnect('wss://example.com');
dbQuery('SELECT 1');
```

La regla resuelve cada alias a su original de Titan, determina que es async y marca la ausencia de `drift()`.

### 22. Aliases ASYNC de declare global SIN drift

```js
globalFetch('/api');
globalReadFile('/file');
globalDbQuery('SELECT 1');
globalWsConnect('wss://example.com');
globalSleep(1000);
```

Aliases async globales sin `drift()` se marcan como error.

### 23. Aliases ASYNC exportados SIN drift

```js
exportedFetch('/api');
exportedReadFile('/file');
exportedDbQuery('SELECT 1');
exportedSleep(1000);
```

Aliases async exportados sin `drift()` se marcan como error.

### 24. Aliases ASYNC por asignación simple SIN drift

```js
myFetch('/api');   // const myFetch = t.fetch;
myHash('data');    // const myHash = t.core.crypto.hash;
```

Aliases async por asignación simple sin `drift()` se marcan como error.

### 25. Sub-métodos ASYNC de alias de módulo SIN drift

```js
db.query('SELECT 1');    // const db = t.db;
fs.readFile('/file');    // const fs = t.core.fs;
```

La regla resuelve `db.query` → `t.db.query` → async → falta drift → error.

### 26. Aliases ASYNC de propiedad de objeto SIN drift

```js
titanUtils.fetch('/api');
titanUtils.read('/file');
dbHelpers.query('SELECT 1');
dbHelpers.exec('INSERT ...');
```

Aliases async de propiedad de objeto sin `drift()` se marcan como error.

---

## Comportamiento de Fallback

### 27. Métodos Titan desconocidos → tratados como sync (sin error)

```js
t.unknown.newMethod();      // → 0 errores
Titan.something.else();     // → 0 errores
```

Métodos bajo `t.*` o `Titan.*` que no se encuentran en el caché de `.d.ts` se **tratan como sync por defecto** y por lo tanto NO requieren `drift()`. Esto evita falsos positivos para métodos que la regla no conoce.

### 28. Aliases desconocidos → sin error

```js
unknownAlias();  // → 0 errores
```

Llamadas a funciones que no resuelven a ningún alias de Titan se ignoran completamente.

---

## Casos Límite

### 29. Uso mixto directo + alias

```js
t.core.path.join('a', 'b');  // sync directo → OK (0 errores)
pathJoin('a', 'b');           // sync alias → OK (0 errores)
t.fetch('/api');              // async directo sin drift → FALLA (1 error)
fetch('/api');                // async alias sin drift → FALLA (1 error)
```

Verifica que la regla maneja correctamente una mezcla de sync/async y directo/alias en el mismo código.

### 30. La llamada a drift() misma no se marca

```js
drift(t.fetch('/api'));  // → 0 errores
```

`drift()` es la función wrapper, no algo que necesite ser envuelto. La regla no debe marcar la llamada externa a `drift()`.

### 31. Llamadas encadenadas

```js
t.core.path.join('a', 'b').toString();  // → 0 errores
```

Una llamada a método sobre un resultado (`.toString()`) — el callee es el método encadenado, no una llamada directa a Titan.

---

## Resumen de Mensajes de Error

| messageId | Cuándo se dispara |
|-----------|-------------------|
| `requireDrift` | Un método async de Titan (directo o vía cualquier tipo de alias) se llama sin estar envuelto en `drift()` |

A diferencia de `drift-only-titan-async` que tiene 5 tipos de error, esta regla tiene un único mensaje de error. La lógica es más simple: si es async de Titan → debe tener drift.