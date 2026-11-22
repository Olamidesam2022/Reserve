import { ENGINE_CONFIG } from './config';
import { lockState } from './lockState';
import { ROLES, type IntendedPick, type Plan, type Role, type Team } from './types';

export type ScoreDistribution = Record<string, number>;

export interface SimulationResult {
  /** Probability that the first team in the plan wins the series, from 0 to 1. */
  seriesWinChance: number;
  /** Normalized probabilities for each valid final score, from the first team's perspective. */
  scoreDistribution: ScoreDistribution;
}

interface PoolPick {
  id: string;
  comfort: number;
}

function randomFor(seedText: string): () => number {
  let seed = 2166136261;
  for (const char of seedText) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function optionsFor(team: Team, role: Role, unavailable: Set<string>): PoolPick[] {
  const comfort: Record<string, number> = {};
  for (const player of team.players.filter((candidate) => candidate.role === role))
    for (const [id, value] of Object.entries(player.comfort))
      comfort[id] = Math.max(comfort[id] ?? 0, value);
  return Object.entries(comfort)
    .filter(([id, value]) => value > 0 && !unavailable.has(id))
    .map(([id, value]) => ({ id, comfort: value }));
}

function chooseWeighted(
  options: PoolPick[],
  random: () => number,
  baitChampionId?: string,
): PoolPick | undefined {
  if (options.length === 0) return undefined;
  const weighted = options.map((option) => ({
    ...option,
    weight:
      option.comfort ** 2 *
      (option.id === baitChampionId ? ENGINE_CONFIG.simulation.baitWeightMultiplier : 1),
  }));
  const total = weighted.reduce((sum, option) => sum + option.weight, 0);
  let cursor = random() * total;
  for (const option of weighted) {
    cursor -= option.weight;
    if (cursor <= 0) return option;
  }
  return weighted.at(-1);
}

function plannedPick(picks: IntendedPick[], teamId: string, role: Role): IntendedPick | undefined {
  return picks.find((pick) => pick.teamId === teamId && pick.role === role);
}

function scoreKeys(format: Plan['series']['format']): string[] {
  return format === 'bo5'
    ? ['3-0', '3-1', '3-2', '2-3', '1-3', '0-3']
    : ['2-0', '2-1', '1-2', '0-2'];
}

function sampleGame(
  plan: Plan,
  gameIndex: number,
  locked: Set<string>,
  random: () => number,
): { blueComfort: number; redComfort: number; picked: Set<string> } {
  const [blue, red] = plan.series.teams;
  const picks = plan.intendedPicks[gameIndex] ?? [];
  const unavailable = new Set(locked);
  const picked = new Set<string>();
  let blueComfort = 0;
  let redComfort = 0;

  for (const role of ROLES) {
    const bluePlan = plannedPick(picks, blue.id, role);
    const redPlan = plannedPick(picks, red.id, role);
    const blueChampion =
      bluePlan && !unavailable.has(bluePlan.championId)
        ? bluePlan.championId
        : chooseWeighted(
            optionsFor(blue, role, unavailable),
            random,
            redPlan?.bait?.counterChampionId,
          )?.id;
    if (blueChampion) unavailable.add(blueChampion);

    const redChampion =
      redPlan && !unavailable.has(redPlan.championId)
        ? redPlan.championId
        : chooseWeighted(
            optionsFor(red, role, unavailable),
            random,
            bluePlan?.bait?.counterChampionId,
          )?.id;
    if (redChampion) unavailable.add(redChampion);

    if (blueChampion) {
      picked.add(blueChampion);
      blueComfort += comfortFor(blue, role, blueChampion);
    }
    if (redChampion) {
      picked.add(redChampion);
      redComfort += comfortFor(red, role, redChampion);
    }
  }

  return { blueComfort, redComfort, picked };
}

function comfortFor(team: Team, role: Role, championId: string): number {
  return Math.max(
    0,
    ...team.players
      .filter((player) => player.role === role)
      .map((player) => player.comfort[championId] ?? 0),
  );
}

/** Simulates the remaining games in a repeatable Fearless Draft series. */
export function simulate(
  plan: Plan,
  iterations: number = ENGINE_CONFIG.simulation.iterations,
  onProgress: (done: number, total: number, distribution: ScoreDistribution) => void = () => {},
): SimulationResult {
  const gameCount = plan.series.games.length;
  // The data model does not store previous game winners, so a valid final score
  // distribution must simulate the complete planned series from Game 1.
  const startGame = 1;
  const winsToTakeSeries = plan.series.format === 'bo5' ? 3 : 2;
  const scores = Object.fromEntries(scoreKeys(plan.series.format).map((key) => [key, 0]));
  const random = randomFor(
    `${plan.id}:${plan.series.format}:${startGame}:${JSON.stringify(plan.intendedPicks)}:${JSON.stringify(plan.series.teams)}`,
  );
  const runCount = Math.max(1, Math.floor(iterations));
  let blueSeriesWins = 0;
  const progressInterval = Math.max(1, Math.floor(runCount / 20));

  for (let run = 0; run < runCount; run++) {
    const [blue, red] = plan.series.teams;
    const wins = [0, 0];
    const locked = lockState(plan.series, startGame);

    for (const game of plan.series.games) {
      if (game.index < startGame || wins[0] === winsToTakeSeries || wins[1] === winsToTakeSeries)
        continue;
      const outcome = sampleGame(plan, game.index, locked, random);
      const margin = outcome.blueComfort - outcome.redComfort;
      const winChance = 1 / (1 + Math.exp(-margin * ENGINE_CONFIG.simulation.logisticScale));
      if (random() < winChance) wins[0]++;
      else wins[1]++;
      for (const id of outcome.picked) locked.add(id);
    }

    if (wins[0] > wins[1]) blueSeriesWins++;
    const key = `${wins[0]}-${wins[1]}`;
    if (key in scores) scores[key]++;
    if ((run + 1) % progressInterval === 0 || run === runCount - 1) {
      onProgress(
        run + 1,
        runCount,
        Object.fromEntries(
          Object.entries(scores).map(([score, frequency]) => [score, frequency / (run + 1)]),
        ),
      );
    }
  }

  return {
    seriesWinChance: blueSeriesWins / runCount,
    scoreDistribution: Object.fromEntries(
      Object.entries(scores).map(([score, frequency]) => [score, frequency / runCount]),
    ),
  };
}
