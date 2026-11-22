import { ROLES, type PlayerPool, type Role } from '../engine/types';
export interface PoolSource {
  parse(text: string): PlayerPool[];
}
export class ManualPoolSource implements PoolSource {
  parse(text: string): PlayerPool[] {
    if (!text.trim()) return [];
    return JSON.parse(text) as PlayerPool[];
  }
}
export class CsvPoolSource implements PoolSource {
  parse(text: string): PlayerPool[] {
    const rows = text
      .trim()
      .split(/\r?\n/)
      .map((line) => line.split(',').map((v) => v.trim()));
    const header = rows.shift()?.map((v) => v.toLowerCase()) ?? [];
    const at = (row: string[], key: string) => row[header.indexOf(key)];
    const grouped = new Map<string, PlayerPool>();
    for (const row of rows) {
      const playerId = at(row, 'playerid');
      const roleText = at(row, 'role');
      const role = roleText as Role;
      const id = at(row, 'championid');
      const comfortText = at(row, 'comfort');
      const comfort = Number(comfortText);
      if (
        !playerId ||
        !ROLES.includes(role) ||
        !id ||
        !comfortText ||
        !Number.isFinite(comfort) ||
        comfort < 0 ||
        comfort > 5
      )
        continue;
      const key = `${playerId}:${role}`;
      const pool = grouped.get(key) ?? { playerId, role, comfort: {} };
      pool.comfort[id] = comfort;
      grouped.set(key, pool);
    }
    return [...grouped.values()];
  }
}
