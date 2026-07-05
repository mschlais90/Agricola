import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { hasSavedLocalGame } from '../transport/LocalTransport';
import { savedWsSession } from '../transport/WsTransport';

type Mode = 'hotseat' | 'solo' | 'online';

export function LobbyView() {
  const startLocal = useGameStore((s) => s.startLocal);
  const resumeLocal = useGameStore((s) => s.resumeLocal);
  const hostOnline = useGameStore((s) => s.hostOnline);
  const joinOnline = useGameStore((s) => s.joinOnline);
  const rejoinOnline = useGameStore((s) => s.rejoinOnline);

  const [mode, setMode] = useState<Mode>('hotseat');
  const [count, setCount] = useState(2);
  const [names, setNames] = useState(['', '', '', '']);
  const [myName, setMyName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const canResumeLocal = hasSavedLocalGame();
  const wsSession = savedWsSession();

  const startHotseatOrSolo = () => {
    const solo = mode === 'solo';
    startLocal({
      playerCount: solo ? 1 : count,
      playerNames: (solo ? [names[0] || 'Farmer'] : names.slice(0, count)).map(
        (n, i) => n.trim() || `Player ${i + 1}`,
      ),
      variant: solo ? 'solo' : 'family',
      rngSeed: Math.floor(Math.random() * 2 ** 31),
    });
  };

  const host = () => {
    hostOnline(
      {
        playerCount: count,
        playerNames: [],
        variant: 'family',
        rngSeed: Math.floor(Math.random() * 2 ** 31),
      },
      myName.trim() || 'Host',
    );
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-100 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow">
        <h1 className="text-center text-3xl font-bold text-stone-800">🌾 Agricola</h1>
        <p className="mb-5 text-center text-sm text-stone-500">Family game edition</p>

        {canResumeLocal && (
          <button
            onClick={() => resumeLocal()}
            className="mb-3 w-full rounded-lg border border-amber-500 bg-amber-50 px-4 py-3 font-medium text-amber-800 hover:bg-amber-100"
          >
            ▶ Resume device game
          </button>
        )}
        {wsSession && (
          <button
            onClick={() => rejoinOnline()}
            className="mb-3 w-full rounded-lg border border-blue-500 bg-blue-50 px-4 py-3 font-medium text-blue-800 hover:bg-blue-100"
          >
            ▶ Rejoin online game {wsSession.roomCode} as {wsSession.name}
          </button>
        )}

        <div className="mb-4 grid grid-cols-3 gap-2">
          {(
            [
              ['hotseat', 'One device'],
              ['online', 'WiFi'],
              ['solo', 'Solo'],
            ] as [Mode, string][]
          ).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-lg border px-2 py-2 text-sm ${
                mode === m ? 'border-amber-500 bg-amber-100 font-medium' : 'border-stone-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode !== 'solo' && (
          <div className="mb-4">
            <label className="mb-1 block text-sm text-stone-600">Players</label>
            <div className="flex gap-2">
              {[2, 3, 4].map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={`h-10 w-10 rounded-lg border ${count === n ? 'border-amber-500 bg-amber-100 font-bold' : 'border-stone-300'}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === 'hotseat' && (
          <div className="mb-5 space-y-2">
            {Array.from({ length: count }, (_, i) => (
              <input
                key={i}
                value={names[i]}
                onChange={(e) => setNames((ns) => ns.map((n, j) => (j === i ? e.target.value : n)))}
                placeholder={`Player ${i + 1} name`}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-amber-500 focus:outline-none"
              />
            ))}
          </div>
        )}

        {mode === 'solo' && (
          <div className="mb-5">
            <input
              value={names[0]}
              onChange={(e) => setNames((ns) => ns.map((n, j) => (j === 0 ? e.target.value : n)))}
              placeholder="Your name"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-amber-500 focus:outline-none"
            />
            <p className="mt-3 rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-500">
              Official solo rules: start with 0 food, adults eat 3 food per harvest, the Forest yields
              only 2 wood. Goal: 50+ points.
            </p>
          </div>
        )}

        {mode !== 'online' ? (
          <button
            onClick={startHotseatOrSolo}
            className="w-full rounded-lg bg-amber-600 px-4 py-3 font-semibold text-white hover:bg-amber-700"
          >
            Start game
          </button>
        ) : (
          <div className="space-y-4">
            <input
              value={myName}
              onChange={(e) => setMyName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-amber-500 focus:outline-none"
            />
            <button
              onClick={host}
              className="w-full rounded-lg bg-amber-600 px-4 py-3 font-semibold text-white hover:bg-amber-700"
            >
              Host new game ({count} players)
            </button>
            <div className="flex items-center gap-2">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="CODE"
                maxLength={4}
                className="w-28 rounded-lg border border-stone-300 px-3 py-2 text-center font-mono text-lg tracking-widest focus:border-amber-500 focus:outline-none"
              />
              <button
                onClick={() => joinCode.length === 4 && joinOnline(joinCode, myName.trim() || 'Guest')}
                disabled={joinCode.length !== 4}
                className="flex-1 rounded-lg border border-amber-600 px-4 py-2.5 font-semibold text-amber-700 hover:bg-amber-50 disabled:border-stone-300 disabled:text-stone-400"
              >
                Join game
              </button>
            </div>
            <p className="text-xs text-stone-400">
              Everyone must be on the same WiFi and open this page from the address shown in the server
              window.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
