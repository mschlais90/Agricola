import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { hasSavedLocalGame } from '../transport/LocalTransport';

export function LobbyView() {
  const startLocal = useGameStore((s) => s.startLocal);
  const resumeLocal = useGameStore((s) => s.resumeLocal);
  const [count, setCount] = useState(2);
  const [names, setNames] = useState(['', '', '', '']);
  const [solo, setSolo] = useState(false);
  const canResume = hasSavedLocalGame();

  const start = () => {
    startLocal({
      playerCount: solo ? 1 : count,
      playerNames: (solo ? [names[0] || 'Farmer'] : names.slice(0, count)).map(
        (n, i) => n.trim() || `Player ${i + 1}`,
      ),
      variant: solo ? 'solo' : 'family',
      rngSeed: Math.floor(Math.random() * 2 ** 31),
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-100 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow">
        <h1 className="text-center text-3xl font-bold text-stone-800">🌾 Agricola</h1>
        <p className="mb-6 text-center text-sm text-stone-500">Family game · hot-seat on this device</p>

        {canResume && (
          <button
            onClick={() => resumeLocal()}
            className="mb-4 w-full rounded-lg border border-amber-500 bg-amber-50 px-4 py-3 font-medium text-amber-800 hover:bg-amber-100"
          >
            ▶ Resume saved game
          </button>
        )}

        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setSolo(false)}
            className={`flex-1 rounded-lg border px-3 py-2 ${!solo ? 'border-amber-500 bg-amber-100 font-medium' : 'border-stone-300'}`}
          >
            Multiplayer
          </button>
          <button
            onClick={() => setSolo(true)}
            className={`flex-1 rounded-lg border px-3 py-2 ${solo ? 'border-amber-500 bg-amber-100 font-medium' : 'border-stone-300'}`}
          >
            Solo
          </button>
        </div>

        {!solo && (
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

        <div className="mb-6 space-y-2">
          {Array.from({ length: solo ? 1 : count }, (_, i) => (
            <input
              key={i}
              value={names[i]}
              onChange={(e) => setNames((ns) => ns.map((n, j) => (j === i ? e.target.value : n)))}
              placeholder={`Player ${i + 1} name`}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-amber-500 focus:outline-none"
            />
          ))}
        </div>

        {solo && (
          <p className="mb-4 rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-500">
            Official solo rules: start with 0 food, adults eat 3 food per harvest, the Forest yields only
            2 wood. Goal: 50+ points.
          </p>
        )}

        <button
          onClick={start}
          className="w-full rounded-lg bg-amber-600 px-4 py-3 font-semibold text-white hover:bg-amber-700"
        >
          Start game
        </button>
      </div>
    </div>
  );
}
