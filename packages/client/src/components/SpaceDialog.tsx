import { useMemo, useState } from 'react';
import {
  IMPROVEMENTS,
  RULES,
  canBake,
  getActionSpaces,
  validateAction,
  type Crop,
  type EdgeRef,
  type GameAction,
  type GameState,
  type ImprovementDef,
  type SpaceChoices,
} from '@agricola/engine';
import { FarmGrid } from './FarmGrid';
import { costLines, costTooltip, isAffordable, shortfallText } from '../costs';
import { ICON, bagText } from '../ui';

export interface SpaceDialogProps {
  state: GameState;
  spaceId: string;
  onSubmit: (action: GameAction) => void;
  onCancel: () => void;
}

/**
 * Guided choice dialog for a selected action space. Simple spaces submit
 * immediately from GameView and never open this dialog.
 */
export function SpaceDialog({ state, spaceId, onSubmit, onCancel }: SpaceDialogProps) {
  const def = getActionSpaces(state.config).find((d) => d.id === spaceId)!;
  const player = state.players[state.currentPlayer]!;
  const [choices, setChoices] = useState<SpaceChoices>({});
  const [mode, setMode] = useState<'room' | 'stable'>('room'); // farmExpansion sub-mode

  // takeAnimalPool: the release count is derived, not user-entered.
  const effectiveChoices = useMemo<SpaceChoices>(() => {
    if (def.effect !== 'takeAnimalPool') return choices;
    const pool = state.actionSpaces[spaceId]!.pool as Record<string, number>;
    const total = (['sheep', 'boar', 'cattle'] as const).reduce((s, t) => s + (pool[t] ?? 0), 0);
    const keep = choices.animalKeep ?? 0;
    const cook = choices.animalCook ?? 0;
    return { ...choices, animalRelease: Math.max(0, total - keep - cook) };
  }, [choices, def.effect, spaceId, state]);

  const action: GameAction = {
    type: 'PLACE_WORKER',
    player: player.id,
    space: spaceId,
    choices: effectiveChoices,
  };
  const check = useMemo(() => validateAction(state, action), [state, spaceId, effectiveChoices]);

  const patch = (p: Partial<SpaceChoices>) => setChoices((c) => ({ ...c, ...p }));

  const toggleCell = (list: string[] | undefined, cell: string): string[] => {
    const cur = list ?? [];
    return cur.includes(cell) ? cur.filter((x) => x !== cell) : [...cur, cell];
  };

  const toggleEdge = (edge: EdgeRef) => {
    const cur = choices.edges ?? [];
    const same = (e: EdgeRef) => e.dir === edge.dir && e.row === edge.row && e.col === edge.col;
    patch({ edges: cur.some(same) ? cur.filter((e) => !same(e)) : [...cur, edge] });
  };

  const needsFarm =
    ['farmExpansion', 'plow', 'plowSow', 'sowBake', 'fences', 'renovationFences'].includes(def.effect);

  const selectedCells: { cell: string; kind: 'room' | 'stable' | 'field' | 'pick'; crop?: Crop }[] = [
    ...(choices.rooms ?? []).map((cell) => ({ cell, kind: 'room' as const })),
    ...(choices.stables ?? []).map((cell) => ({ cell, kind: 'stable' as const })),
    ...(choices.cell ? [{ cell: choices.cell, kind: 'pick' as const }] : []),
    ...(choices.sow ?? []).map((s) => ({ cell: s.cell, kind: 'field' as const, crop: s.crop })),
  ];

  const isEmptyField = (cell: string) => {
    const f = player.farm.fields[cell];
    return !!f && f.crop === null && f.count === 0;
  };
  const isPlowable = (cell: string) =>
    !player.farm.fields[cell] &&
    !player.farm.rooms.includes(cell) &&
    !player.farm.stables.includes(cell);

  /** Cycle a sowable cell's crop: empty → grain → vegetable → empty (skipping seeds you lack). */
  const cycleSow = (cell: string) => {
    const cur = choices.sow ?? [];
    const crop = cur.find((s) => s.cell === cell)?.crop ?? null;
    const seq: (Crop | null)[] = [null];
    if ((player.resources.grain ?? 0) > 0) seq.push('grain');
    if ((player.resources.vegetable ?? 0) > 0) seq.push('vegetable');
    const next = seq[(seq.indexOf(crop) + 1) % seq.length] ?? null;
    const without = cur.filter((s) => s.cell !== cell);
    patch({ sow: next ? [...without, { cell, crop: next }] : without });
  };

  const clearPlow = () =>
    setChoices((c) => ({ ...c, cell: undefined, sow: (c.sow ?? []).filter((s) => isEmptyField(s.cell)) }));

  const onCellClick = (cell: string) => {
    switch (def.effect) {
      case 'farmExpansion':
        if (mode === 'room') patch({ rooms: toggleCell(choices.rooms, cell) });
        else patch({ stables: toggleCell(choices.stables, cell) });
        return;
      case 'plow':
        if (!isPlowable(cell)) return;
        patch({ cell: choices.cell === cell ? undefined : cell });
        return;
      case 'plowSow': {
        // Tap an empty field or the freshly-plowed cell to cycle its crop;
        // tap any other empty cell to choose it as the field to plow.
        if (isEmptyField(cell) || choices.cell === cell) return cycleSow(cell);
        if (isPlowable(cell))
          setChoices((c) => ({
            ...c,
            cell,
            sow: (c.sow ?? []).filter((s) => isEmptyField(s.cell) || s.cell === cell),
          }));
        return;
      }
      case 'sowBake':
        if (isEmptyField(cell)) return cycleSow(cell);
        return;
      default:
        return;
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-3" onClick={onCancel}>
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-stone-800">{def.label}</h2>
        <p className="mb-2 text-xs text-stone-500">
          Your supply: {bagText(player.resources as Record<string, number>) || 'nothing'}
        </p>

        {def.effect === 'farmExpansion' && (
          <div className="mb-2 flex gap-2">
            <ModeButton active={mode === 'room'} onClick={() => setMode('room')}>
              🏠 Room ({RULES.costs.room[player.farm.roomMaterial]}
              {ICON[player.farm.roomMaterial]} + 2{ICON.reed})
            </ModeButton>
            <ModeButton active={mode === 'stable'} onClick={() => setMode('stable')}>
              🛖 Stable (2{ICON.wood})
            </ModeButton>
          </div>
        )}

        {(def.effect === 'sowBake' || def.effect === 'plowSow') && (
          <p className="mb-2 text-xs text-stone-500">
            {def.effect === 'plowSow' && 'Tap an empty cell to plow it. '}
            Tap a field to sow — each tap cycles empty → {ICON.grain} grain → {ICON.vegetable} vegetable →
            empty.
          </p>
        )}

        {(def.effect === 'fences' || def.effect === 'renovationFences') && (
          <p className="mb-2 text-xs text-stone-500">
            Tap edges to place fences (1{ICON.wood} each). Blue = valid, red = incomplete.
            {def.effect === 'renovationFences' && ' Renovation is paid first; fences are optional.'}
          </p>
        )}

        {needsFarm && (
          <FarmGrid
            farm={player.farm}
            selectedCells={selectedCells}
            proposedEdges={choices.edges ?? []}
            onCellClick={onCellClick}
            onEdgeClick={
              def.effect === 'fences' || def.effect === 'renovationFences' ? toggleEdge : undefined
            }
          />
        )}

        {def.effect === 'plowSow' && choices.cell && (
          <button onClick={clearPlow} className="mt-1 block text-xs text-stone-500 underline">
            Clear plowed field
          </button>
        )}

        {(def.effect === 'sowBake' || def.effect === 'plowSow') && (choices.sow?.length ?? 0) > 0 && (
          <div className="mt-2 flex flex-wrap gap-2 rounded-lg bg-stone-50 px-3 py-2 text-sm">
            <span className="font-medium text-stone-600">Planting:</span>
            {(['grain', 'vegetable'] as const).map((crop) => {
              const n = (choices.sow ?? []).filter((s) => s.crop === crop).length;
              if (n === 0) return null;
              return (
                <span key={crop} className="text-stone-700">
                  {ICON[crop]} {crop} ×{n}{' '}
                  <span className="text-stone-400">(uses {n} {crop})</span>
                </span>
              );
            })}
          </div>
        )}

        {(def.effect === 'dayLaborer' || def.effect === 'resourceChoice') && (
          <div className="flex gap-2">
            {(def.choices ?? (['wood', 'clay', 'reed', 'stone'] as const)).map((r) => (
              <ModeButton key={r} active={choices.resource === r} onClick={() => patch({ resource: r })}>
                {ICON[r]} {r}
              </ModeButton>
            ))}
          </div>
        )}

        {def.effect === 'takeAnimalPool' && (
          <AnimalDistribution state={state} spaceId={spaceId} choices={choices} patch={patch} />
        )}

        {(def.effect === 'majorImprovement' || def.effect === 'renovationImprovement') && (
          <ImprovementShop
            state={state}
            optional={def.effect === 'renovationImprovement'}
            choices={choices}
            patch={patch}
          />
        )}

        {(def.effect === 'sowBake' ||
          ((def.effect === 'majorImprovement' || def.effect === 'renovationImprovement') &&
            choices.improvement &&
            ['clay-oven', 'stone-oven'].includes(choices.improvement))) &&
          canBakeUI(state) && (
            <Stepper
              label={`Bake bread (${ICON.grain}→${ICON.food})`}
              value={choices.bakeGrain ?? 0}
              max={player.resources.grain ?? 0}
              onChange={(n) => patch({ bakeGrain: n || undefined })}
            />
          )}

        {def.effect === 'renovationImprovement' && (
          <p className="mt-2 text-xs text-stone-500">
            Renovation: {player.farm.rooms.length}
            {ICON[player.farm.roomMaterial === 'wood' ? 'clay' : 'stone']} + 1{ICON.reed}. Improvement is
            optional.
          </p>
        )}

        {!check.ok && hasAnyChoice(choices) && (
          <p className="mt-2 text-sm text-red-600">{check.message}</p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded-lg px-3 py-2 text-stone-500 hover:bg-stone-100" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="rounded-lg bg-amber-600 px-4 py-2 font-medium text-white disabled:bg-stone-300"
            disabled={!check.ok}
            onClick={() => onSubmit(action)}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );

  function canBakeUI(s: GameState): boolean {
    return canBake(s.players[s.currentPlayer]!) || ['clay-oven', 'stone-oven'].includes(choices.improvement ?? '');
  }
}

function hasAnyChoice(c: SpaceChoices): boolean {
  return Object.values(c).some((v) => v !== undefined);
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-sm ${
        active ? 'border-amber-500 bg-amber-100 font-medium' : 'border-stone-300 bg-white'
      }`}
    >
      {children}
    </button>
  );
}

function Stepper({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="mt-2 flex items-center justify-between rounded-lg border border-stone-200 px-3 py-2">
      <span className="text-sm">{label}</span>
      <span className="flex items-center gap-2">
        <StepBtn onClick={() => onChange(Math.max(0, value - 1))}>−</StepBtn>
        <span className="w-6 text-center font-medium">{value}</span>
        <StepBtn onClick={() => onChange(Math.min(max, value + 1))}>+</StepBtn>
      </span>
    </div>
  );
}

function StepBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="h-7 w-7 rounded-full border border-stone-300 text-lg leading-none">
      {children}
    </button>
  );
}

function AnimalDistribution({
  state,
  spaceId,
  choices,
  patch,
}: {
  state: GameState;
  spaceId: string;
  choices: SpaceChoices;
  patch: (p: Partial<SpaceChoices>) => void;
}) {
  const pool = state.actionSpaces[spaceId]!.pool as Record<string, number>;
  const type = (['sheep', 'boar', 'cattle'] as const).find((t) => (pool[t] ?? 0) > 0);
  const total = type ? pool[type]! : 0;
  const keep = choices.animalKeep ?? 0;
  const cook = choices.animalCook ?? 0;
  const release = total - keep - cook;
  return (
    <div>
      <p className="mb-1 text-sm">
        {total} {type && ICON[type]} to distribute:
      </p>
      <Stepper label={`Keep on farm`} value={keep} max={total - cook} onChange={(n) => patch({ animalKeep: n })} />
      <Stepper label={`Cook ${ICON.food}`} value={cook} max={total - keep} onChange={(n) => patch({ animalCook: n })} />
      <p className="mt-1 text-xs text-stone-500">Released (run away): {Math.max(0, release)}</p>
    </div>
  );
}

function ImprovementShop({
  state,
  optional,
  choices,
  patch,
}: {
  state: GameState;
  optional: boolean;
  choices: SpaceChoices;
  patch: (p: Partial<SpaceChoices>) => void;
}) {
  const player = state.players[state.currentPlayer]!;
  const res = player.resources as Record<string, number | undefined>;
  const affordable = (d: ImprovementDef) =>
    d.upgradeFrom?.some((f) => player.improvements.includes(f)) || isAffordable(d.cost, res);
  return (
    <div className="grid grid-cols-1 gap-1.5">
      {optional && (
        <button
          onClick={() => patch({ improvement: undefined, returnImprovement: undefined })}
          className={`rounded-lg border px-3 py-2 text-left text-sm ${
            !choices.improvement ? 'border-amber-500 bg-amber-50' : 'border-stone-200'
          }`}
        >
          No improvement — renovate only
        </button>
      )}
      {IMPROVEMENTS.filter((d) => (state.improvementSupply[d.id] ?? 0) > 0).map((d) => {
        const canUpgrade = d.upgradeFrom?.some((f) => player.improvements.includes(f));
        const selected = choices.improvement === d.id;
        const can = affordable(d);
        const tooltip = canUpgrade
          ? `${d.desc}\n\nCost: return a Fireplace instead of paying.`
          : `${d.desc}\n\n${costTooltip(d.cost, res)}`;
        return (
          <button
            key={d.id}
            title={tooltip}
            disabled={!can && !selected}
            onClick={() =>
              patch({
                improvement: selected ? undefined : d.id,
                returnImprovement:
                  !selected && canUpgrade ? d.upgradeFrom!.find((f) => player.improvements.includes(f)) : undefined,
              })
            }
            className={`rounded-lg border px-3 py-2 text-left text-sm ${
              selected
                ? 'border-amber-500 bg-amber-50'
                : can
                  ? 'border-stone-200 hover:bg-stone-50'
                  : 'border-stone-200 bg-stone-50 opacity-60'
            }`}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="font-medium">{d.label}</span>
              {/* Cost chips: each resource turns red when you're short of it. */}
              <span className="flex flex-wrap justify-end gap-1 whitespace-nowrap text-stone-500">
                {canUpgrade ? (
                  <span>↩ upgrade</span>
                ) : (
                  costLines(d.cost, res).map((l) => (
                    <span key={l.resource} className={l.short > 0 ? 'font-semibold text-red-600' : undefined}>
                      {l.need}
                      {ICON[l.resource] ?? l.resource}
                    </span>
                  ))
                )}
                <span className="text-stone-400">· {d.points}pt</span>
              </span>
            </span>
            <span className="mt-0.5 block text-xs leading-snug text-stone-500">{d.desc}</span>
            {!can && !canUpgrade && (
              <span className="mt-0.5 block text-xs font-medium text-red-500">
                Can't afford — {shortfallText(d.cost, res)} (have {bagText(res) || 'nothing'})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
