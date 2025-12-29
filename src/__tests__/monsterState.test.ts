import { describe, it, expect, beforeEach } from '@jest/globals';
import { MonsterState } from '../monsterState.js';
import type { Monster } from '../monster.js';
import type { StatusEffect } from '../specialHandlers.js';

describe('MonsterState', () => {
  let mockMonster: Monster;
  let monsterState: MonsterState;

  beforeEach(() => {
    mockMonster = {
      name: 'Test Monster',
      hp: 100,
      saves: {
        fort: 5,
        ref: 3,
        will: 2
      }
    } as Monster;
    monsterState = new MonsterState(mockMonster);
  });

  describe('constructor', () => {
    it('should initialize with monster HP and empty state', () => {
      expect(monsterState.hp).toBe(100);
      expect(monsterState.maxHp).toBe(100);
      expect(monsterState.statuses).toEqual([]);
      expect(monsterState.damageDealt).toBe(0);
      expect(monsterState.statusTotals.size).toBe(0);
    });
  });

  describe('applyStatus', () => {
    it('should add new status effect', () => {
      monsterState.applyStatus({ name: 'Poisoned', duration: 3 });
      expect(monsterState.statuses).toHaveLength(1);
      expect(monsterState.statuses[0].name).toBe('Poisoned');
      expect(monsterState.statuses[0].duration).toBe(3);
    });

    it('should handle null or undefined effect', () => {
      monsterState.applyStatus(null as any);
      monsterState.applyStatus(undefined as any);
      monsterState.applyStatus({ duration: 3 } as any);
      expect(monsterState.statuses).toHaveLength(0);
    });

    it('should update duration to max when same status applied', () => {
      monsterState.applyStatus({ name: 'Burning', duration: 2 });
      monsterState.applyStatus({ name: 'Burning', duration: 5 });
      expect(monsterState.statuses).toHaveLength(1);
      expect(monsterState.statuses[0].duration).toBe(5);
    });

    it('should not reapply once-only status while active', () => {
      monsterState.applyStatus({ name: 'OneTime', duration: 3, once: true });
      monsterState.applyStatus({ name: 'OneTime', duration: 5, once: true });
      expect(monsterState.statuses[0].duration).toBe(3);
    });

    it('should allow reapplying once-only status when expired', () => {
      monsterState.applyStatus({ name: 'OneTime', duration: 0, once: true });
      monsterState.applyStatus({ name: 'OneTime', duration: 5, once: true });
      expect(monsterState.statuses[0].duration).toBe(5);
    });
  });

  describe('hasStatus', () => {
    it('should return true when status is active', () => {
      monsterState.applyStatus({ name: 'Poisoned', duration: 3 });
      expect(monsterState.hasStatus('Poisoned')).toBe(true);
    });

    it('should return false when status is not present or expired', () => {
      expect(monsterState.hasStatus('Poisoned')).toBe(false);
      monsterState.applyStatus({ name: 'Expired', duration: 0 });
      expect(monsterState.hasStatus('Expired')).toBe(false);
    });
  });

  describe('getAttackPenalty', () => {
    it('should sum attack penalties from statuses', () => {
      monsterState.applyStatus({ name: 'Weakened', duration: 3, attackPenalty: -2 });
      monsterState.applyStatus({ name: 'Blinded', duration: 2, attackPenalty: -4 });
      expect(monsterState.getAttackPenalty()).toBe(-6);
    });

    it('should return 0 when no statuses have attackPenalty', () => {
      monsterState.applyStatus({ name: 'Poisoned', duration: 3 });
      expect(monsterState.getAttackPenalty()).toBe(0);
    });
  });

  describe('getSaveTotal', () => {
    it('should return base save when no penalties', () => {
      expect(monsterState.getSaveTotal('fort')).toBe(5);
      expect(monsterState.getSaveTotal('ref')).toBe(3);
      expect(monsterState.getSaveTotal('will')).toBe(2);
    });

    it('should apply save penalties', () => {
      monsterState.applyStatus({ name: 'Weakened', duration: 3, savePenalty: -2 });
      expect(monsterState.getSaveTotal('fort')).toBe(3);
    });

    it('should handle missing savePenalty field', () => {
      monsterState.applyStatus({ name: 'NoSavePenalty', duration: 3 });
      expect(monsterState.getSaveTotal('fort')).toBe(5);
    });

    it('should handle missing saves gracefully', () => {
      const noSavesMonster = { name: 'No Saves', hp: 50 } as Monster;
      const state = new MonsterState(noSavesMonster);
      expect(state.getSaveTotal('fort')).toBe(0);
    });
  });

  describe('tickStatuses', () => {
    it('should decrement durations and remove expired statuses', () => {
      monsterState.applyStatus({ name: 'Poisoned', duration: 2 });
      monsterState.applyStatus({ name: 'Stunned', duration: 1 });
      monsterState.statuses.push(null as any);
      monsterState.tickStatuses();
      expect(monsterState.statuses).toHaveLength(2);
      expect(monsterState.statuses[0].name).toBe('Poisoned');
      expect(monsterState.statuses[0].duration).toBe(1);
      expect(monsterState.statuses[1]).toBe(null);
    });

    it('should track status totals for active statuses', () => {
      monsterState.applyStatus({ name: 'Burning', duration: 3 });
      monsterState.tickStatuses();
      expect(monsterState.statusTotals.get('Burning')).toBe(1);
      monsterState.tickStatuses();
      expect(monsterState.statusTotals.get('Burning')).toBe(2);
    });

    it('should not count inactive statuses in totals', () => {
      monsterState.applyStatus({ name: 'Expired', duration: 0 });
      monsterState.tickStatuses();
      expect(monsterState.statusTotals.get('Expired')).toBeUndefined();
    });
  });

  describe('toDebug', () => {
    it('should return "none" when no statuses', () => {
      expect(monsterState.toDebug()).toBe('none');
    });

    it('should format statuses correctly', () => {
      monsterState.applyStatus({ name: 'Poisoned', duration: 3 });
      monsterState.applyStatus({ name: 'Stunned', duration: 2 });
      expect(monsterState.toDebug()).toBe('Poisoned(3), Stunned(2)');
    });
  });
});