export const TITAN_ALTERNATIVES = {
    fs: {
        alternative: 't.core.fs',
        description: 'File system operations (readFile, writeFile, exists, mkdir, remove, readdir, stat)'
    },
    path: {
        alternative: 't.core.path',
        description: 'Path manipulation utilities (join, resolve, dirname, basename, extname)'
    },
    crypto: {
        alternative: 't.core.crypto',
        description: 'Cryptographic utilities (hash, uuid, randomBytes, encrypt, decrypt, hashKeyed, compare)'
    },
    os: {
        alternative: 't.core.os',
        description: 'Operating system information (platform, cpus, totalMemory, freeMemory, tmpdir)'
    },
    url: {
        alternative: 't.core.url',
        description: 'URL parsing and manipulation (parse, format, SearchParams)'
    },
    timers: {
        alternative: 't.core.time',
        description: 'Time utilities (sleep, now, timestamp)'
    },
    process: {
        alternative: 't.core.proc',
        description: 'Process information (pid, uptime)'
    },
    dns: {
        alternative: 't.core.net.resolveDNS()',
        description: 'DNS resolution'
    },
    net: {
        alternative: 't.core.net',
        description: 'Network utilities (resolveDNS, ip)'
    },
    http: {
        alternative: 't.fetch()',
        description: 'HTTP client via Titan fetch API'
    },
    https: {
        alternative: 't.fetch()',
        description: 'HTTPS client via Titan fetch API'
    },
    buffer: {
        alternative: 't.core.buffer',
        description: 'Buffer utilities (fromBase64, toBase64, fromHex, toHex, fromUtf8, toUtf8)'
    },
    querystring: {
        alternative: 't.core.url.SearchParams',
        description: 'Query string handling'
    },
    localStorage: {
        alternative: 't.core.ls or [super-ls](https://github.com/David200197/super-ls)',
        description: 'Persistent key-value storage via Sled (get, set, remove, clear, keys)',
        titanOnly: true
    },
    session: {
        alternative: 't.core.session',
        description: 'Server-side session management (get, set, delete, clear)',
        titanOnly: true
    },
    cookies: {
        alternative: 't.core.cookies',
        description: 'HTTP cookie parsing and serialization (get, set, delete)',
        titanOnly: true
    },
    assert: null,
    async_hooks: null,
    child_process: null,
    cluster: null,
    dgram: null,
    events: null,
    module: null,
    perf_hooks: null,
    punycode: null,
    readline: null,
    stream: null,
    string_decoder: null,
    tls: null,
    tty: null,
    util: null,
    v8: null,
    vm: null,
    worker_threads: null,
    zlib: null
};