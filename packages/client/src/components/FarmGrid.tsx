import {
  FARM_COLS,
  FARM_ROWS,
  RULES,
  cellKey,
  computeAssignment,
  computePastures,
  type AnimalType,
  type Crop,
  type EdgeRef,
  type Farm,
} from '@agricola/engine';
import { ICON } from '../ui';

const CELL = 100;
const W = FARM_COLS * CELL;
const H = FARM_ROWS * CELL;

export interface FarmGridProps {
  farm: Farm;
  /** Cells highlighted as selected (e.g. rooms/stables being planned; `crop` previews a sow). */
  selectedCells?: { cell: string; kind: 'room' | 'stable' | 'field' | 'pick'; crop?: Crop }[];
  /** Proposed fence edges (fence editor). */
  proposedEdges?: EdgeRef[];
  onCellClick?: (cell: string) => void;
  /** When set, edge hit-targets are rendered (fence editor mode). */
  onEdgeClick?: (edge: EdgeRef) => void;
  className?: string;
}

const MATERIAL_FILL: Record<string, string> = {
  wood: '#a16207',
  clay: '#c2410c',
  stone: '#6b7280',
};

export function FarmGrid({
  farm,
  selectedCells = [],
  proposedEdges = [],
  onCellClick,
  onEdgeClick,
  className,
}: FarmGridProps) {
  // Preview farm including proposed fences for pasture tinting.
  const preview: Farm = proposedEdges.length
    ? JSON.parse(JSON.stringify(farm))
    : farm;
  for (const e of proposedEdges) {
    (e.dir === 'h' ? preview.fencesH : preview.fencesV)[e.row]![e.col] = true;
  }
  const pastureResult = computePastures(preview);
  const pastures = 'error' in pastureResult ? [] : pastureResult.pastures;
  const layoutValid = !('error' in pastureResult);
  const previewForAnimals = { ...preview, pastures };
  const assignment = layoutValid ? computeAssignment(previewForAnimals, farm.animals) : null;

  const pastureCellTint = new Map<string, number>();
  pastures.forEach((p, i) => p.cells.forEach((c) => pastureCellTint.set(c, i)));

  const selected = new Map(selectedCells.map((s) => [s.cell, s]));

  const cells = [];
  for (let r = 0; r < FARM_ROWS; r++) {
    for (let c = 0; c < FARM_COLS; c++) {
      const key = cellKey(r, c);
      const x = c * CELL;
      const y = r * CELL;
      const isRoom = farm.rooms.includes(key);
      const field = farm.fields[key];
      const isStable = farm.stables.includes(key);
      const inPasture = pastureCellTint.has(key);
      const sel = selected.get(key);
      const sowing = sel?.kind === 'field' ? sel.crop : undefined;

      let fill = '#f5f0e6';
      if (isRoom) fill = MATERIAL_FILL[farm.roomMaterial]!;
      else if (field) fill = '#92652e';
      else if (inPasture) fill = '#bbe3b0';
      if (sel?.kind === 'room') fill = '#eab308';
      if (sel?.kind === 'stable') fill = '#f97316';
      if (sel?.kind === 'pick') fill = '#fde047';
      if (sel?.kind === 'field') fill = sowing === 'vegetable' ? '#fb923c' : sowing === 'grain' ? '#facc15' : '#b45309';

      let content: string | null = null;
      if (isRoom) content = '🏠';
      else if (field) content = field.crop ? `${ICON[field.crop]}×${field.count}` : '🟫';
      // Preview the crop being sown this turn, with the count the field will hold.
      if (sowing) content = `${ICON[sowing]}×${RULES.sow[sowing]}`;

      // Cells being planted/plowed this turn get a dashed accent border.
      const pending = sel?.kind === 'field' || sel?.kind === 'pick';
      cells.push(
        <g key={key} onClick={onCellClick ? () => onCellClick(key) : undefined} style={onCellClick ? { cursor: 'pointer' } : undefined}>
          <rect
            x={x + 2}
            y={y + 2}
            width={CELL - 4}
            height={CELL - 4}
            rx={6}
            fill={fill}
            stroke={pending ? '#166534' : '#d6cdb8'}
            strokeWidth={pending ? 3 : 1}
            strokeDasharray={pending ? '6 4' : undefined}
          />
          {content && (
            <text x={x + CELL / 2} y={y + CELL / 2 + (isStable ? -12 : 0)} textAnchor="middle" dominantBaseline="central" fontSize={field || sowing ? 24 : 34}>
              {content}
            </text>
          )}
          {isStable && (
            <text x={x + CELL / 2} y={y + CELL - 22} textAnchor="middle" fontSize={22}>
              🛖
            </text>
          )}
        </g>,
      );
    }
  }

  // Animals per pasture / stable / pet from the computed display assignment.
  const animalLabels: { x: number; y: number; text: string }[] = [];
  if (assignment) {
    for (const p of assignment.pastures) {
      if (!p.type || p.count === 0) continue;
      const { row, col } = parse(p.cells[0]!);
      animalLabels.push({ x: col * CELL + CELL / 2, y: row * CELL + 30, text: `${ICON[p.type]}×${p.count}` });
    }
    for (const s of assignment.stables) {
      if (!s.type) continue;
      const { row, col } = parse(s.cell);
      animalLabels.push({ x: col * CELL + CELL / 2, y: row * CELL + 30, text: ICON[s.type]! });
    }
    if (assignment.pet) {
      const { row, col } = parse(farm.rooms[0]!);
      animalLabels.push({ x: col * CELL + CELL - 22, y: row * CELL + 22, text: ICON[assignment.pet]! });
    }
  }

  // Fences: existing (dark) + proposed (blue). Edge hit targets in edit mode.
  const fenceLines = [];
  const proposedSet = new Set(proposedEdges.map((e) => `${e.dir}:${e.row}:${e.col}`));
  for (let r = 0; r <= FARM_ROWS; r++) {
    for (let c = 0; c < FARM_COLS; c++) {
      const built = farm.fencesH[r]?.[c];
      const proposed = proposedSet.has(`h:${r}:${c}`);
      if (built || proposed) {
        fenceLines.push(
          <line key={`h${r}${c}`} x1={c * CELL + 4} y1={r * CELL} x2={(c + 1) * CELL - 4} y2={r * CELL}
            stroke={proposed ? (layoutValid ? '#2563eb' : '#dc2626') : '#3f2d16'} strokeWidth={7} strokeLinecap="round" />,
        );
      }
    }
  }
  for (let r = 0; r < FARM_ROWS; r++) {
    for (let c = 0; c <= FARM_COLS; c++) {
      const built = farm.fencesV[r]?.[c];
      const proposed = proposedSet.has(`v:${r}:${c}`);
      if (built || proposed) {
        fenceLines.push(
          <line key={`v${r}${c}`} x1={c * CELL} y1={r * CELL + 4} x2={c * CELL} y2={(r + 1) * CELL - 4}
            stroke={proposed ? (layoutValid ? '#2563eb' : '#dc2626') : '#3f2d16'} strokeWidth={7} strokeLinecap="round" />,
        );
      }
    }
  }

  const edgeTargets = [];
  if (onEdgeClick) {
    for (let r = 0; r <= FARM_ROWS; r++) {
      for (let c = 0; c < FARM_COLS; c++) {
        if (farm.fencesH[r]?.[c]) continue; // built fences cannot be removed
        edgeTargets.push(
          <rect key={`eh${r}${c}`} x={c * CELL + 10} y={r * CELL - 11} width={CELL - 20} height={22}
            fill="transparent" style={{ cursor: 'pointer' }}
            onClick={() => onEdgeClick({ dir: 'h', row: r, col: c })} />,
        );
      }
    }
    for (let r = 0; r < FARM_ROWS; r++) {
      for (let c = 0; c <= FARM_COLS; c++) {
        if (farm.fencesV[r]?.[c]) continue;
        edgeTargets.push(
          <rect key={`ev${r}${c}`} x={c * CELL - 11} y={r * CELL + 10} width={22} height={CELL - 20}
            fill="transparent" style={{ cursor: 'pointer' }}
            onClick={() => onEdgeClick({ dir: 'v', row: r, col: c })} />,
        );
      }
    }
  }

  return (
    <svg viewBox={`-8 -8 ${W + 16} ${H + 16}`} className={className} style={{ width: '100%', height: 'auto' }}>
      <rect x={-6} y={-6} width={W + 12} height={H + 12} rx={10} fill="#e7dcc3" />
      {cells}
      {animalLabels.map((a, i) => (
        <text key={i} x={a.x} y={a.y} textAnchor="middle" fontSize={20}>
          {a.text}
        </text>
      ))}
      {fenceLines}
      {edgeTargets}
    </svg>
  );
}

function parse(key: string): { row: number; col: number } {
  const [r, c] = key.split(',').map(Number);
  return { row: r!, col: c! };
}
