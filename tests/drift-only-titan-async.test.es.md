# Regla: `drift-only-titan-async` — Reporte de Tests

**Propósito de la regla:** Asegura que `drift()` se use **exclusivamente** con métodos async de Titan. Rechaza cualquier otro uso: métodos sync, funciones no-Titan, literales, referencias sin invocación, etc.

**Principio de error:** _"Si usas drift(), debe envolver una llamada async de Titan — nada más."_

---

## Casos Válidos (esperado: 0 errores)

### 1. Métodos async directos `t.*` con drift

```js
drift(t.fetch('/api'));
drift(t.core.fs.readFile('/file'));
drift(t.core.crypto.hash('data'));
drift(t.core.time.sleep(1000));
// ... 16 métodos en total
```

Verifica que todos los **métodos async del core** bajo `t.*` sean aceptados dentro de `drift()`. Cubre APIs de filesystem, crypto, network, time y session.

### 2. Métodos async `Titan.*` con drift

```js
drift(Titan.fetch('/api'));
drift(Titan.core.fs.readFile('/file'));
```

Misma validación pero usando el namespace `Titan` en lugar de `t`.

### 3. Métodos async de terceros con drift (node_modules)

```js
drift(t.ws.connect('wss://example.com'));
drift(t.db.query('SELECT 1'));
drift(t.auth.login('user', 'pass'));
drift(t.cache.get('key'));
```

Confirma que la regla reconoce métodos async de paquetes de terceros instalados en `node_modules/` (`titan-websocket`, `titan-database`, `titan-auth`, `@scope/titan-cache`).

### 4. Aliases async desestructurados con drift

```js
drift(fetch('/api'));       // const { fetch } = t;
drift(readFile('/file'));   // const { readFile } = t.core.fs;
drift(wsConnect('wss://…'));// const { connect: wsConnect } = t.ws;
```

Prueba que los aliases desestructurados (con o sin renombramiento) se resuelven correctamente a su método async original de Titan.

### 5. Aliases async de declare global con drift

```js
drift(globalFetch('/api'));     // declare global { const globalFetch: typeof t.fetch }
drift(globalReadFile('/file'));
drift(globalSleep(1000));
```

Valida aliases definidos mediante `declare global` en archivos `.d.ts`.

### 6. Aliases async exportados con drift

```js
drift(exportedFetch('/api'));   // export const exportedFetch = t.fetch;
drift(exportedDbQuery('SELECT 1'));
```

Valida aliases creados mediante asignaciones `export const`.

### 7. Aliases async por asignación simple con drift

```js
drift(myFetch('/api'));  // const myFetch = t.fetch;
drift(myHash('data'));   // const myHash = t.core.crypto.hash;
```

Valida aliases creados mediante asignaciones simples `const x = t.method`.

### 8. Aliases async por asignación de módulo con drift

```js
drift(db.query('SELECT 1'));   // const db = t.db;
drift(fs.readFile('/file'));   // const fs = t.core.fs;
```

Prueba el patrón de alias más complejo: una variable asignada a un módulo de Titan, y luego se llama un sub-método sobre ella. La regla debe resolver `db.query` → `t.db.query` y reconocerlo como async.

### 9. Aliases async por propiedades de objeto con drift

```js
drift(titanUtils.fetch('/api'));   // const titanUtils = { fetch: t.fetch }
drift(dbHelpers.query('SELECT 1'));// export const dbHelpers = { query: t.db.query }
```

Valida aliases almacenados como propiedades de objetos planos.

---

## Casos Inválidos (esperado: 1 error cada uno)

### 10. drift con métodos sync `t.*` → `driftNotForSyncMethods`

```js
drift(t.core.path.join('a', 'b'));
drift(t.core.url.parse('http://example.com'));
drift(t.core.crypto.uuid());
drift(t.core.os.platform());
drift(t.core.buffer.toBase64('hi'));
drift(t.core.time.now());
drift(t.log('msg'));
// ... 26 métodos en total
```

La afirmación central de esta regla: `drift()` no debe envolver métodos síncronos. Cubre path, url, crypto (subconjunto sync), os, buffer, time (subconjunto sync), proc, net, ls, cookies y log.

### 11. drift con métodos sync `Titan.*` → `driftNotForSyncMethods`

```js
drift(Titan.core.path.join('a', 'b'));
```

Misma verificación usando el namespace `Titan`.

### 12. drift con métodos sync de terceros → `driftNotForSyncMethods`

```js
drift(t.ws.isConnected());
drift(t.db.isConnected());
drift(t.auth.currentUser());
drift(t.cache.has('key'));
```

Los métodos sync de paquetes de terceros también se rechazan dentro de `drift()`.

### 13. drift con aliases sync desestructurados → `driftNotForSyncMethodsAlias`

```js
drift(pathJoin('a', 'b'));  // const { join: pathJoin } = t.core.path;
drift(log('message'));      // const { log } = t;
drift(uuid());              // const { uuid } = t.core.crypto;
drift(now());               // const { now } = t.core.time;
```

Detecta métodos sync incluso cuando se acceden mediante aliases desestructurados. Usa la variante de mensaje `driftNotForSyncMethodsAlias`.

### 14. drift con aliases sync de declare global → `driftNotForSyncMethodsAlias`

```js
drift(globalPathJoin('a', 'b'));
drift(globalLog('message'));
drift(globalNow());
```

Misma detección a través de aliases `declare global`.

### 15. drift con aliases sync exportados → `driftNotForSyncMethodsAlias`

```js
drift(exportedPathJoin('a', 'b'));
drift(exportedLog('message'));
```

Misma detección a través de aliases exportados.

### 16. drift con sub-métodos sync de alias de módulo → `driftNotForSyncMethods` o `driftNotForSyncMethodsAlias`

```js
drift(myPath.join('a', 'b'));  // const myPath = t.core.path;
drift(db.isConnected());      // const db = t.db;
```

Resuelve aliases de módulo y detecta que el sub-método llamado es síncrono.

### 17. drift con aliases sync de propiedad de objeto → `driftNotForSyncMethods` o `driftNotForSyncMethodsAlias`

```js
drift(titanUtils.join('a', 'b')); // const titanUtils = { join: t.core.path.join }
```

Aliases de propiedad de objeto que apuntan a métodos sync también se rechazan.

### 18. drift sin argumento → `driftRequiresArgument`

```js
drift();
```

`drift()` llamado sin argumentos es siempre un error.

### 19. drift con referencia a método (sin llamar) → `driftRequiresCall`

```js
drift(t.fetch);             // falta ()
drift(t.core.fs.readFile);  // falta ()
drift(Titan.fetch);         // falta ()
```

Pasar una referencia al método sin invocarlo. El argumento debe ser una **expresión de llamada**, no una expresión de miembro.

### 20. drift con referencia a alias (sin llamar) → `driftRequiresCall`

```js
drift(fetch);          // const { fetch } = t; — falta ()
drift(readFile);       // falta ()
drift(globalFetch);    // falta ()
drift(exportedFetch);  // falta ()
drift(myFetch);        // falta ()
```

Misma verificación para todos los tipos de alias: desestructurado, global, exportado y asignación simple.

### 21. drift con referencia de alias de módulo (sin llamar) → `driftRequiresCall`

```js
drift(db.query);  // const db = t.db; — falta ()
```

Expresión de miembro de alias de módulo sin invocación.

### 22. drift con función no-Titan → `driftOnlyForTitanAsync`

```js
drift(myFunction());
drift(console.log("test"));
drift(someModule.method());
drift(Math.random());
```

Cualquier llamada a función que no resuelva a un método de Titan se rechaza.

### 23. drift con variable desconocida → `driftOnlyForTitanAsync`

```js
drift(someVariable);
drift(unknownRef);
drift(promise);
```

Identificadores que no se reconocen como aliases de Titan.

### 24. drift con expresiones de función → `driftOnlyForTitanAsync`

```js
drift(() => {});
drift(function() {});
```

Funciones flecha y expresiones de función no son argumentos válidos de drift.

### 25. drift con literales → `driftOnlyForTitanAsync`

```js
drift('string');
drift(123);
drift(true);
drift(null);
```

Valores primitivos no son argumentos válidos de drift.

### 26. drift con objetos/arrays → `driftOnlyForTitanAsync`

```js
drift({});
drift([]);
```

Literales de objeto y array no son argumentos válidos de drift.

---

## Comportamiento de Fallback

### 27. Métodos Titan desconocidos → tratados como sync

```js
drift(t.unknown.newMethod());     // → driftNotForSyncMethods
drift(Titan.something.else());    // → driftNotForSyncMethods
```

Métodos que existen bajo `t.*` o `Titan.*` pero no se encuentran en el caché de `.d.ts` se **tratan como sync por defecto** y por lo tanto se rechazan dentro de `drift()`. Es un enfoque seguro por defecto.

---

## Casos Límite

### 28. Llamadas no-Titan desconocidas

```js
drift(unknownAlias());    // → driftOnlyForTitanAsync
drift(someLib.doStuff()); // → driftOnlyForTitanAsync
```

Funciones que no resuelven a ninguna ruta de Titan se rechazan con el mensaje genérico "drift es solo para async de Titan".

---

## Resumen de Mensajes de Error

| messageId | Cuándo se dispara |
|-----------|-------------------|
| `driftNotForSyncMethods` | `drift()` envuelve un método sync conocido de Titan (ruta directa) |
| `driftNotForSyncMethodsAlias` | `drift()` envuelve un método sync conocido de Titan (vía alias) |
| `driftRequiresArgument` | `drift()` llamado sin argumentos |
| `driftRequiresCall` | El argumento de `drift()` es una referencia, no una llamada a función |
| `driftOnlyForTitanAsync` | `drift()` envuelve una expresión no-Titan (función, literal, desconocido) |