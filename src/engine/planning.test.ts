import { describe, expect, it } from 'vitest';
import { burnScore, validate } from './planning';
import type { Plan, PlayerPool, Team } from './types';

function makePlan(players: PlayerPool[], pickedAhri = false): Plan {
  const makeTeam = (id: string, roster: PlayerPool[]): Team => ({ id, name: id, players: roster });
  return {
    id: 'scoring',
    name: 'Scoring fixture',
    series: {
      format: 'bo5',
      teams: [makeTeam('blue', players), makeTeam('red', [])],
      games: [1, 2, 3, 4, 5].map((index) => ({
        index,
        bluePicks: index === 1 && pickedAhri ? { Mid: 'Ahri' } : {},
        redPicks: {},
        bans: [],
        lockedBefore: new Set<string>(),
      })),
    },
    intendedPicks: {},
  };
}

const pool = (role: PlayerPool['role'], comfort: Record<string, number>): PlayerPool => ({
  playerId: `blue-${role}`,
  role,
  comfort,
});

describe('burnScore', () => {
  it('scores a last strong option higher than a plentiful option', () => {
    const scarce = makePlan([pool('Mid', { Ahri: 5 })]);
    const plentiful = makePlan([pool('Mid', { Ahri: 5, Orianna: 4, Syndra: 3 })]);
    expect(burnScore(scarce, 'Ahri', 1).holdValue).toBeGreaterThan(
      burnScore(plentiful, 'Ahri', 1).holdValue,
    );
  });

  it('gives a flex champion more hold value than a single-role champion', () => {
    const singleRole = makePlan([pool('Mid', { Ahri: 5 })]);
    const flex = makePlan([pool('Mid', { Ahri: 5 }), pool('Top', { Ahri: 4 })]);
    const score = burnScore(flex, 'Ahri', 1);
    expect(score.holdValue).toBeGreaterThan(burnScore(singleRole, 'Ahri', 1).holdValue);
    expect(score.reasons).toContain('Plays Top and Mid: flex value');
  });

  it('scores a zero-comfort champion without treating it as a strong option', () => {
    const plan = makePlan([pool('Mid', { Ahri: 0, Orianna: 4 })]);
    const score = burnScore(plan, 'Ahri', 1);
    expect(score.holdValue).toBe(10);
    expect(score.recommendation).toBe('SPEND');
    expect(score.reasons).toContain('Not a strong Mid option; 1 strong option remain');
  });

  it('reports a locked champion and excludes it from available option depth', () => {
    const plan = makePlan([pool('Mid', { Ahri: 5, Orianna: 4 })], true);
    const score = burnScore(plan, 'Ahri', 2);
    expect(score.reasons[0]).toBe('Ahri is locked from an earlier game');
    expect(score.reasons[0]).not.toContain('strong option');
  });

  it('handles an empty role pool', () => {
    const score = burnScore(makePlan([]), 'Ahri', 1);
    expect(score.holdValue).toBe(10);
    expect(score.recommendation).toBe('SPEND');
  });

  it('values holding a champion more when more games remain', () => {
    const plan = makePlan([pool('Mid', { Ahri: 5 })]);
    expect(burnScore(plan, 'Ahri', 1).holdValue).toBeGreaterThan(
      burnScore(plan, 'Ahri', 5).holdValue,
    );
  });

  it('warns in game one when strong options are fewer than the remaining games', () => {
    const plan = makePlan([pool('Mid', { Ahri: 5, Orianna: 4 })]);
    const warning = validate(plan).find(
      (entry) => entry.gameIndex === 1 && entry.teamId === 'blue' && entry.role === 'Mid',
    );
    expect(warning?.message).toBe('Mid has 2 strong options left for 5 games');
  });

  it('warns when a pick has already been planned for this game', () => {
    const plan = makePlan([pool('Mid', { Ahri: 5, Orianna: 4 })]);
    plan.intendedPicks[1] = [{ teamId: 'blue', role: 'Mid', championId: 'Ahri' }];
    const warning = validate(plan).find(
      (entry) => entry.gameIndex === 1 && entry.teamId === 'blue' && entry.role === 'Mid',
    );
    expect(warning?.message).toBe('Mid has 1 strong option left for 5 games');
  });

  it('keeps locked champion warnings', () => {
    const plan = makePlan([pool('Mid', { Ahri: 5 })], true);
    plan.intendedPicks[2] = [{ teamId: 'blue', role: 'Mid', championId: 'Ahri' }];
    expect(
      validate(plan).some((warning) => warning.message.includes('locked from an earlier game')),
    ).toBe(true);
  });

  it('keeps banned champion warnings', () => {
    const plan = makePlan([pool('Mid', { Ahri: 5 })]);
    plan.series.games[0].bans = ['Ahri'];
    plan.intendedPicks[1] = [{ teamId: 'blue', role: 'Mid', championId: 'Ahri' }];
    expect(validate(plan).some((warning) => warning.message.includes('is banned in game 1'))).toBe(
      true,
    );
  });
});
