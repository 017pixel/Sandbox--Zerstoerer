#!/usr/bin/env node
/**
 * Lokaler Static-Server für Sandbox-Zerstörer.
 *
 * Liefert nur die Dateien aus, die auch in Produktion gebraucht werden.
 * Notizen, Tests, Werkzeuge und Quell-Doku bleiben unsichtbar. Das Verhalten
 * orientiert sich an Vercel: clean URLs, /landing-page als Ordnerroute,
 * no-cache für den Service Worker.
 */
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

function option(name, fallback) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  return args[index + 1] ?? fallback;
}

const port = Number(option('--port', process.env.PORT || 8080));
const quiet = args.includes('--quiet');
const devCacheBust = args.includes('--dev-cache-bust');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};
const LANDING_EXTENSIONS = new Set([
  '.html', '.js', '.css', '.json', '.png', '.webp', '.jpg', '.jpeg', '.svg',
  '.ico', '.woff2', '.txt', '.xml', '.mp4', '.webm',
]);
const ROOT_FILE = /^(index\.html|sb-[\w-]+\.(js|css)|sw\.js|manifest\.json|pwa-icon\.png|robots\.txt|sitemap\.xml)$/;

function isAllowed(relativePath) {
  if (ROOT_FILE.test(relativePath)) return true;
  if (relativePath.startsWith('assets/')) return true;
  if (relativePath.startsWith('landing-page/')) {
    return LANDING_EXTENSIONS.has(extname(relativePath).toLowerCase());
  }
  return false;
}

// Im Dev-Betrieb muss der Service Worker bei jeder Änderung neu installieren,
// sonst liefert er die zuvor gecachten Spieldateien aus. Der Cache-Name wird
// aus den Spiel-Dateien abgeleitet. Tests und Produktion nutzen den echten
// CACHE_NAME aus sw.js.
function devCacheName() {
  const files = [
    'index.html',
    'manifest.json',
    'pwa-icon.png',
    'sw.js',
    'assets/game.css',
    'assets/fonts/pixel.woff2',
    ...readdirSync(root).filter((file) => /^sb-.*\.(js|css)$/.test(file)),
  ];
  const hash = createHash('sha1');
  for (const file of files) {
    const path = join(root, file);
    if (!existsSync(path)) continue;
    const stat = statSync(path);
    hash.update(`${file}:${stat.size}:${stat.mtimeMs}`);
  }
  return `sandbox-dev-${hash.digest('hex').slice(0, 10)}`;
}

function send(res, status, message, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache',
    ...headers,
  });
  res.end(message);
}

const server = createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, 'Method not allowed', { Allow: 'GET, HEAD' });
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  } catch {
    send(res, 400, 'Bad request');
    return;
  }

  if (pathname === '/') pathname = '/index.html';
  if (pathname === '/landing-page') pathname = '/landing-page/index.html';
  if (pathname.endsWith('/')) pathname += 'index.html';

  const relativePath = pathname.replace(/^\/+/, '');
  if (relativePath.split('/').includes('..') || !isAllowed(relativePath)) {
    if (!quiet) console.log(`${req.method} ${pathname} 404`);
    send(res, 404, 'Nicht gefunden');
    return;
  }

  const file = resolve(join(root, relativePath));
  if (file !== root && !file.startsWith(root + sep)) {
    send(res, 403, 'Verboten');
    return;
  }
  if (!existsSync(file) || !statSync(file).isFile()) {
    if (!quiet) console.log(`${req.method} ${pathname} 404`);
    send(res, 404, 'Nicht gefunden');
    return;
  }

  const extension = extname(file).toLowerCase();
  const stat = statSync(file);
  const headers = {
    'Content-Type': MIME[extension] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Accept-Ranges': 'bytes',
  };

  if (devCacheBust && relativePath === 'sw.js') {
    const source = readFileSync(file, 'utf8');
    const body = Buffer.from(source.replace(
      /const CACHE_NAME = 'sandbox-v[^']+';/,
      `const CACHE_NAME = '${devCacheName()}';`,
    ));
    headers['Content-Length'] = body.length;
    res.writeHead(200, headers);
    if (!quiet) console.log(`${req.method} ${pathname} 200`);
    if (req.method === 'HEAD') res.end();
    else res.end(body);
    return;
  }

  const range = req.headers.range;
  if (range && /^bytes=\d*-\d*$/.test(range)) {
    const [rawStart, rawEnd] = range.replace('bytes=', '').split('-');
    let start;
    let end;
    if (!rawStart) {
      const suffixLength = Number(rawEnd);
      start = stat.size - suffixLength;
      end = stat.size - 1;
    } else {
      start = Number(rawStart);
      end = rawEnd ? Number(rawEnd) : stat.size - 1;
    }
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < 0 || start > end || start >= stat.size) {
      send(res, 416, 'Range not satisfiable', { 'Content-Range': `bytes */${stat.size}` });
      return;
    }
    end = Math.min(end, stat.size - 1);
    headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
    headers['Content-Length'] = end - start + 1;
    res.writeHead(206, headers);
    if (!quiet) console.log(`${req.method} ${pathname} 206`);
    if (req.method === 'HEAD') res.end();
    else createReadStream(file, { start, end }).pipe(res);
    return;
  }

  headers['Content-Length'] = stat.size;
  res.writeHead(200, headers);
  if (!quiet) console.log(`${req.method} ${pathname} 200`);
  if (req.method === 'HEAD') res.end();
  else createReadStream(file).pipe(res);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} ist belegt.`);
  } else {
    console.error(error.message);
  }
  process.exit(1);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Sandbox-Zerstörer Dev-Server: http://127.0.0.1:${port}/`);
  console.log(`Landingpage: http://127.0.0.1:${port}/landing-page`);
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
