export const ROLES = ['Top', 'Jungle', 'Mid', 'Bot', 'Support'] as const;
export type Role = (typeof ROLES)[number];
export interface Champion {
  id: string;
  name: string;
  roles: Role[];
  isFlex: boolean;
}
export interface PlayerPool {
  playerId: string;
  role: Role;
  comfort: Record<string, number>;
}
export interface Team {
  id: string;
  name: string;
  players: PlayerPool[];
}
export interface Game {
  index: number;
  bluePicks: Partial<Record<Role, string>>;
  redPicks: Partial<Record<Role, string>>;
  bans: string[];
  lockedBefore: Set<string>;
}
export interface Series {
  format: 'bo3' | 'bo5';
  teams: [Team, Team];
  games: Game[];
}
export interface IntendedPick {
  teamId: string;
  role: Role;
  championId: string;
  bait?: { counterChampionId: string };
}
export interface Plan {
  id: string;
  name: string;
  series: Series;
  intendedPicks: Record<number, IntendedPick[]>;
}
export interface BurnResult {
  holdValue: number;
  recommendation: 'SPEND' | 'HOLD' | 'NEUTRAL';
  reasons: string[];
}
export interface ValidationWarning {
  gameIndex: number;
  teamId: string;
  role: Role;
  message: string;
}
