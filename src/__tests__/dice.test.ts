import { describe, it, expect, jest } from '@jest/globals';
import { rollDice } from '../dice.js';

describe('rollDice', () => {
  it('should throw error for invalid dice expression', () => {
    expect(() => rollDice('invalid')).toThrow('Invalid dice expression: invalid');
  });

  it('should throw error for expression without "d"', () => {
    expect(() => rollDice('5+3')).toThrow('Invalid dice expression: 5+3');
  });

  it('should throw error for empty string', () => {
    expect(() => rollDice('')).toThrow('Invalid dice expression: ');
  });

  it('should successfully roll valid dice expression', () => {
    const mockRandom = jest.fn().mockReturnValue(0.99) as unknown as () => number;
    const result = rollDice('2d6+3', mockRandom);
    
    // 0.99 * 6 = 5.94, floor + 1 = 6
    // Two dice: 6 + 6 + 3 = 15
    expect(result).toBe(15);
  });

  it('should handle dice expression without bonus', () => {
    const mockRandom = jest.fn().mockReturnValue(0.5) as unknown as () => number;
    const result = rollDice('1d20', mockRandom);
    
    // 0.5 * 20 = 10, floor + 1 = 11
    expect(result).toBe(11);
  });
});