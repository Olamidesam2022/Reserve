import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { seedPlans } from './data/seed';
import type { Plan, Role } from './engine/types';
import { localPlanStorage } from './storage/PlanStorage';

interface State {
  plans: Plan[];
  active: number;
  game: number;
  live: boolean;
  actual: Record<number, Record<string, string>>;
  actualBans: Record<number, string[]>;
  setGame(n: number): void;
  setActive(n: number): void;
  toggleLive(): void;
  assign(teamId: string, role: Role, championId: string, baitCounterId?: string): void;
  importPools(teamId: string, pools: Plan['series']['teams'][number]['players']): void;
  record(teamId: string, role: Role, id: string): void;
  recordBan(id: string): void;
}
export const useStore = create<State>()(
  persist(
    (set) => ({
      plans: seedPlans,
      active: 0,
      game: 1,
      live: false,
      actual: {},
      actualBans: {},
      setGame: (game) => set({ game }),
      setActive: (active) => set({ active }),
      toggleLive: () => set((s) => ({ live: !s.live })),
      assign: (teamId, role, championId, baitCounterId) =>
        set((s) => {
          const plans = [...s.plans],
            old = plans[s.active],
            blue = teamId === old.series.teams[0].id;
          const side = blue ? 'bluePicks' : 'redPicks';
          const series = {
            ...old.series,
            games: old.series.games.map((g) =>
              g.index === s.game ? { ...g, [side]: { ...g[side], [role]: championId } } : g,
            ),
          };
          const pick = {
            teamId,
            role,
            championId,
            ...(baitCounterId ? { bait: { counterChampionId: baitCounterId } } : {}),
          };
          const picks = [
            ...(old.intendedPicks[s.game] ?? []).filter(
              (p) => !(p.teamId === teamId && p.role === role),
            ),
            pick,
          ];
          plans[s.active] = {
            ...old,
            series,
            intendedPicks: { ...old.intendedPicks, [s.game]: picks },
          };
          return { plans };
        }),
      importPools: (teamId, pools) =>
        set((s) => {
          const plans = [...s.plans],
            old = plans[s.active];
          plans[s.active] = {
            ...old,
            series: {
              ...old.series,
              teams: old.series.teams.map((t) =>
                t.id === teamId ? { ...t, players: pools } : t,
              ) as typeof old.series.teams,
            },
          };
          return { plans };
        }),
      record: (teamId, role, id) =>
        set((s) => {
          const plans = [...s.plans],
            old = plans[s.active],
            blue = teamId === old.series.teams[0].id,
            side = blue ? 'bluePicks' : 'redPicks';
          plans[s.active] = {
            ...old,
            series: {
              ...old.series,
              games: old.series.games.map((g) =>
                g.index === s.game ? { ...g, [side]: { ...g[side], [role]: id } } : g,
              ),
            },
          };
          return {
            plans,
            actual: { ...s.actual, [s.game]: { ...s.actual[s.game], [`${teamId}:${role}`]: id } },
          };
        }),
      recordBan: (id) =>
        set((s) => {
          const bans = [...new Set([...(s.actualBans[s.game] ?? []), id])],
            plans = [...s.plans],
            old = plans[s.active];
          plans[s.active] = {
            ...old,
            series: {
              ...old.series,
              games: old.series.games.map((g) => (g.index === s.game ? { ...g, bans } : g)),
            },
          };
          return { plans, actualBans: { ...s.actualBans, [s.game]: bans } };
        }),
    }),
    {
      name: 'reserve-local',
      storage: createJSONStorage(() => localPlanStorage),
      partialize: (s) => ({
        plans: s.plans,
        active: s.active,
        game: s.game,
        live: s.live,
        actual: s.actual,
        actualBans: s.actualBans,
      }),
    },
  ),
);
