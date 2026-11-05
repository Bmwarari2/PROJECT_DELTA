/*
 * Tiny zero-dependency static file server for the Delta Multiholding website.
 * - Serves ./public with clean URLs (/about -> about.html)
 * - Redirects *.html and /index to their clean form
 * - Brotli / gzip compression for text assets (cached in memory)
 * - ETag + Cache-Control headers, custom 404 page, /healthz endpoint
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.join(__dirname, 'public');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};
const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.json', '.svg', '.txt', '.xml', '.webmanifest']);

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

// path -> { mtimeMs, raw, br, gzip, etag }
const cache = new Map();

function load(file, stat) {
  const hit = cache.get(file);
  if (hit && hit.mtimeMs === stat.mtimeMs) return hit;
  const raw = fs.readFileSync(file);
  const ext = path.extname(file).toLowerCase();
  const entry = {
    mtimeMs: stat.mtimeMs,
    raw,
    etag: `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`,
    br: null,
    gzip: null,
  };
  if (COMPRESSIBLE.has(ext) && raw.length > 512) {
    entry.br = zlib.brotliCompressSync(raw, {
      params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 },
    });
    entry.gzip = zlib.gzipSync(raw, { level: 9 });
  }
  cache.set(file, entry);
  return entry;
}

function statFile(file) {
  try {
    const s = fs.statSync(file);
    return s.isFile() ? s : null;
  } catch {
    return null;
  }
}

/** Map a URL pathname to a file inside ROOT, or null. */
function resolve(pathname) {
  const clean = path.posix.normalize(pathname);
  const candidates = clean.endsWith('/')
    ? [clean + 'index.html']
    : [clean, clean + '.html', clean + '/index.html'];
  for (const c of candidates) {
    const abs = path.join(ROOT, c);
    if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) continue; // traversal guard
    const s = statFile(abs);
    if (s) return { file: abs, stat: s };
  }
  return null;
}

function send(req, res, status, file, stat, extraHeaders = {}) {
  const ext = path.extname(file).toLowerCase();
  const entry = load(file, stat);
  const headers = {
    ...SECURITY_HEADERS,
    'Content-Type': TYPES[ext] || 'application/octet-stream',
    'Cache-Control':
      ext === '.html' ? 'no-cache' : 'public, max-age=604800, stale-while-revalidate=86400',
    ETag: entry.etag,
    Vary: 'Accept-Encoding',
    ...extraHeaders,
  };

  if (status === 200 && req.headers['if-none-match'] === entry.etag) {
    res.writeHead(304, headers);
    return res.end();
  }

  let body = entry.raw;
  const accept = String(req.headers['accept-encoding'] || '');
  if (entry.br && /\bbr\b/.test(accept)) {
    body = entry.br;
    headers['Content-Encoding'] = 'br';
  } else if (entry.gzip && /\bgzip\b/.test(accept)) {
    body = entry.gzip;
    headers['Content-Encoding'] = 'gzip';
  }
  headers['Content-Length'] = body.length;
  res.writeHead(status, headers);
  res.end(req.method === 'HEAD' ? undefined : body);
}

function notFound(req, res) {
  const file = path.join(ROOT, '404.html');
  const s = statFile(file);
  if (s) return send(req, res, 404, file, s);
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end();
  }

  let url;
  let pathname;
  try {
    url = new URL(req.url, 'http://localhost');
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400);
    return res.end('Bad request');
  }
  if (pathname.includes('\0')) {
    res.writeHead(400);
    return res.end('Bad request');
  }

  if (pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
    return res.end('ok');
  }

  // Canonical clean URLs: /about.html -> /about, /index(.html) -> /
  const canonical = pathname.replace(/\/index(\.html)?$/, '/').replace(/\.html$/, '');
  if (canonical !== pathname && pathname !== '/404.html') {
    res.writeHead(301, { Location: canonical + url.search });
    return res.end();
  }

  const hit = resolve(pathname);
  if (!hit) return notFound(req, res);
  return send(req, res, 200, hit.file, hit.stat);
});

server.listen(PORT, () => {
  console.log(`Delta website listening on port ${PORT}`);
});

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => server.close(() => process.exit(0)));
}
