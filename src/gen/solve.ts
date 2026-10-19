import { Game, type LevelRules } from '../core/game';

export type SolveResult = 'solvable' | 'unsolvable' | 'unknown';

function key(g: Game): string {
  const slots = g.slots.map((s) => (s ? `${String(s.colour)}:${String(s.remaining)}` : '-'));
  return `${g.fronts.join(',')}|${slots.join(',')}|${g.board.cells.join(',')}`;
}

/**
 * Exact search over lane choices (GENERATOR.md §4) with a memo of visited positions, from any
 * position. `unknown` when the node limit was hit before an answer.
 */
export function solveFrom(start: Game, nodeLimit: number): SolveResult {
  const seen = new Set<string>();
  let nodes = 0;
  let limited = false;
  const dfs = (g: Game): boolean => {
    if (g.status === 'won') return true;
    if (g.status === 'lost') return false;
    if (nodes >= nodeLimit) {
      limited = true;
      return false;
    }
    nodes += 1;
    const k = key(g);
    if (seen.has(k)) return false;
    seen.add(k);
    for (let lane = 0; lane < g.lanes.length; lane++) {
      if (g.check(lane) !== 'ok') continue;
      const next = g.clone();
      next.tap(lane);
      if (dfs(next)) return true;
    }
    return false;
  };
  if (dfs(start)) return 'solvable';
  return limited ? 'unknown' : 'unsolvable';
}

export function solve(rules: LevelRules, nodeLimit: number): SolveResult {
  return solveFrom(new Game(rules, { history: false }), nodeLimit);
}
