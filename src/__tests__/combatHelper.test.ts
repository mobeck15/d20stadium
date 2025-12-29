import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Monster } from '../monster.js';
import MonsterState from '../monsterState.js';

// Mock dice module
const mockRollDice = jest.fn();
jest.unstable_mockModule('../dice.js', () => ({
  rollDice: mockRollDice
}));

// Import after mocks are set up
const { mulberry32, rollInitiative, resolveAttack, createHandlerContext } = await import('../combatHelpers.js');

describe('combatHelpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('mulberry32', () => {
    it('should return a function', () => {
      const rng = mulberry32(12345);
      expect(typeof rng).toBe('function');
    });

    it('should generate deterministic sequence', () => {
      const rng1 = mulberry32(12345);
      const rng2 = mulberry32(12345);
      
      const seq1 = [rng1(), rng1(), rng1()];
      const seq2 = [rng2(), rng2(), rng2()];
      
      expect(seq1).toEqual(seq2);
    });

    it('should generate numbers between 0 and 1', () => {
      const rng = mulberry32(12345);
      for (let i = 0; i < 100; i++) {
        const val = rng();
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(1);
      }
    });

    it('should generate different sequences for different seeds', () => {
      const rng1 = mulberry32(12345);
      const rng2 = mulberry32(54321);
      
      const val1 = rng1();
      const val2 = rng2();
      
      expect(val1).not.toBe(val2);
    });
  });

  describe('rollInitiative', () => {
    const mockMonster: Monster = {
      name: 'Test Monster',
      cr: 1,
      hp: 100,
      ac: 15,
      attack_bonus: 5,
      attacks: [{ name: 'Claw', damage: '1d6+3' }],
      attacks_per_round: 1,
      initiative: 3,
      saves: { fort: 3, ref: 2, will: 1 },
      tags: []
    };

    it('should add initiative bonus to d20 roll', () => {
      const mockRandom = jest.fn().mockReturnValue(0.5) as unknown as () => number;
      const result = rollInitiative(mockMonster, mockRandom);
      // 0.5 * 20 = 10, floor + 1 = 11, + 3 initiative = 14
      expect(result).toBe(14);
    });

    it('should handle maximum roll', () => {
      const mockRandom = jest.fn().mockReturnValue(0.99) as unknown as () => number;
      const result = rollInitiative(mockMonster, mockRandom);
      // 0.99 * 20 = 19.8, floor + 1 = 20, + 3 initiative = 23
      expect(result).toBe(23);
    });

    it('should handle minimum roll', () => {
      const mockRandom = jest.fn().mockReturnValue(0.01) as unknown as () => number;
      const result = rollInitiative(mockMonster, mockRandom);
      // 0.01 * 20 = 0.2, floor + 1 = 1, + 3 initiative = 4
      expect(result).toBe(4);
    });

    it('should handle zero initiative bonus', () => {
      const zeroInitMonster = { ...mockMonster, initiative: 0 };
      const mockRandom = jest.fn().mockReturnValue(0.5) as unknown as () => number;
      const result = rollInitiative(zeroInitMonster, mockRandom);
      // 0.5 * 20 = 10, floor + 1 = 11, + 0 = 11
      expect(result).toBe(11);
    });

    it('should handle negative initiative bonus', () => {
      const negInitMonster = { ...mockMonster, initiative: -2 };
      const mockRandom = jest.fn().mockReturnValue(0.5) as unknown as () => number;
      const result = rollInitiative(negInitMonster, mockRandom);
      // 0.5 * 20 = 10, floor + 1 = 11, - 2 = 9
      expect(result).toBe(9);
    });
  });

  describe('resolveAttack', () => {
    const mockAttacker: Monster = {
      name: 'Attacker',
      cr: 1,
      hp: 100,
      ac: 15,
      attack_bonus: 5,
      attacks: [{ name: 'Sword', damage: '1d8+3' }],
      attacks_per_round: 1,
      initiative: 2,
      saves: { fort: 3, ref: 2, will: 1 },
      tags: []
    };

    const mockDefender: Monster = {
      name: 'Defender',
      cr: 1,
      hp: 80,
      ac: 14,
      attack_bonus: 4,
      attacks: [{ name: 'Claw', damage: '1d6+2' }],
      attacks_per_round: 1,
      initiative: 1,
      saves: { fort: 2, ref: 3, will: 2 },
      tags: []
    };

    let attackerState: MonsterState;
    let defenderState: MonsterState;

    beforeEach(() => {
      attackerState = new MonsterState(mockAttacker);
      defenderState = new MonsterState(mockDefender);
    });

    it('should hit when roll meets AC', () => {
      const mockRandom = jest.fn()
        .mockReturnValueOnce(0.45) as unknown as () => number; // d20 roll: floor(0.45 * 20) + 1 = 10
      mockRollDice.mockReturnValue(10);

      const attack = { name: 'Sword', damage: '1d8+3' };
      const result = resolveAttack(mockAttacker, mockDefender, attackerState, defenderState, attack, mockRandom);

      // Roll: 9 + 5 (attack bonus) = 14, AC is 14, should hit
      expect(result.isHit).toBe(true);
      expect(result.damage).toBe(10);
      expect(result.rolls.base1).toBe(10);
    });

    it('should miss when roll is below AC', () => {
      const mockRandom = jest.fn()
        .mockReturnValueOnce(0.05) as unknown as () => number; // d20 roll: floor(0.05 * 20) + 1 = 2
      
      const attack = { name: 'Sword', damage: '1d8+3' };
      const result = resolveAttack(mockAttacker, mockDefender, attackerState, defenderState, attack, mockRandom);

      // Roll: 2 + 5 = 7, AC is 14, should miss
      expect(result.isHit).toBe(false);
      expect(result.damage).toBe(0);
    });

    it('should apply attack penalties', () => {
      attackerState.applyStatus({ name: 'Weakened', duration: 2, attackPenalty: -3 });
      const mockRandom = jest.fn()
        .mockReturnValueOnce(0.45) as unknown as () => number; // d20 roll: 9
      mockRollDice.mockReturnValue(8);

      const attack = { name: 'Sword', damage: '1d8+3' };
      const result = resolveAttack(mockAttacker, mockDefender, attackerState, defenderState, attack, mockRandom);

      // Roll: 9 + 5 - 3 = 11, AC is 14, should miss
      expect(result.isHit).toBe(false);
    });

    it('should use attack-specific bonus when provided', () => {
      const mockRandom = jest.fn()
        .mockReturnValueOnce(0.45) as unknown as () => number; // d20 roll: 9
      mockRollDice.mockReturnValue(10);

      const attack = { name: 'Special Sword', damage: '1d8+3', bonus: 8 };
      const result = resolveAttack(mockAttacker, mockDefender, attackerState, defenderState, attack, mockRandom);

      // Roll: 9 + 8 (specific bonus) = 17, AC is 14, should hit
      expect(result.isHit).toBe(true);
      expect(result.damage).toBe(10);
    });

    it('should grant advantage when defender has advantageAgainst status', () => {
      defenderState.applyStatus({ name: 'Blurred', duration: 2, advantageAgainst: true });
      const mockRandom = jest.fn()
        .mockReturnValueOnce(0.25) // First roll: 6
        .mockReturnValueOnce(0.55) as unknown as () => number; // Second roll: 12
      mockRollDice.mockReturnValue(10);

      const attack = { name: 'Sword', damage: '1d8+3' };
      const result = resolveAttack(mockAttacker, mockDefender, attackerState, defenderState, attack, mockRandom);

      // Should take higher roll (12) + 5 = 17, AC is 14, should hit
      expect(result.rolls.base1).toBe(6);
      expect(result.rolls.base2).toBe(12);
      expect(result.rolls.chosen).toBe(12);
      expect(result.isHit).toBe(true);
    });

    it('should not grant advantage when no advantageAgainst status', () => {
      const mockRandom = jest.fn()
        .mockReturnValueOnce(0.45) as unknown as () => number;
      mockRollDice.mockReturnValue(10);

      const attack = { name: 'Sword', damage: '1d8+3' };
      const result = resolveAttack(mockAttacker, mockDefender, attackerState, defenderState, attack, mockRandom);

      expect(result.rolls.base2).toBe(null);
      expect(mockRandom).toHaveBeenCalledTimes(1);
    });

    it('should not roll damage on miss', () => {
      const mockRandom = jest.fn()
        .mockReturnValueOnce(0.01) as unknown as () => number;

      const attack = { name: 'Sword', damage: '1d8+3' };
      resolveAttack(mockAttacker, mockDefender, attackerState, defenderState, attack, mockRandom);

      expect(mockRollDice).not.toHaveBeenCalled();
    });

    it('should call rollDice with correct parameters on hit', () => {
      const mockRandom = jest.fn()
        .mockReturnValueOnce(0.95) as unknown as () => number;
      mockRollDice.mockReturnValue(15);

      const attack = { name: 'Sword', damage: '1d8+3' };
      resolveAttack(mockAttacker, mockDefender, attackerState, defenderState, attack, mockRandom);

      expect(mockRollDice).toHaveBeenCalledWith('1d8+3', mockRandom);
    });
  });

  describe('createHandlerContext', () => {
    const monsterA: Monster = {
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

    const monsterB: Monster = {
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

    it('should create context with all required fields', () => {
      const stateA = new MonsterState(monsterA);
      const stateB = new MonsterState(monsterB);
      const mockRandom = jest.fn() as unknown as () => number;

      const ctx = createHandlerContext(
        monsterA, monsterB,
        stateA, stateB,
        monsterA, monsterB,
        'Dragon(1)', 'Knight(2)',
        mockRandom,
        true
      );

      expect(ctx.a).toBe(monsterA);
      expect(ctx.b).toBe(monsterB);
      expect(ctx.attackerState).toBe(stateA);
      expect(ctx.defenderState).toBe(stateB);
      expect(ctx.attacker).toBe(monsterA);
      expect(ctx.defender).toBe(monsterB);
      expect(ctx.attackerLabel).toBe('Dragon(1)');
      expect(ctx.defenderLabel).toBe('Knight(2)');
      expect(ctx.random).toBe(mockRandom);
      expect(ctx.debug).toBe(true);
    });

    it('should handle debug false', () => {
      const stateA = new MonsterState(monsterA);
      const stateB = new MonsterState(monsterB);

      const ctx = createHandlerContext(
        monsterA, monsterB,
        stateA, stateB,
        monsterA, monsterB,
        'Dragon(1)', 'Knight(2)',
        Math.random,
        false
      );

      expect(ctx.debug).toBe(false);
    });

    it('should handle swapped attacker/defender', () => {
      const stateA = new MonsterState(monsterA);
      const stateB = new MonsterState(monsterB);

      const ctx = createHandlerContext(
        monsterA, monsterB,
        stateB, stateA,
        monsterB, monsterA,
        'Knight(2)', 'Dragon(1)',
        Math.random,
        false
      );

      expect(ctx.attacker).toBe(monsterB);
      expect(ctx.defender).toBe(monsterA);
      expect(ctx.attackerState).toBe(stateB);
      expect(ctx.defenderState).toBe(stateA);
      expect(ctx.attackerLabel).toBe('Knight(2)');
      expect(ctx.defenderLabel).toBe('Dragon(1)');
    });
  });
});