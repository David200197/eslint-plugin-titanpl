export const TITAN_ALTERNATIVES = {
    fs: {
        alternative: 't.core.fs',
        description: 'File system operations'
    },
    path: {
        alternative: 't.core.path',
        description: 'Path manipulation utilities'
    },
    crypto: {
        alternative: 't.core.crypto',
        description: 'Cryptographic utilities (hash, uuid, randomBytes)'
    },
    os: {
        alternative: 't.core.os',
        description: 'Operating system information'
    },
    url: {
        alternative: 't.core.url',
        description: 'URL parsing and manipulation'
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
        description: 'Network utilities'
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
        alternative: null,
        description: 'Use standard ArrayBuffer/TypedArray instead'
    },
    querystring: {
        alternative: 't.core.url.SearchParams',
        description: 'Query string handling'
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