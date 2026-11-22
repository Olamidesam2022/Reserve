import {
  ROLES,
  type BurnResult,
  type Plan,
  type Role,
  type Team,
  type ValidationWarning,
} from './types';
import { lockState } from './lockState';
import { ENGINE_CONFIG } from './config';

function comfortFor(team: Team, role: Role, champ: string): number {
  return Math.max(
    0,
    ...team.players.filter((p) => p.role === role).map((p) => p.comfort[champ] ?? 0),
  );
}
function roleComfort(team: Team, role: Role): Record<string, number> {
  const comfort: Record<string, number> = {};
  for (const player of team.players.filter((candidate) => candidate.role === role))
    for (const [championId, rating] of Object.entries(player.comfort))
      comfort[championId] = Math.max(comfort[championId] ?? 0, rating);
  return comfort;
}
function spent(plan: Plan, teamId: string, gameIndex: number): Set<string> {
  const used = new Set<string>();
  for (const [index, picks] of Object.entries(plan.intendedPicks))
    if (Number(index) < gameIndex)
      for (const pick of picks) if (pick.teamId === teamId) used.add(pick.championId);
  return used;
}
export function burnScore(
  plan: Plan,
  championId: string,
  gameIndex: number,
  teamId = plan.series.teams[0].id,
  role?: Role,
): BurnResult {
  const team = plan.series.teams.find((t) => t.id === teamId) ?? plan.series.teams[0];
  const selectedRole =
    role ?? plan.intendedPicks[gameIndex]?.find((p) => p.championId === championId)?.role ?? 'Mid';
  const comfort = comfortFor(team, selectedRole, championId);
  const locked = lockState(plan.series, gameIndex).has(championId);
  const used = spent(plan, teamId, gameIndex);
  const strongOptions = roleComfort(team, selectedRole);
  const strongRemaining = Object.entries(strongOptions)
    .filter(
      ([id, rating]) =>
        rating >= ENGINE_CONFIG.comfort.strongOptionThreshold &&
        !used.has(id) &&
        !lockState(plan.series, gameIndex).has(id),
    )
    .map(([id]) => id);
  const isStrong = comfort >= ENGINE_CONFIG.comfort.strongOptionThreshold;
  const isAvailableStrong = isStrong && !used.has(championId) && !locked;
  const strongRemainingIncludingThis = strongRemaining.length;
  const scarcity =
    isAvailableStrong && strongRemainingIncludingThis > 0 ? 1 / strongRemainingIncludingThis : 0;
  const flexibility = ROLES.filter((candidateRole) =>
    team.players.some(
      (player) => (player.comfort[championId] ?? 0) > 0 && player.role === candidateRole,
    ),
  );
  const flexNorm =
    flexibility.length <= 1 ? 0 : clamp((flexibility.length - 1) / (ROLES.length - 1));
  const gamesRemaining = Math.max(0, plan.series.games.length - gameIndex + 1);
  const gamesLeftNorm = clamp(gamesRemaining / Math.max(1, plan.series.games.length));
  const holdValue = Math.round(
    ENGINE_CONFIG.holdScore.maximum *
      (ENGINE_CONFIG.holdScore.weights.scarcity * clamp(scarcity) +
        ENGINE_CONFIG.holdScore.weights.comfort * comfortNorm(comfort) +
        ENGINE_CONFIG.holdScore.weights.flexibility * flexNorm +
        ENGINE_CONFIG.holdScore.weights.gamesRemaining * gamesLeftNorm),
  );
  const recommendation =
    holdValue >= ENGINE_CONFIG.holdScore.recommendation.holdAtOrAbove
      ? 'HOLD'
      : holdValue <= ENGINE_CONFIG.holdScore.recommendation.spendAtOrBelow
        ? 'SPEND'
        : 'NEUTRAL';
  const leftAfterSpending = Math.max(0, strongRemainingIncludingThis - (isAvailableStrong ? 1 : 0));
  const roleLabel = flexibility.length > 1 ? flexibility.join(' and ') : selectedRole;
  const reasons = [
    locked
      ? `${championId} is locked from an earlier game`
      : isStrong
        ? `${strongRemainingIncludingThis === 1 ? 'Last strong' : 'Strong'} ${selectedRole} option: spending it leaves ${leftAfterSpending}`
        : `Not a strong ${selectedRole} option; ${strongRemainingIncludingThis} strong option${strongRemainingIncludingThis === 1 ? '' : 's'} remain`,
    `Comfort ${comfort}/${ENGINE_CONFIG.comfort.maximum}`,
    ...(flexibility.length > 1 ? [`Plays ${roleLabel}: flex value`] : []),
    `${gamesRemaining} game${gamesRemaining === 1 ? '' : 's'} remaining in the series`,
  ];
  return {
    holdValue: Math.max(0, Math.min(ENGINE_CONFIG.holdScore.maximum, holdValue)),
    recommendation,
    reasons,
  };
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function comfortNorm(value: number): number {
  return clamp(value / ENGINE_CONFIG.comfort.maximum);
}
export function exhaustion(
  team: Team,
  series: Plan['series'],
  plan?: Plan,
  gameIndex = 1,
): Array<{ role: Role; remaining: number; strong: string[] }> {
  return ROLES.map((role) => {
    const comfort: Record<string, number> = Object.assign(
      {},
      ...team.players.filter((p) => p.role === role).map((p) => p.comfort),
    );
    const burned = new Set<string>();
    for (const game of series.games)
      if (game.index < gameIndex)
        for (const id of [...Object.values(game.bluePicks), ...Object.values(game.redPicks)])
          if (id) burned.add(id);
    if (plan)
      for (const [index, picks] of Object.entries(plan.intendedPicks))
        if (Number(index) < gameIndex)
          for (const pick of picks) if (pick.teamId === team.id) burned.add(pick.championId);
    const strong = Object.entries(comfort)
      .filter(([id, value]) => value >= 3 && !burned.has(id))
      .map(([id]) => id);
    return { role, remaining: strong.length, strong };
  }).sort((a, b) => a.remaining - b.remaining);
}
export function validate(plan: Plan): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  for (let gameIndex = 1; gameIndex <= plan.series.games.length; gameIndex++) {
    const locked = lockState(plan.series, gameIndex);
    for (const team of plan.series.teams)
      for (const role of ROLES) {
        const picks = plan.intendedPicks[gameIndex] ?? [];
        const rolePicks = picks.filter((p) => p.teamId === team.id && p.role === role);
        for (const pick of rolePicks)
          if (locked.has(pick.championId))
            warnings.push({
              gameIndex,
              teamId: team.id,
              role,
              message: `${pick.championId} is locked from an earlier game`,
            });
        const currentBans = plan.series.games.find((game) => game.index === gameIndex)?.bans ?? [];
        for (const pick of rolePicks)
          if (currentBans.includes(pick.championId))
            warnings.push({
              gameIndex,
              teamId: team.id,
              role,
              message: `${pick.championId} is banned in game ${gameIndex}`,
            });
        const alreadyPlanned = spent(plan, team.id, gameIndex);
        for (const pick of rolePicks) alreadyPlanned.add(pick.championId);
        const remaining = Object.entries(roleComfort(team, role)).filter(
          ([id, value]) =>
            value >= ENGINE_CONFIG.comfort.strongOptionThreshold &&
            !locked.has(id) &&
            !alreadyPlanned.has(id),
        ).length;
        const gamesRemaining = plan.series.games.length - gameIndex + 1;
        if (remaining < gamesRemaining)
          warnings.push({
            gameIndex,
            teamId: team.id,
            role,
            message: `${role} has ${remaining} strong option${remaining === 1 ? '' : 's'} left for ${gamesRemaining} game${gamesRemaining === 1 ? '' : 's'}`,
          });
      }
  }
  return warnings;
}
export function flexTracker(plan: Plan): Array<{ championId: string; possibleRoles: Role[] }> {
  const ids = new Set(
    Object.values(plan.intendedPicks)
      .flat()
      .map((p) => p.championId),
  );
  const result: Array<{ championId: string; possibleRoles: Role[] }> = [];
  for (const id of ids) {
    const roles = ROLES.filter((role) =>
      plan.series.teams.some((team) =>
        team.players.some((p) => p.role === role && (p.comfort[id] ?? 0) > 0),
      ),
    );
    if (roles.length > 1) result.push({ championId: id, possibleRoles: roles });
  }
  return result;
}
