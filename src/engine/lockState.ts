import type { Plan } from './types';
export function lockState(series: Plan['series'], gameIndex: number): Set<string> {
  const locked = new Set<string>();
  for (const game of series.games) {
    if (game.index >= gameIndex) break;
    for (const id of [...Object.values(game.bluePicks), ...Object.values(game.redPicks)])
      if (id) locked.add(id);
  }
  return locked;
}
