import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { PLAYER_COLORS } from '../ui';

/**
 * Copy helper that also works on plain-http LAN origins (http://192.168.x.x),
 * where `navigator.clipboard` is unavailable because it requires a secure context.
 */
function copyText(text: string): boolean {
  if (navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(text).catch(() => {});
    return true;
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** Networked game waiting room (before all seats are filled). */
export function RoomLobbyView() {
  const roomLobby = useGameStore((s) => s.roomLobby);
  const connection = useGameStore((s) => s.connection);
  const error = useGameStore((s) => s.error);
  const quitToLobby = useGameStore((s) => s.quitToLobby);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  const flashCopied = (what: 'code' | 'link', text: string) => {
    if (copyText(text)) {
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    }
  };

  const joined = roomLobby?.seats.length ?? 0;
  const remaining = (roomLobby?.playerCount ?? 0) - joined;

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-100 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow">
        {roomLobby ? (
          <>
            <h1 className="text-xl font-bold text-stone-800">
              {remaining > 0
                ? `Waiting for ${remaining} more player${remaining === 1 ? '' : 's'}…`
                : 'Starting game…'}
            </h1>

            <p className="mt-5 text-sm text-stone-500">Others on your WiFi join with code</p>
            <div className="my-1 text-6xl font-black tracking-[0.2em] text-amber-600">
              {roomLobby.roomCode}
            </div>
            <button
              onClick={() => flashCopied('code', roomLobby.roomCode)}
              className="mb-4 text-xs font-medium text-amber-700 underline-offset-2 hover:underline"
            >
              {copied === 'code' ? '✓ Copied' : 'Copy code'}
            </button>

            <div className="rounded-lg bg-stone-50 px-3 py-3 text-left">
              <p className="text-xs text-stone-500">They first open this address in a browser:</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 break-all font-mono text-sm text-stone-700">
                  {location.origin}
                </code>
                <button
                  onClick={() => flashCopied('link', location.origin)}
                  className="shrink-0 rounded border border-stone-300 px-2 py-1 text-xs text-stone-600 hover:bg-white"
                >
                  {copied === 'link' ? '✓' : 'Copy'}
                </button>
              </div>
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
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ background: PLAYER_COLORS[i] }}
                    />
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
            <p className="mt-4 text-xs text-stone-400">
              The game starts automatically when everyone has joined — keep this screen open.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-stone-800">
              {connection === 'connected' ? 'Setting up the room…' : 'Connecting to the server…'}
            </h1>
            <p className="mt-3 text-sm text-stone-500">Your room code will appear here in a moment.</p>
          </>
        )}
        {error && <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <button onClick={quitToLobby} className="mt-5 text-sm text-stone-400 hover:text-stone-600">
          ← Back
        </button>
      </div>
    </div>
  );
}
