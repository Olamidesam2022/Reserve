import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
});

const { useStore } = await import('./store');
const startingState = useStore.getState();

afterEach(() => {
  useStore.setState({
    plans: startingState.plans,
    active: startingState.active,
    game: startingState.game,
    live: startingState.live,
    actual: startingState.actual,
    actualBans: startingState.actualBans,
  });
});

afterAll(() => vi.unstubAllGlobals());

describe('draft store', () => {
  it('commits the bait pick and expected counter together', () => {
    useStore.getState().setGame(1);
    useStore.getState().assign('blue', 'Mid', 'Taliyah', 'Orianna');

    const activePlan = useStore.getState().plans[useStore.getState().active];
    expect(activePlan.series.games[0].bluePicks.Mid).toBe('Taliyah');
    expect(
      activePlan.intendedPicks[1]?.find((pick) => pick.teamId === 'blue' && pick.role === 'Mid'),
    ).toMatchObject({ championId: 'Taliyah', bait: { counterChampionId: 'Orianna' } });
  });
});
