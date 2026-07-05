import { RULES, type GameState } from '@agricola/engine';
import { useGameStore } from '../store/gameStore';
import { PLAYER_COLORS } from '../ui';

export function ScoringView({ state }: { state: GameState }) {
  const quitToLobby = useGameStore((s) => s.quitToLobby);
  const scores = state.scores ?? [];
  const best = Math.max(...scores.map((s) => s.total));
  const solo = state.config.variant === 'solo';

  const labels = scores[0]?.categories.map((c) => c.label) ?? [];

  return (
    <div className="min-h-screen bg-stone-100 p-4">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow">
        <h1 className="text-center text-2xl font-bold">🏁 Final Scores</h1>
        {solo ? (
          <p className="mb-4 text-center text-stone-500">
            Solo goal: {RULES.soloGoal} points — {best >= RULES.soloGoal ? 'reached! 🎉' : 'not reached'}
          </p>
        ) : (
          <p className="mb-4 text-center text-stone-500">
            Winner: <b>{scores.filter((s) => s.total === best).map((s) => s.name).join(' & ')}</b> 🎉
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="py-1 pr-2 text-left text-stone-500">Category</th>
                {scores.map((s) => (
                  <th key={s.player} className="px-2 py-1 text-right" style={{ color: PLAYER_COLORS[s.player] }}>
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {labels.map((label) => (
                <tr key={label} className="border-t border-stone-100">
                  <td className="py-1 pr-2 text-stone-600">{label}</td>
                  {scores.map((s) => {
                    const cat = s.categories.find((c) => c.label === label);
                    return (
                      <td key={s.player} className="px-2 py-1 text-right tabular-nums">
                        {cat ? (
                          <>
                            <span className={cat.points < 0 ? 'text-red-600' : ''}>{cat.points}</span>
                            {cat.detail && <span className="ml-1 text-xs text-stone-400">({cat.detail})</span>}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-t-2 border-stone-300 font-bold">
                <td className="py-2 pr-2">Total</td>
                {scores.map((s) => (
                  <td key={s.player} className="px-2 py-2 text-right text-lg tabular-nums">
                    {s.total}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <button
          onClick={quitToLobby}
          className="mt-6 w-full rounded-lg bg-amber-600 px-4 py-3 font-semibold text-white hover:bg-amber-700"
        >
          Back to lobby
        </button>
      </div>
    </div>
  );
}
