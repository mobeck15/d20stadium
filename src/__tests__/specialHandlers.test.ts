import { describe, it, expect, jest } from '@jest/globals';
import { performSave, applyStatusByName, specialHandlers} from '../specialHandlers.js';

describe('performSave', () => {
  it('should return a passing save when roll meets DC', () => {
    // Mock dependencies
    const mockDefenderState = {
      getSaveTotal: jest.fn().mockReturnValue(5) // +5 modifier
    };
    
    const mockCtx = {
      defenderState: mockDefenderState,
      random: jest.fn().mockReturnValue(0.75) // Will roll a 16 (floor(0.75 * 20) + 1 = 16)
    };

    const result = performSave(mockCtx as any, 'fort', 18);

    // Roll: 16 + 5 = 21, DC is 18
    expect(result.roll).toBe(21);
    expect(result.pass).toBe(true);
    expect(mockDefenderState.getSaveTotal).toHaveBeenCalledWith('fort');
  });

  it('should return a failing save when roll is below DC', () => {
  const mockDefenderState = {
    getSaveTotal: jest.fn().mockReturnValue(2)
  };
  
  const mockCtx = {
    defenderState: mockDefenderState,
    random: jest.fn().mockReturnValue(0.5) // rolls 11
  };

  const result = performSave(mockCtx as any, 'will', 20);

  expect(result.roll).toBe(13); // 11 + 2
  expect(result.pass).toBe(false);
});
});

describe('applyStatusByName', () => {
  it('should apply status to attacker with basic parameters', () => {
    const mockAttackerState = {
      applyStatus: jest.fn()
    };
    
    const mockCtx = {
      attackerState: mockAttackerState,
      defenderState: {},
      attackerLabel: 'Goblin',
      defenderLabel: 'Hero'
    };

    const result = applyStatusByName(mockCtx as any, 'attacker', 'poisoned', 3);

    expect(mockAttackerState.applyStatus).toHaveBeenCalledWith({
      name: 'poisoned',
      duration: 3
    });
    expect(result).toBe('Goblin gains status: poisoned (3 rounds)');
  });

  it('should apply status to defender with basic parameters', () => {
    const mockDefenderState = {
      applyStatus: jest.fn()
    };
    
    const mockCtx = {
      attackerState: {},
      defenderState: mockDefenderState,
      attackerLabel: 'Dragon',
      defenderLabel: 'Knight'
    };

    const result = applyStatusByName(mockCtx as any, 'defender', 'stunned', 1);

    expect(mockDefenderState.applyStatus).toHaveBeenCalledWith({
      name: 'stunned',
      duration: 1
    });
    expect(result).toBe('Knight gains status: stunned (1 rounds)');
  });

  it('should apply status with extra properties', () => {
    const mockDefenderState = {
      applyStatus: jest.fn()
    };
    
    const mockCtx = {
      attackerState: {},
      defenderState: mockDefenderState,
      attackerLabel: 'Wizard',
      defenderLabel: 'Orc'
    };

    const extra = {
      damagePerRound: 5,
      saveDC: 15
    };

    const result = applyStatusByName(mockCtx as any, 'defender', 'burning', 4, extra);

    expect(mockDefenderState.applyStatus).toHaveBeenCalledWith({
      name: 'burning',
      duration: 4,
      damagePerRound: 5,
      saveDC: 15
    });
    expect(result).toBe('Orc gains status: burning (4 rounds)');
  });

  it('should handle zero duration', () => {
    const mockAttackerState = {
      applyStatus: jest.fn()
    };
    
    const mockCtx = {
      attackerState: mockAttackerState,
      defenderState: {},
      attackerLabel: 'Rogue',
      defenderLabel: 'Guard'
    };

    const result = applyStatusByName(mockCtx as any, 'attacker', 'marked', 0);

    expect(mockAttackerState.applyStatus).toHaveBeenCalledWith({
      name: 'marked',
      duration: 0
    });
    expect(result).toBe('Rogue gains status: marked (0 rounds)');
  });

  it('should merge extra properties correctly without overwriting name or duration', () => {
    const mockDefenderState = {
      applyStatus: jest.fn()
    };
    
    const mockCtx = {
      attackerState: {},
      defenderState: mockDefenderState,
      attackerLabel: 'Cleric',
      defenderLabel: 'Undead'
    };

    const extra = {
      type: 'holy',
      stackable: false
    };

    applyStatusByName(mockCtx as any, 'defender', 'blessed', 2, extra);

    expect(mockDefenderState.applyStatus).toHaveBeenCalledWith({
      name: 'blessed',
      duration: 2,
      type: 'holy',
      stackable: false
    });
  });
});