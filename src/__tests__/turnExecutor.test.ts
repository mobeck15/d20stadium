import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Monster } from '../monster.js';
import type { HandlerContext } from '../specialHandlers.js';
import MonsterState from '../monsterState.js';

// Mock specialHandlers module
const mockHandler = {
  onFightStart: jest.fn(),
  onTurnStart: jest.fn(),
  onTurnEnd: jest.fn(),
  onOpponentTurnStart: jest.fn(),
  onHit: jest.fn()
};

jest.unstable_mockModule('../specialHandlers.js', () => ({
  default: {
    testSpecial: mockHandler
  }
}));

// Mock console for logging tests
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

// Import after mocks are set up
const { executeSpecialHandlers, logRoundStatus, logFinalStats } = await import('../turnExecutor.js');

describe('turnExecutor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('executeSpecialHandlers', () => {
    const mockMonster: Monster = {
      name: 'Test Monster',
      cr: 1,
      hp: 100,
      ac: 15,
      attack_bonus: 5,
      attacks: [{ name: 'Claw', damage: '1d6+3' }],
      attacks_per_round: 1,
      initiative: 2,
      saves: { fort: 3, ref: 2, will: 1 },
      tags: [],
      special: {
        testSpecial: { value: 10 }
      }
    };

    const mockCtx: HandlerContext = {
      a: mockMonster,
      b: mockMonster,
      attackerState: new MonsterState(mockMonster),
      defenderState: new MonsterState(mockMonster),
      attacker: mockMonster,
      defender: mockMonster,
      attackerLabel: 'Monster(1)',
      defenderLabel: 'Monster(2)',
      random: Math.random,
      debug: false
    };

    it('should call handler when it exists', () => {
      executeSpecialHandlers(mockMonster, 'onTurnStart', mockCtx, false);
      expect(mockHandler.onTurnStart).toHaveBeenCalledWith(mockCtx, { value: 10 });
    });

    it('should call correct handler type', () => {
      executeSpecialHandlers(mockMonster, 'onHit', mockCtx, false);
      expect(mockHandler.onHit).toHaveBeenCalledTimes(1);
      expect(mockHandler.onTurnStart).not.toHaveBeenCalled();
    });

    it('should handle monster with no special abilities', () => {
      const plainMonster: Monster = {
        ...mockMonster,
        special: undefined
      };
      expect(() => executeSpecialHandlers(plainMonster, 'onTurnStart', mockCtx, false)).not.toThrow();
    });

    it('should handle monster with empty special object', () => {
      const emptySpecialMonster: Monster = {
        ...mockMonster,
        special: {}
      };
      expect(() => executeSpecialHandlers(emptySpecialMonster, 'onTurnStart', mockCtx, false)).not.toThrow();
    });

    it('should catch and log handler errors in debug mode', () => {
      mockHandler.onTurnStart.mockImplementationOnce(() => {
        throw new Error('Handler failed');
      });

      executeSpecialHandlers(mockMonster, 'onTurnStart', mockCtx, true);
      
      expect(mockConsoleError).toHaveBeenCalledWith(
        'special handler testSpecial failed onTurnStart:',
        expect.any(Error)
      );
    });

    it('should catch handler errors silently when not in debug mode', () => {
      mockHandler.onTurnStart.mockImplementationOnce(() => {
        throw new Error('Handler failed');
      });

      expect(() => executeSpecialHandlers(mockMonster, 'onTurnStart', mockCtx, false)).not.toThrow();
      expect(mockConsoleError).not.toHaveBeenCalled();
    });

    it('should handle unknown special handlers gracefully', () => {
      const multiSpecialMonster: Monster = {
        ...mockMonster,
        special: {
          testSpecial: { value: 10 },
          unknownSpecial: { value: 20 }
        }
      };

      executeSpecialHandlers(multiSpecialMonster, 'onTurnStart', mockCtx, false);
      // Should only call the handler that exists
      expect(mockHandler.onTurnStart).toHaveBeenCalledTimes(1);
      expect(mockHandler.onTurnStart).toHaveBeenCalledWith(mockCtx, { value: 10 });
    });
  });

  describe('logRoundStatus', () => {
    let stateA: MonsterState;
    let stateB: MonsterState;

    beforeEach(() => {
      const monsterA: Monster = {
        name: 'Dragon',
        cr: 5,
        hp: 100,
        ac: 18,
        attack_bonus: 8,
        attacks: [{ name: 'Bite', damage: '2d10+5' }],
        attacks_per_round: 2,
        initiative: 3,
        saves: { fort: 8, ref: 5, will: 6 },
        tags: []
      };

      const monsterB: Monster = {
        name: 'Knight',
        cr: 3,
        hp: 80,
        ac: 20,
        attack_bonus: 6,
        attacks: [{ name: 'Sword', damage: '1d8+4' }],
        attacks_per_round: 1,
        initiative: 2,
        saves: { fort: 6, ref: 4, will: 3 },
        tags: []
      };

      stateA = new MonsterState(monsterA);
      stateB = new MonsterState(monsterB);
    });

    it('should log round header', () => {
      logRoundStatus(1, 'Dragon(1)', 'Knight(2)', stateA, stateB);
      expect(mockConsoleLog).toHaveBeenCalledWith('== Round 1 ==');
    });

    it('should log column headers', () => {
      logRoundStatus(1, 'Dragon(1)', 'Knight(2)', stateA, stateB);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Name'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('HP'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Status'));
    });

    it('should log monster states', () => {
      logRoundStatus(1, 'Dragon(1)', 'Knight(2)', stateA, stateB);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Dragon(1)'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Knight(2)'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('100'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('80'));
    });

    it('should display current HP values', () => {
      stateA.hp = 75;
      stateB.hp = 50;
      logRoundStatus(2, 'Dragon(1)', 'Knight(2)', stateA, stateB);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('75'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('50'));
    });

    it('should show status effects', () => {
      stateA.applyStatus({ name: 'Poisoned', duration: 3 });
      logRoundStatus(1, 'Dragon(1)', 'Knight(2)', stateA, stateB);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Poisoned(3)'));
    });

    it('should show "none" when no status effects', () => {
      logRoundStatus(1, 'Dragon(1)', 'Knight(2)', stateA, stateB);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('none'));
    });

    it('should format different round numbers', () => {
      logRoundStatus(15, 'Dragon(1)', 'Knight(2)', stateA, stateB);
      expect(mockConsoleLog).toHaveBeenCalledWith('== Round 15 ==');
    });
  });

  describe('logFinalStats', () => {
    let stateA: MonsterState;
    let stateB: MonsterState;

    beforeEach(() => {
      const monsterA: Monster = {
        name: 'Dragon',
        cr: 5,
        hp: 100,
        ac: 18,
        attack_bonus: 8,
        attacks: [{ name: 'Bite', damage: '2d10+5' }],
        attacks_per_round: 2,
        initiative: 3,
        saves: { fort: 8, ref: 5, will: 6 },
        tags: []
      };

      const monsterB: Monster = {
        name: 'Knight',
        cr: 3,
        hp: 80,
        ac: 20,
        attack_bonus: 6,
        attacks: [{ name: 'Sword', damage: '1d8+4' }],
        attacks_per_round: 1,
        initiative: 2,
        saves: { fort: 6, ref: 4, will: 3 },
        tags: []
      };

      stateA = new MonsterState(monsterA);
      stateB = new MonsterState(monsterB);
    });

    it('should log table headers', () => {
      logFinalStats('Dragon(1)', 'Knight(2)', stateA, stateB);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('HP'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Name'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Damage'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Status'));
    });

    it('should display start and end HP', () => {
      stateA.hp = 45;
      stateB.hp = 0;
      logFinalStats('Dragon(1)', 'Knight(2)', stateA, stateB);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('100'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('45'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('80'));
    });

    it('should display damage dealt', () => {
      stateA.damageDealt = 120;
      stateB.damageDealt = 55;
      logFinalStats('Dragon(1)', 'Knight(2)', stateA, stateB);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('120'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('55'));
    });

    it('should display status totals', () => {
      stateA.statusTotals.set('Poisoned', 5);
      stateA.statusTotals.set('Stunned', 2);
      logFinalStats('Dragon(1)', 'Knight(2)', stateA, stateB);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Poisoned(5)'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Stunned(2)'));
    });

    it('should show "none" when no status effects', () => {
      logFinalStats('Dragon(1)', 'Knight(2)', stateA, stateB);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('none'));
    });

    it('should filter out zero count statuses', () => {
      stateA.statusTotals.set('Active', 3);
      stateA.statusTotals.set('Inactive', 0);
      logFinalStats('Dragon(1)', 'Knight(2)', stateA, stateB);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Active(3)'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.not.stringContaining('Inactive'));
    });

    it('should display both monster stats', () => {
      stateA.damageDealt = 50;
      stateB.damageDealt = 30;
      logFinalStats('Dragon(1)', 'Knight(2)', stateA, stateB);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Dragon(1)'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Knight(2)'));
    });
  });
});