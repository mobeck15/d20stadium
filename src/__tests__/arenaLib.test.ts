import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Monster } from '../monster.js';

// Mock combat module before importing arenaLib
const mockFight = jest.fn();
jest.unstable_mockModule('../combat.js', () => ({
  fight: mockFight
}));

// Mock fs module before importing arenaLib
const mockReadFileSync = jest.fn();
jest.unstable_mockModule('fs', () => ({
  readFileSync: mockReadFileSync
}));

// Now import arenaLib after the mocks are set up
const { parseArgs, runSimulations, formatResults, loadMonster } = await import('../arenaLib.js');

describe('arenaLib', () => {
  describe('parseArgs', () => {
    it('should parse debug flag', () => {
      const result = parseArgs(['node', 'arena.js', 'a.json', 'b.json', '--debug']);
      expect(result.debug).toBe(true);
      expect(result.files).toEqual(['a.json', 'b.json']);
    });

    it('should parse seed argument', () => {
      const result = parseArgs(['node', 'arena.js', 'a.json', 'b.json', '--seed=12345']);
      expect(result.seed).toBe(12345);
      expect(result.files).toEqual(['a.json', 'b.json']);
    });

    it('should throw error for invalid seed format', () => {
      expect(() => parseArgs(['node', 'arena.js', 'a.json', 'b.json', '--seed=']))
        .toThrow('Invalid seed format. Use --seed=NUMBER');
    });

    it('should throw error when missing files', () => {
      expect(() => parseArgs(['node', 'arena.js', 'a.json']))
        .toThrow('Expected exactly 2 monster files');
    });

    it('should throw error when too many files', () => {
      expect(() => parseArgs(['node', 'arena.js', 'a.json', 'b.json', 'c.json']))
        .toThrow('Expected exactly 2 monster files');
    });

    it('should generate random seed when not provided', () => {
      const result1 = parseArgs(['node', 'arena.js', 'a.json', 'b.json']);
      const result2 = parseArgs(['node', 'arena.js', 'a.json', 'b.json']);
      expect(typeof result1.seed).toBe('number');
      expect(typeof result2.seed).toBe('number');
    });
  });

  describe('runSimulations', () => {
    const mockMonsterA: Monster = {
      name: 'Monster A',
      cr: 1,
      hp: 100,
      ac: 15,
      attack_bonus: 5,
      attacks: [{ name: 'Claw', damage: '1d6+3' }],
      attacks_per_round: 1,
      initiative: 2,
      saves: { fort: 3, ref: 2, will: 1 },
      tags: []
    };

    const mockMonsterB: Monster = {
      name: 'Monster B',
      cr: 1,
      hp: 80,
      ac: 14,
      attack_bonus: 4,
      attacks: [{ name: 'Bite', damage: '1d8+2' }],
      attacks_per_round: 1,
      initiative: 1,
      saves: { fort: 2, ref: 3, will: 2 },
      tags: []
    };

    beforeEach(() => {
      mockFight.mockClear();
    });

    it('should run specified number of simulations', () => {
      mockFight.mockReturnValue({
        winner: 'Monster A',
        rounds: 5,
        hpA: 50,
        hpB: 0
      });

      const result = runSimulations(mockMonsterA, mockMonsterB, 10, 12345);

      expect(mockFight).toHaveBeenCalledTimes(10);
      expect(result.simulations).toBe(10);
    });

    it('should count wins correctly', () => {
      mockFight
        .mockReturnValueOnce({ winner: 'Monster A', rounds: 3, hpA: 50, hpB: 0 })
        .mockReturnValueOnce({ winner: 'Monster B', rounds: 4, hpA: 0, hpB: 30 })
        .mockReturnValueOnce({ winner: 'Monster A', rounds: 2, hpA: 60, hpB: 0 });

      const result = runSimulations(mockMonsterA, mockMonsterB, 3, 100);

      expect(result.winsA).toBe(2);
      expect(result.winsB).toBe(1);
    });

    it('should accumulate totals correctly', () => {
      mockFight
        .mockReturnValueOnce({ winner: 'Monster A', rounds: 3, hpA: 50, hpB: 0 })
        .mockReturnValueOnce({ winner: 'Monster B', rounds: 5, hpA: 0, hpB: 30 });

      const result = runSimulations(mockMonsterA, mockMonsterB, 2, 200);

      expect(result.totalHpA).toBe(50);
      expect(result.totalHpB).toBe(30);
      expect(result.totalRounds).toBe(8);
    });

    it('should use incremental seeds', () => {
      mockFight.mockReturnValue({ winner: 'Monster A', rounds: 1, hpA: 100, hpB: 0 });

      runSimulations(mockMonsterA, mockMonsterB, 3, 1000);

      expect(mockFight).toHaveBeenNthCalledWith(1, mockMonsterA, mockMonsterB, { seed: 1000 });
      expect(mockFight).toHaveBeenNthCalledWith(2, mockMonsterA, mockMonsterB, { seed: 1001 });
      expect(mockFight).toHaveBeenNthCalledWith(3, mockMonsterA, mockMonsterB, { seed: 1002 });
    });
  });

  describe('formatResults', () => {
    const mockMonsterA: Monster = {
      name: 'Dragon',
      cr: 5,
      hp: 200,
      ac: 18,
      attack_bonus: 8,
      attacks: [{ name: 'Bite', damage: '2d10+5' }],
      attacks_per_round: 2,
      initiative: 3,
      saves: { fort: 8, ref: 5, will: 6 },
      tags: []
    };

    const mockMonsterB: Monster = {
      name: 'Knight',
      cr: 3,
      hp: 100,
      ac: 20,
      attack_bonus: 6,
      attacks: [{ name: 'Sword', damage: '1d8+4' }],
      attacks_per_round: 1,
      initiative: 2,
      saves: { fort: 6, ref: 4, will: 3 },
      tags: []
    };

    it('should format results as valid JSON', () => {
      const results = {
        winsA: 700,
        winsB: 300,
        totalHpA: 50000,
        totalHpB: 15000,
        totalRounds: 4000,
        simulations: 1000
      };

      const output = formatResults(mockMonsterA, mockMonsterB, results);
      const parsed = JSON.parse(output);

      expect(parsed).toHaveProperty('matchup');
      expect(parsed).toHaveProperty('simulations');
      expect(parsed).toHaveProperty('Team 1 win rate');
      expect(parsed).toHaveProperty('Team 2 win rate');
    });

    it('should calculate win rates correctly', () => {
      const results = {
        winsA: 750,
        winsB: 250,
        totalHpA: 50000,
        totalHpB: 10000,
        totalRounds: 3000,
        simulations: 1000
      };

      const output = formatResults(mockMonsterA, mockMonsterB, results);
      const parsed = JSON.parse(output);

      expect(parsed['Team 1 win rate']).toBe(0.75);
      expect(parsed['Team 2 win rate']).toBe(0.25);
    });

    it('should calculate averages correctly', () => {
      const results = {
        winsA: 600,
        winsB: 400,
        totalHpA: 30000,
        totalHpB: 20000,
        totalRounds: 5000,
        simulations: 1000
      };

      const output = formatResults(mockMonsterA, mockMonsterB, results);
      const parsed = JSON.parse(output);

      expect(parsed['Team 1 members'][0]['avg_HP_at_end']).toBe(30);
      expect(parsed['Team 2 members'][0]['avg_HP_at_end']).toBe(20);
      expect(parsed['average_rounds']).toBe(5);
    });

    it('should include monster names', () => {
      const results = {
        winsA: 500,
        winsB: 500,
        totalHpA: 25000,
        totalHpB: 25000,
        totalRounds: 4000,
        simulations: 1000
      };

      const output = formatResults(mockMonsterA, mockMonsterB, results);
      const parsed = JSON.parse(output);

      expect(parsed['Team 1 members'][0].name).toBe('Dragon');
      expect(parsed['Team 2 members'][0].name).toBe('Knight');
    });

    it('should round to 2 decimal places', () => {
      const results = {
        winsA: 333,
        winsB: 667,
        totalHpA: 16666,
        totalHpB: 33333,
        totalRounds: 4444,
        simulations: 1000
      };

      const output = formatResults(mockMonsterA, mockMonsterB, results);
      const parsed = JSON.parse(output);

      expect(parsed['Team 1 win rate']).toBe(0.33);
      expect(parsed['Team 1 members'][0]['avg_HP_at_end']).toBe(16.67);
      expect(parsed['average_rounds']).toBe(4.44);
    });
  });

  describe('loadMonster', () => {
    beforeEach(() => {
      mockReadFileSync.mockClear();
    });

    it('should load and parse monster from file', () => {
      const mockMonster = {
        name: 'Goblin',
        cr: 1,
        hp: 20,
        ac: 15,
        attack_bonus: 4,
        attacks: [{ name: 'Sword', damage: '1d6+2' }],
        attacks_per_round: 1,
        initiative: 2,
        saves: { fort: 2, ref: 3, will: 1 },
        tags: []
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(mockMonster));

      const result = loadMonster('goblin.json');

      expect(mockReadFileSync).toHaveBeenCalledWith(expect.any(String), 'utf8');
      expect(result.name).toBe('Goblin');
      expect(result.hp).toBe(20);
    });

    it('should throw error when file cannot be read', () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      expect(() => loadMonster('nonexistent.json'))
        .toThrow('Failed to load monster from nonexistent.json');
    });

    it('should throw error when JSON is invalid', () => {
      mockReadFileSync.mockReturnValue('{ invalid json }');

      expect(() => loadMonster('invalid.json'))
        .toThrow('Failed to load monster from invalid.json');
    });
  });
});