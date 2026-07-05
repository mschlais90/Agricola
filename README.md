# Agricola — Family Game (digital)

A fan-made digital version of Uwe Rosenberg's **Agricola** using the official *Family game* rules
(base game without Occupation / Minor Improvement cards), for personal use.

- **Solo** — official solo rules (0 starting food, 3 food per adult, Forest gives 2 wood, goal 50 pts)
- **Hot-seat** — 2–4 players passing one device
- **WiFi multiplayer** — 2–4 players, each on their own phone/laptop browser, with room codes,
  automatic reconnection, and games that survive a server restart

All UI is original (CSS/SVG/emoji) — no copyrighted artwork.

## Quick start

```bash
npm install
npm run build
npm start
```

The server prints the address family members can open on your WiFi (plus a QR code), e.g.
`http://192.168.x.x:3000`. The first time, allow Node.js through the Windows Firewall when prompted
(Private networks is enough).

- **Hot-seat / solo** need no server logic — they run entirely in the browser.
- **WiFi games**: one person hosts (gets a 4-letter code), others join with the code.
  Closing a tab or a phone going to sleep is fine — reopening the page offers *Rejoin*.
  Unfinished games are stored in `packages/server/data/` and survive restarting the server.

## Development

```bash
npm run dev        # server on :3000 + Vite dev client on :5173
npm test           # engine unit tests + full-game simulations + server integration tests
npm run typecheck
```

To test multiplayer alone: open `http://localhost:5173` in two browser windows
(use a private window for the second so the sessions don't share a seat token).

## Hosting on the web later

The same artifact deploys anywhere Node runs — nothing changes in the code:

- **Docker**: `docker build -t agricola . && docker run -p 3000:3000 -v agricola-data:/data agricola`
- Or any Node host (Fly.io, Railway, a VPS): run `npm run build` and `npm start` with
  `PORT`/`HOST`/`DATA_DIR` env vars as needed. Put TLS in front (the platform proxy is fine —
  the client automatically uses `wss:` on `https:` pages).

## Architecture

```
packages/
├── engine/     pure TypeScript rules engine (no deps, runs in browser & Node, fully tested)
├── protocol/   WebSocket message types shared by client & server
├── server/     Node server: rooms, seat tokens, state broadcast, JSON persistence
└── client/     React UI; LocalTransport (hot-seat/solo) or WsTransport (WiFi) behind one interface
```

The engine is server-authoritative and deterministic (seeded shuffle at setup only), so the whole
game state serializes to JSON — that's what makes persistence, reconnection, and the future web
deployment trivial.

### Known rule substitution

The 3–4 player *Family game* action cards that replace the "Lessons" (Occupation) spaces aren't
documented in our sources; this build substitutes **"Materials Market" (1 building resource of
choice + 1 food)**. Adjust in `packages/engine/src/data/actionSpaces.ts` if you know the official
cards.
