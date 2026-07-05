import { useGameStore } from '../store/gameStore';
import { PLAYER_COLORS } from '../ui';

/** Networked game waiting room (before all seats are filled). */
export function RoomLobbyView() {
  const roomLobby = useGameStore((s) => s.roomLobby);
  const connection = useGameStore((s) => s.connection);
  const error = useGameStore((s) => s.error);
  const quitToLobby = useGameStore((s) => s.quitToLobby);

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-100 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow">
        <h1 className="text-xl font-bold text-stone-800">Waiting for players…</h1>
        {roomLobby ? (
          <>
            <p className="mt-4 text-sm text-stone-500">Others on your WiFi join with code</p>
            <div className="my-2 text-5xl font-black tracking-[0.3em] text-amber-600">
              {roomLobby.roomCode}
            </div>
            <div className="mt-5 space-y-2">
              {Array.from({ length: roomLobby.playerCount }, (_, i) => {
                const seat = roomLobby.seats[i];
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left ${
                      seat ? 'border-stone-200' : 'border-dashed border-stone-300 text-stone-400'
                    }`}
                  >
                    <span className="inline-block h-3 w-3 rounded-full" style={{ background: PLAYER_COLORS[i] }} />
                    {seat ? (
                      <>
                        <span className="font-medium">{seat.name}</span>
                        {!seat.connected && <span className="text-xs text-red-500">disconnected</span>}
                      </>
                    ) : (
                      <span>waiting…</span>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-xs text-stone-400">The game starts automatically when everyone has joined.</p>
          </>
        ) : (
          <p className="mt-4 text-stone-500">{connection === 'connected' ? 'Joining…' : 'Connecting…'}</p>
        )}
        {error && <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <button onClick={quitToLobby} className="mt-5 text-sm text-stone-400 hover:text-stone-600">
          ← Back
        </button>
      </div>
    </div>
  );
}
