import { describe, it, expect, jest } from '@jest/globals';
import { specialHandlers } from '../specialHandlers.js';

describe('trip.onHit', () => {
  it('should apply Prone status when save fails with default settings', () => {
    const mockDefenderState = {
      getSaveTotal: jest.fn().mockReturnValue(2),
      applyStatus: jest.fn()
    };

    const mockCtx = {
      defenderState: mockDefenderState,
      attacker: { name: 'Ogre' },
      defender: { name: 'Fighter' },
      attackerLabel: 'Ogre',
      defenderLabel: 'Fighter',
      random: jest.fn().mockReturnValue(0.25), // rolls 6
      debug: false
    };

    specialHandlers.trip!.onHit!(mockCtx as any, true);

    // Save: 6 + 2 = 8 vs DC 12, fails
    expect(mockDefenderState.applyStatus).toHaveBeenCalledWith({
      name: 'Prone',
      duration: 1,
      attackPenalty: -4,
      advantageAgainst: true
    });
  });

  it('should apply Prone status with custom rounds when save fails', () => {
    const mockDefenderState = {
      getSaveTotal: jest.fn().mockReturnValue(0),
      applyStatus: jest.fn()
    };

    const mockCtx = {
      defenderState: mockDefenderState,
      attacker: { name: 'Ogre' },
      defender: { name: 'Fighter' },
      attackerLabel: 'Ogre',
      defenderLabel: 'Fighter',
      random: jest.fn().mockReturnValue(0.5), // rolls 11
      debug: false
    };

    specialHandlers.trip!.onHit!(mockCtx as any, { rounds: 2 });

    // Save: 11 + 0 = 11 vs DC 12, fails
    expect(mockDefenderState.applyStatus).toHaveBeenCalledWith({
      name: 'Prone',
      duration: 2,
      attackPenalty: -4,
      advantageAgainst: true
    });
  });

  it('should apply Prone status with custom DC when save fails', () => {
    const mockDefenderState = {
      getSaveTotal: jest.fn().mockReturnValue(5),
      applyStatus: jest.fn()
    };

    const mockCtx = {
      defenderState: mockDefenderState,
      attacker: { name: 'Ogre' },
      defender: { name: 'Fighter' },
      attackerLabel: 'Ogre',
      defenderLabel: 'Fighter',
      random: jest.fn().mockReturnValue(0.1), // rolls 2
      debug: false
    };

    specialHandlers.trip!.onHit!(mockCtx as any, { dc: 10 });

    // Save: 2 + 5 = 7 vs DC 10, fails
    expect(mockDefenderState.applyStatus).toHaveBeenCalledWith({
      name: 'Prone',
      duration: 1,
      attackPenalty: -4,
      advantageAgainst: true
    });
  });

  it('should not apply status when save passes', () => {
    const mockDefenderState = {
      getSaveTotal: jest.fn().mockReturnValue(10),
      applyStatus: jest.fn()
    };

    const mockCtx = {
      defenderState: mockDefenderState,
      attacker: { name: 'Ogre' },
      defender: { name: 'Fighter' },
      attackerLabel: 'Ogre',
      defenderLabel: 'Fighter',
      random: jest.fn().mockReturnValue(0.25), // rolls 6
      debug: false
    };

    specialHandlers.trip!.onHit!(mockCtx as any, {});

    // Save: 6 + 10 = 16 vs DC 12, passes
    expect(mockDefenderState.applyStatus).not.toHaveBeenCalled();
  });

  it('should not apply status if rounds is invalid', () => {
    const mockDefenderState = {
      getSaveTotal: jest.fn().mockReturnValue(0),
      applyStatus: jest.fn()
    };

    const mockCtx = {
      defenderState: mockDefenderState,
      attacker: { name: 'Ogre' },
      defender: { name: 'Fighter' },
      attackerLabel: 'Ogre',
      defenderLabel: 'Fighter',
      random: jest.fn().mockReturnValue(0.5), // rolls 11
      debug: false
    };

    specialHandlers.trip!.onHit!(mockCtx as any, { rounds: 0 });

    // Save fails, but rounds 0 is invalid
    expect(mockDefenderState.applyStatus).not.toHaveBeenCalled();
  });

  it('should log failure when debug is true and save fails', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockDefenderState = {
      getSaveTotal: jest.fn().mockReturnValue(2),
      applyStatus: jest.fn()
    };

    const mockCtx = {
      defenderState: mockDefenderState,
      attacker: { name: 'Ogre' },
      defender: { name: 'Fighter' },
      attackerLabel: 'Ogre',
      defenderLabel: 'Fighter',
      random: jest.fn().mockReturnValue(0.25), // rolls 6
      debug: true
    };

    specialHandlers.trip!.onHit!(mockCtx as any, {});

    expect(consoleSpy).toHaveBeenCalledWith('Ogre trips Fighter - Fighter fort save roll 8 vs DC 12 FAIL');
    expect(consoleSpy).toHaveBeenCalledWith('Fighter gains status: Prone (1 rounds)');
    consoleSpy.mockRestore();
  });

  it('should log pass when debug is true and save passes', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockDefenderState = {
      getSaveTotal: jest.fn().mockReturnValue(10),
      applyStatus: jest.fn()
    };

    const mockCtx = {
      defenderState: mockDefenderState,
      attacker: { name: 'Ogre' },
      defender: { name: 'Fighter' },
      attackerLabel: 'Ogre',
      defenderLabel: 'Fighter',
      random: jest.fn().mockReturnValue(0.25), // rolls 6
      debug: true
    };

    specialHandlers.trip!.onHit!(mockCtx as any, {});

    expect(consoleSpy).toHaveBeenCalledWith('Ogre trips Fighter - Fighter fort save roll 16 vs DC 12 PASS');
    consoleSpy.mockRestore();
  });
});