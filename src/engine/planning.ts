import {
  ROLES,
  type BurnResult,
  type Plan,
  type Role,
  type Team,
  type ValidationWarning,
} from './types';
import { lockState } from './lockState';

function comfortFor(team: Team, role: Role, champ: string): number {
  return Math.max(
    0,
    ...team.players.filter((p) => p.role === role).map((p) => p.comfort[champ] ?? 0),
  );
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
  const available = Object.values(
    team.players
      .filter((p) => p.role === selectedRole)
      .reduce<Record<string, number>>((a, p) => ({ ...a, ...p.comfort }), {}),
  ).filter((v) => v >= 3).length;
  const left = Object.entries(
    team.players
      .filter((p) => p.role === selectedRole)
      .reduce<Record<string, number>>((a, p) => ({ ...a, ...p.comfort }), {}),
  ).filter(
    ([id, value]) =>
      value >= 3 &&
      !spent(plan, teamId, gameIndex).has(id) &&
      !lockState(plan.series, gameIndex).has(id),
  ).length;
  const scarcity = available ? 1 - left / available : 0;
  const score =
    Math.round(
      (comfort * 12 +
        scarcity * 35 +
        (team.players.some((p) => p.comfort[championId] >= 3) ? 8 : 0)) *
        10,
    ) / 10;
  return {
    score,
    reasons: [
      `Comfort ${comfort}/5 on ${selectedRole}`,
      `${left} strong ${selectedRole} option${left === 1 ? '' : 's'} remain`,
      ...(team.players.some((p) => p.comfort[championId] >= 3)
        ? ['A comfort pick for this team']
        : []),
    ],
  };
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
        const comfort: Record<string, number> = Object.assign(
          {},
          ...team.players.filter((p) => p.role === role).map((p) => p.comfort),
        );
        const remaining = Object.entries(comfort).filter(
          ([id, value]) =>
            value >= 3 &&
            !locked.has(id) &&
            !picks.some((p) => p.teamId === team.id && p.championId === id),
        ).length;
        if (remaining <= 1 && gameIndex >= 3)
          warnings.push({
            gameIndex,
            teamId: team.id,
            role,
            message: `${role} has only ${remaining} comfort pick${remaining === 1 ? '' : 's'} left for game ${gameIndex}`,
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
