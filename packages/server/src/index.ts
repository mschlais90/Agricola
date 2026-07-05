import http from 'node:http';
import os from 'node:os';
import { ENGINE_VERSION } from '@agricola/engine';
import { config } from './config.js';

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, engine: ENGINE_VERSION }));
    return;
  }
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('Agricola server (client serving arrives in M3)');
});

server.listen(config.port, config.host, () => {
  console.log(`Agricola server listening on port ${config.port}`);
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === 'IPv4' && !addr.internal) {
        console.log(`  LAN: http://${addr.address}:${config.port}  (${name})`);
      }
    }
  }
});
