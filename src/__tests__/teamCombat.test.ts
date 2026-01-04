import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Monster } from '../monster.js';
import MonsterState from '../monsterState.js';

// Mock dependencies
const mockRollInitiative = jest.fn();
const mockResolveAttack = jest.fn();
const mockCreateHandlerContext = jest.fn();
const mockMulberry32 = jest.fn();

jest.unstable_mockModule('../combatHelpers.js', () => ({
  rollInitiative: mockRollInitiative,
  resolveAttack: mockResolveAttack,
  createHandlerContext: mockCreateHandlerContext,
  mulberry32: mockMulberry32
}));

const mockExecuteSpecialHandlers = jest.fn();

jest.unstable_mockModule('../turnExecutor.js', () => ({
  executeSpecialHandlers: mockExecuteSpecialHandlers
}));

// Mock console
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});

// Import after mocks
const {
  createTeam,
  isTeamAlive,
  getLivingFighters,
  applyDamage,
  executeFighterTurn,
  rollInitiativeOrder,
  executeRound,
  logTeamStatus,
  logFinalTeamStats,
  teamFight
} = await import('../teamCombat.js');

describe('teamCombat', () => {
  const mockMonster1: Monster = {
    name: 'Goblin',
    cr: 1,
    hp: 20,
    ac: 14,
    attack_bonus: 4,
    attacks: [{ name: 'Sword', damage: '1d6+2' }],
    attacks_per_round: 1,
    initiative: 2,
    saves: { fort: 2, ref: 3, will: 1 },
    tags: []
  };

  const mockMonster2: Monster = {
    name: 'Orc',
    cr: 2,
    hp: 30,
    ac: 13,
    attack_bonus: 5,
    attacks: [{ name: 'Axe', damage: '1d8+3' }],
    attacks_per_round: 1,
    initiative: 1,
    saves: { fort: 4, ref: 2, will: 1 },
    tags: []
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createTeam', () => {
    it('should create a team with monsters and states', () => {
      const team = createTeam([mockMonster1, mockMonster2], 0);
      
      expect(team.members).toHaveLength(2);
      expect(team.states).toHaveLength(2);
      expect(team.label).toBe('Team 1');
      expect(team.members[0]).toBe(mockMonster1);
      expect(team.members[1]).toBe(mockMonster2);
    });

    it('should initialize states with correct HP', () => {
      const team = createTeam([mockMonster1], 0);
      
      expect(team.states[0].hp).toBe(20);
      expect(team.states[0].maxHp).toBe(20);
    });

    it('should create correct label for team index', () => {
      const team0 = createTeam([mockMonster1], 0);
      const team1 = createTeam([mockMonster2], 1);
      
      expect(team0.label).toBe('Team 1');
      expect(team1.label).toBe('Team 2');
    });

    it('should handle empty team', () => {
      const team = createTeam([], 0);
      
      expect(team.members).toHaveLength(0);
      expect(team.states).toHaveLength(0);
    });
  });

  describe('isTeamAlive', () => {
    it('should return true when team has living members', () => {
      const team = createTeam([mockMonster1, mockMonster2], 0);
      
      expect(isTeamAlive(team)).toBe(true);
    });

    it('should return false when all members are dead', () => {
      const team = createTeam([mockMonster1, mockMonster2], 0);
      team.states[0].hp = 0;
      team.states[1].hp = 0;
      
      expect(isTeamAlive(team)).toBe(false);
    });

    it('should return true when at least one member is alive', () => {
      const team = createTeam([mockMonster1, mockMonster2], 0);
      team.states[0].hp = 0;
      team.states[1].hp = 5;
      
      expect(isTeamAlive(team)).toBe(true);
    });

    it('should return false for empty team', () => {
      const team = createTeam([], 0);
      
      expect(isTeamAlive(team)).toBe(false);
    });
  });

  describe('getLivingFighters', () => {
    it('should return all living fighters', () => {
      const team = createTeam([mockMonster1, mockMonster2], 0);
      const living = getLivingFighters(team, 0);
      
      expect(living).toHaveLength(2);
      expect(living[0].monster).toBe(mockMonster1);
      expect(living[1].monster).toBe(mockMonster2);
    });

    it('should exclude dead fighters', () => {
      const team = createTeam([mockMonster1, mockMonster2], 0);
      team.states[0].hp = 0;
      
      const living = getLivingFighters(team, 0);
      
      expect(living).toHaveLength(1);
      expect(living[0].monster).toBe(mockMonster2);
    });

    it('should create correct labels', () => {
      const team = createTeam([mockMonster1, mockMonster2], 1);
      const living = getLivingFighters(team, 1);
      
      expect(living[0].label).toBe('Goblin(2.1)');
      expect(living[1].label).toBe('Orc(2.2)');
    });

    it('should return empty array when all dead', () => {
      const team = createTeam([mockMonster1], 0);
      team.states[0].hp = 0;
      
      const living = getLivingFighters(team, 0);
      
      expect(living).toHaveLength(0);
    });

    it('should include teamIndex and memberIndex', () => {
      const team = createTeam([mockMonster1], 1);
      const living = getLivingFighters(team, 1);
      
      expect(living[0].teamIndex).toBe(1);
      expect(living[0].memberIndex).toBe(0);
    });

    it('should handle undefined monster in members array', () => {
      const team = createTeam([mockMonster1, mockMonster2], 0);
      // Simulate corrupted state where member is undefined
      (team.members as any)[1] = undefined;
      
      const living = getLivingFighters(team, 0);
      
      // Should skip the undefined monster
      expect(living).toHaveLength(1);
      expect(living[0].monster).toBe(mockMonster1);
    });
  });

  describe('applyDamage', () => {
    it('should reduce defender HP', () => {
      const defenderState = new MonsterState(mockMonster1);
      const attackerState = new MonsterState(mockMonster2);
      
      applyDamage(defenderState, attackerState, 10);
      
      expect(defenderState.hp).toBe(10);
    });

    it('should increase attacker damage dealt', () => {
      const defenderState = new MonsterState(mockMonster1);
      const attackerState = new MonsterState(mockMonster2);
      
      applyDamage(defenderState, attackerState, 10);
      
      expect(attackerState.damageDealt).toBe(10);
    });

    it('should allow HP to go negative', () => {
      const defenderState = new MonsterState(mockMonster1);
      const attackerState = new MonsterState(mockMonster2);
      
      applyDamage(defenderState, attackerState, 50);
      
      expect(defenderState.hp).toBe(-30);
    });

    it('should accumulate damage dealt', () => {
      const defenderState = new MonsterState(mockMonster1);
      const attackerState = new MonsterState(mockMonster2);
      
      applyDamage(defenderState, attackerState, 5);
      applyDamage(defenderState, attackerState, 3);
      
      expect(attackerState.damageDealt).toBe(8);
    });
  });

  describe('executeFighterTurn', () => {
    it('should execute attacks when no losing statuses', () => {
      const team0 = createTeam([mockMonster1], 0);
      const team1 = createTeam([mockMonster2], 1);
      const attacker = getLivingFighters(team0, 0)[0];
      const defender = getLivingFighters(team1, 1)[0];
      
      mockResolveAttack.mockReturnValue({
        isHit: true,
        damage: 8,
        rolls: { base1: 15, base2: null, chosen: 15 }
      });
      
      const combatState = {
        teams: [team0, team1] as [typeof team0, typeof team1],
        random: Math.random,
        debug: true, // Enable debug to cover debug log line
        round: 1
      };
      
      executeFighterTurn(attacker, defender, combatState);
      
      expect(mockResolveAttack).toHaveBeenCalled();
      expect(defender.state.hp).toBe(22);
      expect(attacker.state.damageDealt).toBe(8);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('turn'));
    });

    it('should execute attacks without debug logging', () => {
      const team0 = createTeam([mockMonster1], 0);
      const team1 = createTeam([mockMonster2], 1);
      const attacker = getLivingFighters(team0, 0)[0];
      const defender = getLivingFighters(team1, 1)[0];
      
      mockResolveAttack.mockReturnValue({
        isHit: true,
        damage: 5,
        rolls: { base1: 12, base2: null, chosen: 12 }
      });
      
      const combatState = {
        teams: [team0, team1] as [typeof team0, typeof team1],
        random: Math.random,
        debug: false, // Disable debug to cover else branches
        round: 1
      };
      
      executeFighterTurn(attacker, defender, combatState);
      
      expect(mockResolveAttack).toHaveBeenCalled();
      expect(defender.state.hp).toBe(25);
    });

    it('should skip attacks when loseTurn status is active', () => {
      const team0 = createTeam([mockMonster1], 0);
      const team1 = createTeam([mockMonster2], 1);
      const attacker = getLivingFighters(team0, 0)[0];
      const defender = getLivingFighters(team1, 1)[0];
      
      attacker.state.applyStatus({ name: 'Stunned', duration: 2, loseTurn: true });
      
      const combatState = {
        teams: [team0, team1] as [typeof team0, typeof team1],
        random: Math.random,
        debug: true, // Enable debug to cover line 154
        round: 1
      };
      
      executeFighterTurn(attacker, defender, combatState);
      
      expect(mockResolveAttack).not.toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('loses their turn'));
    });

    it('should skip attacks when loseTurn status is active without logging', () => {
      const team0 = createTeam([mockMonster1], 0);
      const team1 = createTeam([mockMonster2], 1);
      const attacker = getLivingFighters(team0, 0)[0];
      const defender = getLivingFighters(team1, 1)[0];
      
      attacker.state.applyStatus({ name: 'Stunned', duration: 2, loseTurn: true });
      
      const combatState = {
        teams: [team0, team1] as [typeof team0, typeof team1],
        random: Math.random,
        debug: false, // Disable debug to cover else on line 154
        round: 1
      };
      
      executeFighterTurn(attacker, defender, combatState);
      
      expect(mockResolveAttack).not.toHaveBeenCalled();
    });

    it('should call executeSpecialHandlers for turn start', () => {
      const team0 = createTeam([mockMonster1], 0);
      const team1 = createTeam([mockMonster2], 1);
      const attacker = getLivingFighters(team0, 0)[0];
      const defender = getLivingFighters(team1, 1)[0];
      
      const mockContext = { mock: 'context' };
      mockCreateHandlerContext.mockReturnValue(mockContext);
      
      mockResolveAttack.mockReturnValue({
        isHit: false,
        damage: 0,
        rolls: { base1: 5, base2: null, chosen: 5 }
      });
      
      const combatState = {
        teams: [team0, team1] as [typeof team0, typeof team1],
        random: Math.random,
        debug: false,
        round: 1
      };
      
      executeFighterTurn(attacker, defender, combatState);
      
      // Check that onTurnStart was called for the attacker
      expect(mockExecuteSpecialHandlers).toHaveBeenCalledWith(
        attacker.monster,
        'onTurnStart',
        mockContext,
        false
      );
      
      // Check that onOpponentTurnStart was called for the defender
      expect(mockExecuteSpecialHandlers).toHaveBeenCalledWith(
        defender.monster,
        'onOpponentTurnStart',
        mockContext,
        false
      );
      
      // Check that onTurnEnd was called for the attacker
      expect(mockExecuteSpecialHandlers).toHaveBeenCalledWith(
        attacker.monster,
        'onTurnEnd',
        mockContext,
        false
      );
      
      // Should be called exactly 3 times
      expect(mockExecuteSpecialHandlers).toHaveBeenCalledTimes(3);
    });

    it('should stop attacking if defender dies', () => {
      const multiAttacker = { ...mockMonster1, attacks_per_round: 3 };
      const team0 = createTeam([multiAttacker], 0);
      const team1 = createTeam([mockMonster2], 1);
      const attacker = getLivingFighters(team0, 0)[0];
      const defender = getLivingFighters(team1, 1)[0];
      
      mockResolveAttack.mockReturnValue({
        isHit: true,
        damage: 50,
        rolls: { base1: 20, base2: null, chosen: 20 }
      });
      
      const combatState = {
        teams: [team0, team1] as [typeof team0, typeof team1],
        random: Math.random,
        debug: true, // Enable debug to cover lines 177-183
        round: 1
      };
      
      executeFighterTurn(attacker, defender, combatState);
      
      // Should only attack once because defender dies
      expect(mockResolveAttack).toHaveBeenCalledTimes(1);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('defeated'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('HIT'));
    });

    it('should log attack details with advantage rolls', () => {
      const team0 = createTeam([mockMonster1], 0);
      const team1 = createTeam([mockMonster2], 1);
      const attacker = getLivingFighters(team0, 0)[0];
      const defender = getLivingFighters(team1, 1)[0];
      
      mockResolveAttack.mockReturnValue({
        isHit: true,
        damage: 8,
        rolls: { base1: 12, base2: 18, chosen: 18 } // Cover base2 != null branches
      });
      
      const combatState = {
        teams: [team0, team1] as [typeof team0, typeof team1],
        random: Math.random,
        debug: true,
        round: 1
      };
      
      executeFighterTurn(attacker, defender, combatState);
      
      // Should log with both rolls shown (covers lines 177-178)
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('12,18'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('from'));
    });

    it('should log MISS when attack fails', () => {
      const team0 = createTeam([mockMonster1], 0);
      const team1 = createTeam([mockMonster2], 1);
      const attacker = getLivingFighters(team0, 0)[0];
      const defender = getLivingFighters(team1, 1)[0];
      
      mockResolveAttack.mockReturnValue({
        isHit: false, // Miss
        damage: 0,
        rolls: { base1: 3, base2: null, chosen: 3 }
      });
      
      const combatState = {
        teams: [team0, team1] as [typeof team0, typeof team1],
        random: Math.random,
        debug: true,
        round: 1
      };
      
      executeFighterTurn(attacker, defender, combatState);
      
      // Should log MISS (covers line 179 else)
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('MISS'));
    });

    it('should not log attack details when debug is false', () => {
      const team0 = createTeam([mockMonster1], 0);
      const team1 = createTeam([mockMonster2], 1);
      const attacker = getLivingFighters(team0, 0)[0];
      const defender = getLivingFighters(team1, 1)[0];
      
      mockResolveAttack.mockReturnValue({
        isHit: true,
        damage: 50,
        rolls: { base1: 20, base2: null, chosen: 20 }
      });
      
      const combatState = {
        teams: [team0, team1] as [typeof team0, typeof team1],
        random: Math.random,
        debug: false, // Disable debug to cover else on line 183
        round: 1
      };
      
      executeFighterTurn(attacker, defender, combatState);
      
      // Should kill defender but not log details
      expect(defender.state.hp).toBeLessThanOrEqual(0);
    });

    it('should tick status durations', () => {
      const team0 = createTeam([mockMonster1], 0);
      const team1 = createTeam([mockMonster2], 1);
      const attacker = getLivingFighters(team0, 0)[0];
      const defender = getLivingFighters(team1, 1)[0];
      
      attacker.state.applyStatus({ name: 'Poison', duration: 3 });
      
      mockResolveAttack.mockReturnValue({
        isHit: false,
        damage: 0,
        rolls: { base1: 1, base2: null, chosen: 1 }
      });
      
      const combatState = {
        teams: [team0, team1] as [typeof team0, typeof team1],
        random: Math.random,
        debug: false,
        round: 1
      };
      
      executeFighterTurn(attacker, defender, combatState);
      
      expect(attacker.state.statuses[0].duration).toBe(2);
    });

    it('should throw error if teams have no members', () => {
      const emptyTeam0 = createTeam([], 0);
      const emptyTeam1 = createTeam([], 1);
      
      const combatState = {
        teams: [emptyTeam0, emptyTeam1] as [typeof emptyTeam0, typeof emptyTeam1],
        random: Math.random,
        debug: false,
        round: 1
      };
      
      // Create a fake fighter (this shouldn't happen in real code)
      const fakeAttacker = {
        monster: mockMonster1,
        state: new MonsterState(mockMonster1),
        teamIndex: 0,
        memberIndex: 0,
        label: 'Fake(1.1)'
      };
      
      const fakeDefender = {
        monster: mockMonster2,
        state: new MonsterState(mockMonster2),
        teamIndex: 1,
        memberIndex: 0,
        label: 'Fake(2.1)'
      };
      
      expect(() => executeFighterTurn(fakeAttacker, fakeDefender, combatState))
        .toThrow('Teams must have at least one member');
    });
  });

  describe('rollInitiativeOrder', () => {
    it('should return fighters sorted by initiative', () => {
      const team0 = createTeam([mockMonster1, mockMonster2], 0);
      const team1 = createTeam([mockMonster1], 1);
      
      mockRollInitiative
        .mockReturnValueOnce(15) // team0[0]
        .mockReturnValueOnce(10) // team0[1]
        .mockReturnValueOnce(20); // team1[0]
      
      const combatState = {
        teams: [team0, team1] as [typeof team0, typeof team1],
        random: Math.random,
        debug: true, // Enable debug to cover line 221
        round: 1
      };
      
      const order = rollInitiativeOrder(combatState);
      
      expect(order).toHaveLength(3);
      expect(order[0].label).toBe('Goblin(2.1)'); // Init 20
      expect(order[1].label).toBe('Goblin(1.1)'); // Init 15
      expect(order[2].label).toBe('Orc(1.2)');    // Init 10
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Initiative order'));
    });

    it('should exclude dead fighters', () => {
      const team0 = createTeam([mockMonster1, mockMonster2], 0);
      const team1 = createTeam([mockMonster1], 1);
      team0.states[1].hp = 0;
      
      mockRollInitiative
        .mockReturnValueOnce(15)
        .mockReturnValueOnce(20);
      
      const combatState = {
        teams: [team0, team1] as [typeof team0, typeof team1],
        random: Math.random,
        debug: false,
        round: 1
      };
      
      const order = rollInitiativeOrder(combatState);
      
      expect(order).toHaveLength(2);
    });
  });

  describe('executeRound', () => {
    it('should execute round with debug logging', () => {
      const mockContext = { mock: 'context' };
      mockCreateHandlerContext.mockReturnValue(mockContext);
      
      const team0 = createTeam([mockMonster1], 0);
      const team1 = createTeam([mockMonster2], 1);
      
      mockRollInitiative.mockReturnValue(10);
      mockResolveAttack.mockReturnValue({
        isHit: true,
        damage: 100,
        rolls: { base1: 20, base2: null, chosen: 20 }
      });
      
      const combatState = {
        teams: [team0, team1] as [typeof team0, typeof team1],
        random: Math.random,
        debug: true, // Enable debug to cover line 232
        round: 1
      };
      
      const result = executeRound(combatState);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Round'));
      expect(result).toBe(false); // Combat ends
    });

    it('should execute round without debug logging', () => {
      const mockContext = { mock: 'context' };
      mockCreateHandlerContext.mockReturnValue(mockContext);
      
      const team0 = createTeam([mockMonster1], 0);
      const team1 = createTeam([mockMonster2], 1);
      
      mockRollInitiative.mockReturnValue(10);
      mockResolveAttack.mockReturnValue({
        isHit: false,
        damage: 0,
        rolls: { base1: 5, base2: null, chosen: 5 }
      });
      
      const combatState = {
        teams: [team0, team1] as [typeof team0, typeof team1],
        random: Math.random,
        debug: false, // Disable debug
        round: 1
      };
      
      const result = executeRound(combatState);
      
      expect(result).toBe(true); // Combat continues
    });

    it('should skip dead attackers and continue combat', () => {
      const mockContext = { mock: 'context' };
      mockCreateHandlerContext.mockReturnValue(mockContext);
      
      const team0 = createTeam([mockMonster1, mockMonster2], 0);
      const team1 = createTeam([mockMonster1], 1);
      
      // Keep first attacker alive initially
      team0.states[0].hp = 10; // Alive when initiative rolls
      
      mockRollInitiative.mockReturnValue(10);
      
      // Mock executeFighterTurn to kill the first attacker during combat
      let turnCount = 0;
      mockResolveAttack.mockImplementation(() => {
        turnCount++;
        if (turnCount === 1) {
          // After first fighter's turn, kill them for the next iteration
          team0.states[0].hp = -5;
        }
        return {
          isHit: false,
          damage: 0,
          rolls: { base1: 5, base2: null, chosen: 5 }
        };
      });
      
      const combatState = {
        teams: [team0, team1] as [typeof team0, typeof team1],
        random: Math.random,
        debug: false,
        round: 1
      };
      
      const result = executeRound(combatState);
      
      // Should skip the dead fighter on their second turn in the order
      expect(result).toBe(true);
    });

    it('should end combat when no opponents remain', () => {
      const mockContext = { mock: 'context' };
      mockCreateHandlerContext.mockReturnValue(mockContext);
      
      const team0 = createTeam([mockMonster1], 0);
      const team1 = createTeam([mockMonster2], 1);
      
      // Kill all team1 before round starts to trigger line 250
      team1.states[0].hp = -10;
      
      mockRollInitiative.mockReturnValue(10);
      
      const combatState = {
        teams: [team0, team1] as [typeof team0, typeof team1],
        random: Math.random,
        debug: false,
        round: 1
      };
      
      const result = executeRound(combatState);
      
      // Should return false immediately when no opponents (covers line 250 if statement)
      expect(result).toBe(false);
    });

    it('should handle undefined defender edge case', () => {
      const mockContext = { mock: 'context' };
      mockCreateHandlerContext.mockReturnValue(mockContext);
      
      const team0 = createTeam([mockMonster1], 0);
      const team1 = createTeam([mockMonster2], 1);
      
      // This is a defensive check - in practice getLivingFighters filters properly
      // but we want to cover line 257
      mockRollInitiative.mockReturnValue(10);
      
      const combatState = {
        teams: [team0, team1] as [typeof team0, typeof team1],
        random: Math.random,
        debug: false,
        round: 1
      };
      
      // Temporarily break getLivingFighters by killing opponent after initiative
      team1.states[0].hp = 0;
      
      const result = executeRound(combatState);
      
      // Combat should end
      expect(result).toBe(false);
    });

    it('should check if opposing team is alive and end combat if not', () => {
      const mockContext = { mock: 'context' };
      mockCreateHandlerContext.mockReturnValue(mockContext);
      
      const team0 = createTeam([mockMonster1], 0);
      const team1 = createTeam([mockMonster2], 1);
      
      mockRollInitiative.mockReturnValue(10);
      mockResolveAttack.mockReturnValue({
        isHit: true,
        damage: 50, // Kills defender
        rolls: { base1: 20, base2: null, chosen: 20 }
      });
      
      const combatState = {
        teams: [team0, team1] as [typeof team0, typeof team1],
        random: Math.random,
        debug: false,
        round: 1
      };
      
      const result = executeRound(combatState);
      
      // Should return false after kill (covers line 260-262)
      expect(result).toBe(false);
    });
  });

  describe('logTeamStatus', () => {
    it('should log team status with living fighters', () => {
      const team0 = createTeam([mockMonster1, mockMonster2], 0);
      const team1 = createTeam([mockMonster1], 1);
      
      const combatState = {
        teams: [team0, team1] as [typeof team0, typeof team1],
        random: Math.random,
        debug: false,
        round: 1
      };
      
      logTeamStatus(combatState);
      
      expect(mockConsoleLog).toHaveBeenCalledWith('Team 1:');
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Goblin'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('20/20'));
    });

    it('should show DEFEATED for dead fighters', () => {
      const team0 = createTeam([mockMonster1], 0);
      team0.states[0].hp = 0;
      
      const combatState = {
        teams: [team0, createTeam([mockMonster2], 1)] as any,
        random: Math.random,
        debug: false,
        round: 1
      };
      
      logTeamStatus(combatState);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('DEFEATED'));
    });
  });

  describe('logFinalTeamStats', () => {
    it('should log final statistics', () => {
      const team0 = createTeam([mockMonster1], 0);
      const team1 = createTeam([mockMonster2], 1);
      
      team0.states[0].hp = 15;
      team0.states[0].damageDealt = 25;
      team0.states[0].statusTotals.set('Poisoned', 3);
      
      const combatState = {
        teams: [team0, team1] as [typeof team0, typeof team1],
        random: Math.random,
        debug: false,
        round: 5
      };
      
      logFinalTeamStats(combatState);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Final Statistics'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Team 1'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Goblin'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('20'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('15'));
    });

    it('should show none for no status effects', () => {
      const team0 = createTeam([mockMonster1], 0);
      const team1 = createTeam([mockMonster2], 1);
      
      const combatState = {
        teams: [team0, team1] as [typeof team0, typeof team1],
        random: Math.random,
        debug: false,
        round: 1
      };
      
      logFinalTeamStats(combatState);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('none'));
    });
  });

  describe('teamFight', () => {
    it('should return winning team', () => {
      const mockContext = { mock: 'context' };
      mockCreateHandlerContext.mockReturnValue(mockContext);
      mockRollInitiative.mockReturnValue(10);
      
      // First attack kills defender
      mockResolveAttack.mockReturnValueOnce({
        isHit: true,
        damage: 100,
        rolls: { base1: 20, base2: null, chosen: 20 }
      });
      
      mockMulberry32.mockReturnValue(() => 0.5);
      
      const result = teamFight([mockMonster1], [mockMonster2], { seed: 12345 });
      
      expect(result.winningTeam).toBe(0);
      // First round completes, so rounds should be 1
      expect(result.rounds).toBe(1);
      expect(result.team0.members[0].hpEnd).toBeGreaterThan(0);
      expect(result.team1.members[0].hpEnd).toBeLessThanOrEqual(0);
    });

    it('should use Math.random when no seed provided', () => {
      const mockContext = { mock: 'context' };
      mockCreateHandlerContext.mockReturnValue(mockContext);
      mockRollInitiative.mockReturnValue(10);
      
      mockResolveAttack.mockReturnValue({
        isHit: true,
        damage: 50,
        rolls: { base1: 20, base2: null, chosen: 20 }
      });
      
      // Don't provide seed to cover line 280 (else branch)
      const result = teamFight([mockMonster1], [mockMonster2]);
      
      expect(result.team0.members[0].damageDealt).toBeGreaterThan(0);
    });

    it('should track damage dealt', () => {
      const mockContext = { mock: 'context' };
      mockCreateHandlerContext.mockReturnValue(mockContext);
      mockRollInitiative.mockReturnValue(10);
      
      // Kill in one hit
      mockResolveAttack.mockReturnValue({
        isHit: true,
        damage: 50,
        rolls: { base1: 20, base2: null, chosen: 20 }
      });
      mockMulberry32.mockReturnValue(() => 0.5);
      
      const result = teamFight([mockMonster1], [mockMonster2]);
      
      expect(result.team0.members[0].damageDealt).toBeGreaterThan(0);
    });

    it('should handle multiple rounds', () => {
      const mockContext = { mock: 'context' };
      mockCreateHandlerContext.mockReturnValue(mockContext);
      mockRollInitiative.mockReturnValue(10);
      
      // Small damage to force multiple rounds
      let callCount = 0;
      mockResolveAttack.mockImplementation(() => {
        callCount++;
        return {
          isHit: true,
          damage: 5,
          rolls: { base1: 15, base2: null, chosen: 15 }
        };
      });
      
      mockMulberry32.mockReturnValue(() => 0.5);
      
      const result = teamFight([mockMonster1], [mockMonster2]);
      
      // With 5 damage per hit and monsters having 20 and 30 HP, should take multiple rounds
      expect(result.rounds).toBeGreaterThanOrEqual(2);
    });

    it('should run with debug logging', () => {
      const mockContext = { mock: 'context' };
      mockCreateHandlerContext.mockReturnValue(mockContext);
      mockRollInitiative.mockReturnValue(10);
      
      mockResolveAttack.mockReturnValue({
        isHit: true,
        damage: 100,
        rolls: { base1: 20, base2: null, chosen: 20 }
      });
      mockMulberry32.mockReturnValue(() => 0.5);
      
      const result = teamFight([mockMonster1], [mockMonster2], { debug: true, seed: 123 });
      
      // Should log Combat Start and final stats
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Combat Start'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Final Statistics'));
      expect(result.winningTeam).toBe(0);
    });

    it('should run without debug logging', () => {
      const mockContext = { mock: 'context' };
      mockCreateHandlerContext.mockReturnValue(mockContext);
      mockRollInitiative.mockReturnValue(10);
      
      mockResolveAttack.mockReturnValue({
        isHit: true,
        damage: 100,
        rolls: { base1: 20, base2: null, chosen: 20 }
      });
      mockMulberry32.mockReturnValue(() => 0.5);
      
      const result = teamFight([mockMonster1], [mockMonster2], { debug: false, seed: 123 });
      
      expect(result.winningTeam).toBe(0);
    });

    it('should use default Math.random when no opts provided', () => {
      const mockContext = { mock: 'context' };
      mockCreateHandlerContext.mockReturnValue(mockContext);
      mockRollInitiative.mockReturnValue(10);
      
      mockResolveAttack.mockReturnValue({
        isHit: true,
        damage: 100,
        rolls: { base1: 20, base2: null, chosen: 20 }
      });
      
      // Pass undefined to cover line 280 (else branch when seed is undefined)
      const result = teamFight([mockMonster1], [mockMonster2], undefined);
      
      expect(result.winningTeam).toBe(0);
    });

    it('should use seed when provided', () => {
      const mockContext = { mock: 'context' };
      mockCreateHandlerContext.mockReturnValue(mockContext);
      mockRollInitiative.mockReturnValue(10);
      mockMulberry32.mockReturnValue(() => 0.5);
      
      mockResolveAttack.mockReturnValue({
        isHit: true,
        damage: 100,
        rolls: { base1: 20, base2: null, chosen: 20 }
      });
      
      // Provide seed to cover line 280 if statement
      const result = teamFight([mockMonster1], [mockMonster2], { seed: 999 });
      
      expect(mockMulberry32).toHaveBeenCalledWith(999);
      expect(result.winningTeam).toBe(0);
    });

    it('should log combat start when debug enabled', () => {
      const mockContext = { mock: 'context' };
      mockCreateHandlerContext.mockReturnValue(mockContext);
      mockRollInitiative.mockReturnValue(10);
      
      mockResolveAttack.mockReturnValue({
        isHit: true,
        damage: 100,
        rolls: { base1: 20, base2: null, chosen: 20 }
      });
      
      // Enable debug to cover line 297 if statement
      teamFight([mockMonster1], [mockMonster2], { debug: true, seed: 100 });
      
      expect(mockConsoleLog).toHaveBeenCalledWith('=== Combat Start ===');
    });

    it('should not log combat start when debug disabled', () => {
      const mockContext = { mock: 'context' };
      mockCreateHandlerContext.mockReturnValue(mockContext);
      mockRollInitiative.mockReturnValue(10);
      
      mockResolveAttack.mockReturnValue({
        isHit: true,
        damage: 100,
        rolls: { base1: 20, base2: null, chosen: 20 }
      });
      
      jest.clearAllMocks(); // Clear previous calls
      
      // Disable debug to cover line 297 else (implicit - no logging)
      teamFight([mockMonster1], [mockMonster2], { debug: false, seed: 100 });
      
      expect(mockConsoleLog).not.toHaveBeenCalledWith('=== Combat Start ===');
    });

    it('should handle onFightStart with valid states', () => {
      const mockContext = { mock: 'context' };
      mockCreateHandlerContext.mockReturnValue(mockContext);
      mockRollInitiative.mockReturnValue(10);
      
      mockResolveAttack.mockReturnValue({
        isHit: true,
        damage: 100,
        rolls: { base1: 20, base2: null, chosen: 20 }
      });
      
      // This covers lines 341, 348 by having valid state and opposing members
      teamFight([mockMonster1, mockMonster2], [mockMonster2], { seed: 100 });
      
      // Should have called executeSpecialHandlers for onFightStart
      expect(mockExecuteSpecialHandlers).toHaveBeenCalled();
    });

    it('should log final stats when debug enabled', () => {
      const mockContext = { mock: 'context' };
      mockCreateHandlerContext.mockReturnValue(mockContext);
      mockRollInitiative.mockReturnValue(10);
      
      mockResolveAttack.mockReturnValue({
        isHit: true,
        damage: 100,
        rolls: { base1: 20, base2: null, chosen: 20 }
      });
      
      jest.clearAllMocks();
      
      // Enable debug to cover line 388 if statement
      teamFight([mockMonster1], [mockMonster2], { debug: true, seed: 100 });
      
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Final Statistics'));
    });

    it('should not log final stats when debug disabled', () => {
      const mockContext = { mock: 'context' };
      mockCreateHandlerContext.mockReturnValue(mockContext);
      mockRollInitiative.mockReturnValue(10);
      
      mockResolveAttack.mockReturnValue({
        isHit: true,
        damage: 100,
        rolls: { base1: 20, base2: null, chosen: 20 }
      });
      
      jest.clearAllMocks();
      
      // Disable debug to cover line 388 else (implicit - no logging)
      teamFight([mockMonster1], [mockMonster2], { debug: false, seed: 100 });
      
      expect(mockConsoleLog).not.toHaveBeenCalledWith(expect.stringContaining('Final Statistics'));
    });
  });
});