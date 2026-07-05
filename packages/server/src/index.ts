import http from 'node:http';
import os from 'node:os';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { WebSocketServer } from 'ws';
import qrcode from 'qrcode-terminal';
import { ENGINE_VERSION } from '@agricola/engine';
import { config } from './config.js';
import { RoomManager } from './roomManager.js';
import { FileStore } from './store/GameStore.js';
import { attachWsHandler } from './wsHandler.js';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

// Built client (packages/client/dist). Present after `npm run build`; in dev
// the Vite server on :5173 serves the client instead.
const clientDist = findClientDist();

function findClientDist(): string | null {
  const candidates = [
    join(process.cwd(), '..', 'client', 'dist'),
    join(process.cwd(), 'packages', 'client', 'dist'),
  ];
  // __dirname exists in the CJS production bundle (dist/), not under ESM dev (tsx).
  if (typeof __dirname !== 'undefined') candidates.push(join(__dirname, '..', '..', 'client', 'dist'));
  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'index.html'))) return candidate;
  }
  return null;
}

const server = http.createServer((req, res) => {
  const url = (req.url ?? '/').split('?')[0]!;
  if (url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, engine: ENGINE_VERSION }));
    return;
  }
  if (!clientDist) {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('Agricola server running. Client not built — use the Vite dev server or run `npm run build`.');
    return;
  }
  // Static file serving with SPA fallback.
  const safePath = normalize(url).replace(/^([.][.][/\\])+/, '');
  let file = join(clientDist, safePath === '/' || safePath === '\\' ? 'index.html' : safePath);
  if (!file.startsWith(clientDist)) file = join(clientDist, 'index.html');
  if (!existsSync(file) || !statSync(file).isFile()) file = join(clientDist, 'index.html');
  try {
    const body = readFileSync(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(500);
    res.end('error');
  }
});

const store = new FileStore(config.dataDir);
const rooms = new RoomManager(store);
const wss = new WebSocketServer({ server, path: '/ws' });
attachWsHandler(wss, rooms);

server.listen(config.port, config.host, () => {
  console.log(`\nAgricola server listening on port ${config.port}`);
  if (!clientDist) console.log('  (client not built — dev mode: open http://localhost:5173)');
  const urls: string[] = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === 'IPv4' && !addr.internal) urls.push(`http://${addr.address}:${config.port}  (${name})`);
    }
  }
  if (urls.length) {
    console.log('  Family members on your WiFi can open:');
    for (const u of urls) console.log(`    ${u}`);
    const first = urls[0]!.split(' ')[0]!;
    console.log('\n  Or scan with a phone:');
    qrcode.generate(first, { small: true }, (qr) => console.log(qr.replace(/^/gm, '    ')));
  }
});
