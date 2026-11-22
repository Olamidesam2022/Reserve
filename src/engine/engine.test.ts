import { describe, expect, it } from 'vitest';
import { lockState, burnScore, exhaustion, flexTracker, validate, type Plan } from './index';
import { simulate } from './simulate';
import { seedPlans } from '../data/seed';
const team = (id: string) => ({ id, name: id, players: [{ playerId: `${id}-mid`, role: 'Mid' as const, comfort: { Ahri: 5, Orianna: 4, Syndra: 3 } }] });
const plan: Plan = { id: 'test', name: 'test', series: { format: 'bo5', teams: [team('blue'), team('red')], games: [1, 2, 3, 4, 5].map(index => ({ index, bluePicks: index === 1 ? { Mid: 'Ahri' } : {}, redPicks: {}, bans: [], lockedBefore: new Set() })) }, intendedPicks: { 1: [{ teamId: 'blue', role: 'Mid', championId: 'Ahri' }], 4: [{ teamId: 'blue', role: 'Mid', championId: 'Ahri' }] } };
describe('series engine', () => {
  it('locks picks from prior games, not current game', () => { expect(lockState(plan.series, 2).has('Ahri')).toBe(true); expect(lockState(plan.series, 1).size).toBe(0); });
  it('does not treat a game-specific ban as spent for later games', () => { const copy={...plan.series,games:plan.series.games.map(g=>g.index===1?{...g,bans:['Orianna']}:g)}; expect(lockState(copy,2).has('Orianna')).toBe(false); });
  it('hydrates seeded plans into the same lock state shown on the board', () => { expect(lockState(seedPlans[0].series,2).has('Ahri')).toBe(true); });
  it('scores a pick with readable reasons', () => { const result = burnScore(plan, 'Ahri', 1); expect(result.score).toBeGreaterThan(0); expect(result.reasons.length).toBeGreaterThan(0); });
  it('reports remaining options and locked-pick warnings', () => { expect(exhaustion(plan.series.teams[0], plan.series)[0].role).toBe('Top'); expect(validate(plan).some(w => w.message.includes('locked'))).toBe(true); });
  it('flags a planned champion that is banned in that game', () => { const copy={...plan,series:{...plan.series,games:plan.series.games.map(g=>g.index===1?{...g,bans:['Ahri']}:g)}}; expect(validate(copy).some(w=>w.message.includes('banned'))).toBe(true); });
  it('counts earlier series picks as depletion but keeps future options in reserve', () => { const rows=exhaustion(plan.series.teams[0],plan.series,plan,2); expect(rows.find(row=>row.role==='Mid')?.remaining).toBe(2); });
  it('tracks flex only when a champion spans roles', () => { expect(flexTracker(plan)).toEqual([]); });
  it('simulates repeatably and streams a full probability distribution', () => { const updates:number[]=[]; const a=simulate(plan,40,(done)=>updates.push(done)); const b=simulate(plan,40); expect(a).toEqual(b); expect(a.distribution).toHaveLength(10); expect(a.distribution.reduce((sum,n)=>sum+n,0)).toBe(40); expect(updates.at(-1)).toBe(40); });
});
