import { describe, expect, it } from 'vitest';
import { CsvPoolSource } from './poolSource';

const source = new CsvPoolSource();
const header = 'playerId,role,championId,championName,comfort,isFlex';

describe('CSV pool source', () => {
  it('skips malformed rows and invalid roles', () => {
    const rows = [
      'mid-1,,Ahri,Ahri,5,false',
      'mid-1,Mid,,Ahri,5,false',
      'mid-1,Coach,Ahri,Ahri,5,false',
      'mid-1,Mid,Syndra,Syndra,,false',
      ',Mid,Orianna,Orianna,4,false',
    ];
    expect(source.parse([header, ...rows].join('\n'))).toEqual([]);
  });

  it('skips comfort ratings outside the 0 to 5 range', () => {
    expect(
      source.parse(
        [header, 'mid-1,Mid,Ahri,Ahri,6,false', 'mid-1,Mid,Orianna,Orianna,-1,false'].join('\n'),
      ),
    ).toEqual([]);
  });

  it('uses the last comfort value for a duplicate player role champion row', () => {
    expect(
      source.parse(
        [header, 'mid-1,Mid,Ahri,Ahri,2,false', 'mid-1,Mid,Ahri,Ahri,5,false'].join('\n'),
      ),
    ).toEqual([{ playerId: 'mid-1', role: 'Mid', comfort: { Ahri: 5 } }]);
  });

  it('returns an empty pool for an empty file', () => {
    expect(source.parse('')).toEqual([]);
    expect(source.parse('  \r\n')).toEqual([]);
  });
});
