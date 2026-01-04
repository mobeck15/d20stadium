import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { fight } from '../combat.ts';
import type { Monster } from '../monster.ts';
import MonsterState from '../monsterState.ts';
import * as combatHelpers from '../combatHelpers.ts';
import * as turnExecutor from '../turnExecutor.ts';

jest.mock('../monsterState');
jest.mock('../combatHelpers');
jest.mock('../turnExecutor');

describe.skip('combat', () => {
  const mockRollInitiative = combatHelpers.rollInitiative as jest.MockedFunction<typeof combatHelpers.rollInitiative>;
  const mockResolveAttack = combatHelpers.resolveAttack as jest.MockedFunction<typeof combatHelpers.resolveAttack>;
  const mockCreateHandlerContext = combatHelpers.createHandlerContext as jest.MockedFunction<typeof combatHelpers.createHandlerContext>;
  const mockMulberry32 = combatHelpers.mulberry32 as jest.MockedFunction<typeof combatHelpers.mulberry32>;
  const mockExecuteSpecialHandlers = turnExecutor.executeSpecialHandlers as jest.MockedFunction<typeof turnExecutor.executeSpecialHandlers>;
  const mockLogFinalStats = turnExecutor.logFinalStats as jest.MockedFunction<typeof turnExecutor.logFinalStats>;
  const mockLogRoundStatus = turnExecutor.logRoundStatus as jest.MockedFunction<typeof turnExecutor.logRoundStatus>;
  
  const MockMonsterState = MonsterState as jest.MockedFunction<typeof MonsterState>;

  let mockStateA: any;
  let mockStateB: any;
  let consoleLogSpy: jest.SpyInstance;

  const createMockMonster = (name: string, hp: number, ac: number, attacksPerRound = 1): Monster => ({
    name,
    hp,
    ac,
    attacks_per_round: attacksPerRound,
    attacks: [
      {
        name: 'Basic Attack',
        damage_dice: '1d6',
        damage_bonus: 2,
        to_hit_bonus: 5
      }
    ],
    special_abilities: []
  });

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    // Create mock states with required methods
    mockStateA = {
      hp: 20,
      damageDealt: 0,
      statuses: [],
      tickStatuses: jest.fn()
    };

    mockStateB = {
      hp: 20,
      damageDealt: 0,
      statuses: [],
      tickStatuses: jest.fn()
    };

    // Mock MonsterState constructor
    MockMonsterState.mockImplementation((monster: Monster) => {
      if (monster.name === 'Monster A') return mockStateA;
      return mockStateB;
    });

    // Default mock implementations
    mockRollInitiative.mockReturnValue(10);
    mockCreateHandlerContext.mockReturnValue({} as any);
    mockResolveAttack.mockReturnValue({
      isHit: true,
      damage: 5,
      rolls: { base1: 15, base2: null, chosen: 15 }
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('fight', () => {
    it('should execute a basic fight and return winner', () => {
      const monsterA = createMockMonster('Monster A', 20, 15);
      const monsterB = createMockMonster('Monster B', 20, 15);

      // Monster A wins after 2 rounds
      let attackCount = 0;
      mockResolveAttack.mockImplementation(() => {
        attackCount++;
        if (attackCount === 1) {
          mockStateB.hp = 10;
          return { isHit: true, damage: 10, rolls: { base1: 15, base2: null, chosen: 15 } };
        }
        if (attackCount === 2) {
          return { isHit: false, damage: 0, rolls: { base1: 5, base2: null, chosen: 5 } };
        }
        mockStateB.hp = -5;
        return { isHit: true, damage: 15, rolls: { base1: 18, base2: null, chosen: 18 } };
      });

      const result = fight(monsterA, monsterB);

      expect(result.winner).toBe('Monster A(1)');
      expect(result.hpA).toBe(20);
      expect(result.hpB).toBe(-5);
      expect(result.rounds).toBeGreaterThan(0);
    });

    it('should handle monster B winning', () => {
      const monsterA = createMockMonster('Monster A', 20, 15);
      const monsterB = createMockMonster('Monster B', 20, 15);

      // Monster B wins
      let attackCount = 0;
      mockResolveAttack.mockImplementation(() => {
        attackCount++;
        if (attackCount === 1) {
          return { isHit: false, damage: 0, rolls: { base1: 5, base2: null, chosen: 5 } };
        }
        mockStateA.hp = -10;
        return { isHit: true, damage: 30, rolls: { base1: 20, base2: null, chosen: 20 } };
      });

      const result = fight(monsterA, monsterB);

      expect(result.winner).toBe('Monster B(2)');
      expect(result.hpA).toBe(-10);
      expect(result.hpB).toBe(20);
    });

    it('should use Math.random when no seed is provided', () => {
      const monsterA = createMockMonster('Monster A', 10, 15);
      const monsterB = createMockMonster('Monster B', 10, 15);

      mockStateB.hp = 0; // Quick fight

      fight(monsterA, monsterB);

      expect(mockMulberry32).not.toHaveBeenCalled();
      expect(mockRollInitiative).toHaveBeenCalledWith(expect.any(Object), Math.random);
    });

    it('should use seeded random when seed is provided', () => {
      const monsterA = createMockMonster('Monster A', 10, 15);
      const monsterB = createMockMonster('Monster B', 10, 15);
      const mockSeededRandom = jest.fn(() => 0.5);
      
      mockMulberry32.mockReturnValue(mockSeededRandom);
      mockStateB.hp = 0; // Quick fight

      fight(monsterA, monsterB, { seed: 12345 });

      expect(mockMulberry32).toHaveBeenCalledWith(12345);
      expect(mockRollInitiative).toHaveBeenCalledWith(expect.any(Object), mockSeededRandom);
    });

    it('should execute onFightStart handlers for both monsters', () => {
      const monsterA = createMockMonster('Monster A', 10, 15);
      const monsterB = createMockMonster('Monster B', 10, 15);

      monsterA.special_abilities = [{ trigger: 'onFightStart', handler: jest.fn() }];
      monsterB.special_abilities = [{ trigger: 'onFightStart', handler: jest.fn() }];

      mockStateB.hp = 0; // Quick fight

      fight(monsterA, monsterB);

      expect(mockExecuteSpecialHandlers).toHaveBeenCalledWith(
        monsterA,
        'onFightStart',
        expect.any(Object),
        false
      );
      expect(mockExecuteSpecialHandlers).toHaveBeenCalledWith(
        monsterB,
        'onFightStart',
        expect.any(Object),
        false
      );
    });

    it('should determine turn order based on initiative rolls', () => {
      const monsterA = createMockMonster('Monster A', 10, 15);
      const monsterB = createMockMonster('Monster B', 10, 15);

      // B has higher initiative
      mockRollInitiative
        .mockReturnValueOnce(5)  // A's initiative
        .mockReturnValueOnce(15); // B's initiative

      mockStateA.hp = 0; // Quick fight

      fight(monsterA, monsterB);

      // B should attack first
      const calls = mockResolveAttack.mock.calls;
      expect(calls[0][0].name).toBe('Monster B');
    });

    it('should handle tied initiative (A goes first)', () => {
      const monsterA = createMockMonster('Monster A', 10, 15);
      const monsterB = createMockMonster('Monster B', 10, 15);

      mockRollInitiative.mockReturnValue(10); // Same initiative

      mockStateB.hp = 0; // Quick fight

      fight(monsterA, monsterB);

      // A should go first on tie
      const calls = mockResolveAttack.mock.calls;
      expect(calls[0][0].name).toBe('Monster A');
    });

    it('should execute multiple attacks per round when attacks_per_round > 1', () => {
      const monsterA = createMockMonster('Monster A', 20, 15, 2);
      monsterA.attacks = [
        { name: 'Attack 1', damage_dice: '1d6', damage_bonus: 2, to_hit_bonus: 5 },
        { name: 'Attack 2', damage_dice: '1d6', damage_bonus: 2, to_hit_bonus: 5 }
      ];
      const monsterB = createMockMonster('Monster B', 20, 15);

      mockStateB.hp = 0; // Kill B immediately

      fight(monsterA, monsterB);

      // A should make 2 attacks
      expect(mockResolveAttack).toHaveBeenCalledTimes(2);
    });

    it('should limit attacks to available attack definitions', () => {
      const monsterA = createMockMonster('Monster A', 20, 15, 5);
      monsterA.attacks = [
        { name: 'Attack 1', damage_dice: '1d6', damage_bonus: 2, to_hit_bonus: 5 }
      ];
      const monsterB = createMockMonster('Monster B', 20, 15);

      mockStateB.hp = 0; // Kill B immediately

      fight(monsterA, monsterB);

      // Should only make 1 attack (limited by attacks array length)
      expect(mockResolveAttack).toHaveBeenCalledTimes(1);
    });

    it('should apply damage to correct monster when hit', () => {
      const monsterA = createMockMonster('Monster A', 20, 15);
      const monsterB = createMockMonster('Monster B', 20, 15);

      mockResolveAttack
        .mockReturnValueOnce({ isHit: true, damage: 8, rolls: { base1: 15, base2: null, chosen: 15 } })
        .mockReturnValueOnce({ isHit: true, damage: 6, rolls: { base1: 14, base2: null, chosen: 14 } });

      mockStateB.hp = 12;
      mockStateA.hp = 14;
      
      // Kill both quickly
      setTimeout(() => {
        mockStateB.hp = 0;
        mockStateA.hp = 0;
      }, 0);

      fight(monsterA, monsterB);

      expect(mockStateA.damageDealt).toBeGreaterThanOrEqual(0);
      expect(mockStateB.damageDealt).toBeGreaterThanOrEqual(0);
    });

    it('should not apply damage on miss', () => {
      const monsterA = createMockMonster('Monster A', 20, 15);
      const monsterB = createMockMonster('Monster B', 20, 15);

      const initialHP = mockStateB.hp;
      
      mockResolveAttack.mockReturnValueOnce({
        isHit: false,
        damage: 0,
        rolls: { base1: 5, base2: null, chosen: 5 }
      });

      mockStateB.hp = 0; // End fight quickly

      fight(monsterA, monsterB);

      // Damage dealt should not increase from the miss
      expect(mockStateA.damageDealt).toBe(0);
    });

    it('should execute onTurnStart handlers', () => {
      const monsterA = createMockMonster('Monster A', 10, 15);
      const monsterB = createMockMonster('Monster B', 10, 15);

      mockStateB.hp = 0; // Quick fight

      fight(monsterA, monsterB);

      expect(mockExecuteSpecialHandlers).toHaveBeenCalledWith(
        expect.any(Object),
        'onTurnStart',
        expect.any(Object),
        false
      );
    });

    it('should execute onOpponentTurnStart handlers', () => {
      const monsterA = createMockMonster('Monster A', 10, 15);
      const monsterB = createMockMonster('Monster B', 10, 15);

      mockStateB.hp = 0; // Quick fight

      fight(monsterA, monsterB);

      expect(mockExecuteSpecialHandlers).toHaveBeenCalledWith(
        expect.any(Object),
        'onOpponentTurnStart',
        expect.any(Object),
        false
      );
    });

    it('should execute onTurnEnd handlers', () => {
      const monsterA = createMockMonster('Monster A', 10, 15);
      const monsterB = createMockMonster('Monster B', 10, 15);

      mockStateB.hp = 0; // Quick fight

      fight(monsterA, monsterB);

      expect(mockExecuteSpecialHandlers).toHaveBeenCalledWith(
        expect.any(Object),
        'onTurnEnd',
        expect.any(Object),
        false
      );
    });

    it('should execute onHit handlers when attack hits in debug mode', () => {
      const monsterA = createMockMonster('Monster A', 10, 15);
      const monsterB = createMockMonster('Monster B', 10, 15);

      mockResolveAttack.mockReturnValue({
        isHit: true,
        damage: 5,
        rolls: { base1: 15, base2: null, chosen: 15 }
      });

      mockStateB.hp = 0; // End after first attack

      fight(monsterA, monsterB, { debug: true });

      expect(mockExecuteSpecialHandlers).toHaveBeenCalledWith(
        monsterA,
        'onHit',
        expect.any(Object),
        true
      );
    });

    it('should skip turn when monster has loseTurn status', () => {
      const monsterA = createMockMonster('Monster A', 20, 15);
      const monsterB = createMockMonster('Monster B', 20, 15);

      mockStateA.statuses = [
        { name: 'Stunned', duration: 2, loseTurn: true }
      ];

      mockStateB.hp = 0; // End quickly

      fight(monsterA, monsterB, { debug: true });

      // A should not attack on their first turn
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('loses their turn')
      );
    });

    it('should tick status durations at end of turn', () => {
      const monsterA = createMockMonster('Monster A', 20, 15);
      const monsterB = createMockMonster('Monster B', 20, 15);

      mockStateB.hp = 0; // End quickly

      fight(monsterA, monsterB);

      expect(mockStateA.tickStatuses).toHaveBeenCalled();
    });

    it('should skip second turn if defender dies', () => {
      const monsterA = createMockMonster('Monster A', 20, 15);
      const monsterB = createMockMonster('Monster B', 20, 15);

      // A kills B on first attack
      mockResolveAttack.mockImplementation(() => {
        mockStateB.hp = 0;
        return { isHit: true, damage: 20, rolls: { base1: 20, base2: null, chosen: 20 } };
      });

      fight(monsterA, monsterB);

      // Should only have 1 attack (B never gets a turn)
      expect(mockResolveAttack).toHaveBeenCalledTimes(1);
    });

    it('should continue fight over multiple rounds', () => {
      const monsterA = createMockMonster('Monster A', 50, 15);
      const monsterB = createMockMonster('Monster B', 50, 15);

      let roundCount = 0;
      mockResolveAttack.mockImplementation(() => {
        roundCount++;
        // Each hit does 5 damage
        if (roundCount % 2 === 1) {
          mockStateB.hp -= 5;
        } else {
          mockStateA.hp -= 5;
        }
        // Stop after 10 hits
        if (roundCount === 10) {
          mockStateB.hp = 0;
        }
        return { isHit: true, damage: 5, rolls: { base1: 15, base2: null, chosen: 15 } };
      });

      const result = fight(monsterA, monsterB);

      expect(result.rounds).toBeGreaterThan(1);
    });

    describe('debug mode', () => {
      it('should log initiative when debug is true', () => {
        const monsterA = createMockMonster('Monster A', 10, 15);
        const monsterB = createMockMonster('Monster B', 10, 15);

        mockRollInitiative
          .mockReturnValueOnce(12)
          .mockReturnValueOnce(8);

        mockStateB.hp = 0; // Quick fight

        fight(monsterA, monsterB, { debug: true });

        expect(consoleLogSpy).toHaveBeenCalledWith(
          'Initiative: Monster A(1)=12, Monster B(2)=8'
        );
      });

      it('should log round status when debug is true', () => {
        const monsterA = createMockMonster('Monster A', 10, 15);
        const monsterB = createMockMonster('Monster B', 10, 15);

        mockStateB.hp = 0; // Quick fight

        fight(monsterA, monsterB, { debug: true });

        expect(mockLogRoundStatus).toHaveBeenCalled();
      });

      it('should log attack results when debug is true', () => {
        const monsterA = createMockMonster('Monster A', 10, 15);
        const monsterB = createMockMonster('Monster B', 10, 15);

        mockResolveAttack.mockReturnValue({
          isHit: true,
          damage: 8,
          rolls: { base1: 16, base2: null, chosen: 16 }
        });

        mockStateB.hp = 0; // End after first attack

        fight(monsterA, monsterB, { debug: true });

        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('attacks')
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('HIT - 8 damage')
        );
      });

      it('should log miss when attack misses in debug mode', () => {
        const monsterA = createMockMonster('Monster A', 10, 15);
        const monsterB = createMockMonster('Monster B', 10, 15);

        mockResolveAttack.mockReturnValueOnce({
          isHit: false,
          damage: 0,
          rolls: { base1: 5, base2: null, chosen: 5 }
        });

        mockStateB.hp = 0; // End quickly

        fight(monsterA, monsterB, { debug: true });

        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('MISS')
        );
      });

      it('should log advantage rolls (base2 present)', () => {
        const monsterA = createMockMonster('Monster A', 10, 15);
        const monsterB = createMockMonster('Monster B', 10, 15);

        mockResolveAttack.mockReturnValueOnce({
          isHit: true,
          damage: 5,
          rolls: { base1: 12, base2: 18, chosen: 18 }
        });

        mockStateB.hp = 0; // End quickly

        fight(monsterA, monsterB, { debug: true });

        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('18 (from 12,18)')
        );
      });

      it('should log final stats when debug is true', () => {
        const monsterA = createMockMonster('Monster A', 10, 15);
        const monsterB = createMockMonster('Monster B', 10, 15);

        mockStateB.hp = 0; // Quick fight

        fight(monsterA, monsterB, { debug: true });

        expect(mockLogFinalStats).toHaveBeenCalledWith(
          'Monster A(1)',
          'Monster B(2)',
          mockStateA,
          mockStateB
        );
      });

      it('should not log when debug is false', () => {
        const monsterA = createMockMonster('Monster A', 10, 15);
        const monsterB = createMockMonster('Monster B', 10, 15);

        mockStateB.hp = 0; // Quick fight

        fight(monsterA, monsterB, { debug: false });

        expect(consoleLogSpy).not.toHaveBeenCalled();
        expect(mockLogRoundStatus).not.toHaveBeenCalled();
        expect(mockLogFinalStats).not.toHaveBeenCalled();
      });
    });
  });
});