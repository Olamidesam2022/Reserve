import { ROLES, type Plan, type Role, type Team } from './types';
import { lockState } from './lockState';

export interface SimulationResult { chance: number; distribution: number[] }
function randomFor(seedText: string): () => number {
  let seed = 2166136261;
  for (const char of seedText) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
  return () => { seed += 0x6d2b79f5; let t = seed; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function pool(team: Team, role: Role, unavailable: Set<string>): Array<{ id: string; comfort: number }> {
  const comfort = Object.assign({}, ...team.players.filter(p => p.role === role).map(p => p.comfort)) as Record<string, number>;
  return Object.entries(comfort).filter(([id, value]) => value > 0 && !unavailable.has(id)).map(([id, value]) => ({ id, comfort: value }));
}
function response(options: Array<{ id: string; comfort: number }>, random: () => number, baitId?: string): number {
  if (!options.length) return 0;
  const weighted = options.map(option => ({ ...option, weight: Math.pow(option.comfort, 2) * (option.id === baitId ? 2.4 : 1) }));
  const total = weighted.reduce((sum, option) => sum + option.weight, 0);
  let point = random() * total;
  for (const option of weighted) { point -= option.weight; if (point <= 0) return option.comfort; }
  return weighted[weighted.length - 1].comfort;
}
/** Repeatable Monte Carlo estimate from player comfort pools and weighted opponent responses. */
export function simulate(plan: Plan, iterations = 1200, onProgress: (done: number, total: number, distribution: number[]) => void = () => {}): SimulationResult {
  const [blue, red] = plan.series.teams;
  const finalGame = Math.max(...plan.series.games.map(game => game.index));
  const bluePicks = plan.intendedPicks[finalGame] ?? [];
  const redPicks = plan.intendedPicks[finalGame] ?? [];
  const priorLocks = lockState(plan.series, finalGame);
  for (const picks of Object.values(plan.intendedPicks)) for (const pick of picks) if (pick.teamId === blue.id || pick.teamId === red.id) priorLocks.add(pick.championId);
  for (const picks of [bluePicks, redPicks]) for (const pick of picks) priorLocks.delete(pick.championId);
  const random = randomFor(`${plan.id}:${finalGame}:${JSON.stringify(plan.intendedPicks)}`);
  const distribution = Array(10).fill(0) as number[];
  let successes = 0;
  for (let run = 0; run < iterations; run++) {
    let margin = 0;
    for (const role of ROLES) {
      const bluePick = bluePicks.find(pick => pick.teamId === blue.id && pick.role === role);
      const redPick = redPicks.find(pick => pick.teamId === red.id && pick.role === role);
      const blueAvailable = pool(blue, role, priorLocks);
      const redAvailable = pool(red, role, priorLocks);
      const blueFallback = blueAvailable.find(option => option.id === bluePick?.championId)?.comfort ?? response(blueAvailable, random, redPick?.bait?.counterChampionId);
      const redFallback = redAvailable.find(option => option.id === redPick?.championId)?.comfort ?? response(redAvailable, random, bluePick?.bait?.counterChampionId);
      // A planned pick uses its player's rating. Opponent responses vary by run and favor comfort picks.
      const blueComfort = bluePick ? (blue.players.find(player => player.role === role)?.comfort[bluePick.championId] ?? 0) : blueFallback;
      const redComfort = redPick ? (red.players.find(player => player.role === role)?.comfort[redPick.championId] ?? 0) : redFallback;
      margin += blueComfort - redComfort;
      if (bluePick?.bait) margin += random() < 0.55 ? 0.35 : -0.15;
      if (redPick?.bait) margin += random() < 0.55 ? -0.35 : 0.15;
    }
    // Convert a comfort-pool margin to a bounded per-run outcome chance, then sample an outcome.
    const perRunChance = 1 / (1 + Math.exp(-margin * 0.22));
    const bucket = Math.min(9, Math.floor(perRunChance * 10));
    distribution[bucket]++;
    if (random() < perRunChance) successes++;
    if (run % Math.max(1, Math.floor(iterations / 20)) === 0 || run === iterations - 1) onProgress(run + 1, iterations, [...distribution]);
  }
  return { chance: Math.round(successes / Math.max(1, iterations) * 100), distribution };
}
