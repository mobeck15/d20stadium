import { describe, it, expect, jest } from '@jest/globals';
import { specialHandlers } from '../specialHandlers.js';

describe('stench.onFightStart', () => {
  it('should apply Sickened status when save fails', () => {
    const mockDefenderState = {
      getSaveTotal: jest.fn().mockReturnValue(2),
      applyStatus: jest.fn()
    };

    const mockCtx = {
      defenderState: mockDefenderState,
      attackerLabel: 'Ghast',
      defenderLabel: 'Fighter',
      random: jest.fn()
        .mockReturnValueOnce(0.25)  // performSave rolls 6
        .mockReturnValueOnce(0.99), // rollDice "1d6+4" rolls 6 -> 10
      debug: true
    };

    const config = {}; // uses default DC 15
    specialHandlers.stench!.onFightStart!(mockCtx as any, config);

    // Save: 6 + 2 = 8 vs DC 15, fails
    // Duration: 6 + 4 = 10, *10 = 100 rounds
    expect(mockDefenderState.applyStatus).toHaveBeenCalledWith({
      name: 'Sickened',
      duration: 100,
      attackPenalty: -2,
      savePenalty: -2,
      once: true
    });
  });

  it('should apply StenchImmune status when save passes', () => {
    const mockDefenderState = {
      getSaveTotal: jest.fn().mockReturnValue(20),
      applyStatus: jest.fn()
    };

    const mockCtx = {
      defenderState: mockDefenderState,
      attackerLabel: 'Ghast',
      defenderLabel: 'Fighter',
      random: jest.fn().mockReturnValueOnce(0.25), // performSave rolls 6
      debug: true
    };

    const config = { dc: 15 };
    specialHandlers.stench!.onFightStart!(mockCtx as any, config);

    // Save: 6 + 20 = 26 vs DC 15, passes
    expect(mockDefenderState.applyStatus).toHaveBeenCalledWith({
      name: 'StenchImmune',
      duration: 14400
    });
  });

  it('should use custom DC when provided', () => {
    const mockDefenderState = {
      getSaveTotal: jest.fn().mockReturnValue(5),
      applyStatus: jest.fn()
    };

    const mockCtx = {
      defenderState: mockDefenderState,
      attackerLabel: 'Ghast',
      defenderLabel: 'Fighter',
      random: jest.fn().mockReturnValueOnce(0.5), // rolls 11
      debug: false
    };

    const config = { dc: 10 };
    specialHandlers.stench!.onFightStart!(mockCtx as any, config);

    // Save: 11 + 5 = 16 vs DC 10, passes
    expect(mockDefenderState.applyStatus).toHaveBeenCalledWith({
      name: 'StenchImmune',
      duration: 14400
    });
  });
});