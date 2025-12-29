import { describe, it, expect, jest } from '@jest/globals';
import { specialHandlers } from '../specialHandlers.js';

describe('paralysis.onHit', () => {
  it('should apply Paralyzed status for rolled duration when save fails', () => {
    const mockDefenderState = {
      getSaveTotal: jest.fn().mockReturnValue(2),
      applyStatus: jest.fn()
    };
    
    const mockCtx = {
      defenderState: mockDefenderState,
      attackerLabel: 'Ghoul',
      defenderLabel: 'Fighter',
      random: jest.fn()
        .mockReturnValueOnce(0.25)  // First call: performSave rolls 6
        .mockReturnValueOnce(0.99), // Second call: rollDice "1d4+1" rolls 4 -> result 5
      debug: true
    };

    const config = {  }; // uses default DC 15
    specialHandlers.paralysis!.onHit!(mockCtx as any, config);

    // Save: 6 + 2 = 8 vs DC 15, fails
    // Duration: 4 (from d4) + 1 = 5 rounds
    expect(mockDefenderState.applyStatus).toHaveBeenCalledWith({
      name: 'Paralyzed',
      duration: 5,
      loseTurn: true
    });
  });

  test.each([
    { debug: true },
    { debug: false }
  ])('should not apply Paralyzed status when save passes (debug: $debug)', ({ debug }) => {
    const mockDefenderState = {
      getSaveTotal: jest.fn().mockReturnValue(20),
      applyStatus: jest.fn()
    };

    const mockCtx = {
      defenderState: mockDefenderState,
      attackerLabel: 'Ghoul',
      defenderLabel: 'Fighter',
      random: jest.fn().mockReturnValueOnce(0.25), // performSave rolls 6
      debug
    };

    const config = { dc: 15 };
    specialHandlers.paralysis!.onHit!(mockCtx as any, config);

    // Save: 6 + 20 = 26 vs DC 15, passes
    expect(mockDefenderState.applyStatus).not.toHaveBeenCalled();
  });
});