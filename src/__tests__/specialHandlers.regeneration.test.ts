import { describe, it, expect, jest } from '@jest/globals';
import { specialHandlers } from '../specialHandlers.js';

describe('regeneration.onTurnEnd', () => {
  it('should regenerate HP using param when provided', () => {
    const mockAttackerState = {
      hp: 5,
      maxHp: 20,
      monster: {}
    };

    const mockCtx = {
      attackerState: mockAttackerState,
      attackerLabel: 'Troll',
      debug: false
    };

    specialHandlers.regeneration!.onTurnEnd!(mockCtx as any, 5);

    expect(mockAttackerState.hp).toBe(10);
  });

  it('should regenerate HP from monster.special.regeneration when param is not provided', () => {
    const mockAttackerState = {
      hp: 10,
      maxHp: 20,
      monster: { special: { regeneration: 3 } }
    };

    const mockCtx = {
      attackerState: mockAttackerState,
      attackerLabel: 'Troll',
      debug: false
    };

    specialHandlers.regeneration!.onTurnEnd!(mockCtx as any);

    expect(mockAttackerState.hp).toBe(13);
  });

  it('should cap regeneration at maxHp', () => {
    const mockAttackerState = {
      hp: 18,
      maxHp: 20,
      monster: {}
    };

    const mockCtx = {
      attackerState: mockAttackerState,
      attackerLabel: 'Troll',
      debug: false
    };

    specialHandlers.regeneration!.onTurnEnd!(mockCtx as any, 5);

    expect(mockAttackerState.hp).toBe(20);
  });

  it('should not regenerate if HP is 0 or less', () => {
    const mockAttackerState = {
      hp: 0,
      maxHp: 20,
      monster: {}
    };

    const mockCtx = {
      attackerState: mockAttackerState,
      attackerLabel: 'Troll',
      debug: false
    };

    specialHandlers.regeneration!.onTurnEnd!(mockCtx as any, 5);

    expect(mockAttackerState.hp).toBe(0);
  });

  it('should not regenerate if regen value is invalid', () => {
    const mockAttackerState = {
      hp: 10,
      maxHp: 20,
      monster: {}
    };

    const mockCtx = {
      attackerState: mockAttackerState,
      attackerLabel: 'Troll',
      debug: false
    };

    specialHandlers.regeneration!.onTurnEnd!(mockCtx as any, 'invalid');

    expect(mockAttackerState.hp).toBe(10);
  });

  it('should log regeneration when debug is true', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockAttackerState = {
      hp: 5,
      maxHp: 20,
      monster: {}
    };

    const mockCtx = {
      attackerState: mockAttackerState,
      attackerLabel: 'Troll',
      debug: true
    };

    specialHandlers.regeneration!.onTurnEnd!(mockCtx as any, 3);

    expect(consoleSpy).toHaveBeenCalledWith('Troll regenerates 3 -> HP=8');
    consoleSpy.mockRestore();
  });

  it('should not log when debug is false', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockAttackerState = {
      hp: 5,
      maxHp: 20,
      monster: {}
    };

    const mockCtx = {
      attackerState: mockAttackerState,
      attackerLabel: 'Troll',
      debug: false
    };

    specialHandlers.regeneration!.onTurnEnd!(mockCtx as any, 3);

    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});