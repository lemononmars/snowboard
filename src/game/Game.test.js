import { describe, it, expect } from 'vitest';
import GameFactory from './Game.js';

describe('GameDice get_answer logic', () => {
  // Initialize factory with empty mock io
  const { GameDice } = GameFactory({});

  // Instantiate the game class with mock parameters
  const game = new GameDice('gameTitle', { solo: true }, {}, 'roomID');

  it('should return the common die when all three match', () => {
    expect(game.get_answer([1, 1, 1])).toBe(1);
    expect(game.get_answer([0, 0, 0])).toBe(0);
    expect(game.get_answer([2, 2, 2])).toBe(2);
  });

  it('should return the differing third die when the first two match', () => {
    expect(game.get_answer([2, 2, 3])).toBe(3);
    expect(game.get_answer([1, 1, 0])).toBe(0);
  });

  it('should return the differing second die when the first and third match', () => {
    expect(game.get_answer([1, 2, 1])).toBe(2);
    expect(game.get_answer([3, 0, 3])).toBe(0);
  });

  it('should return the differing first die when the second and third match', () => {
    expect(game.get_answer([0, 1, 1])).toBe(0);
    expect(game.get_answer([2, 3, 3])).toBe(2);
  });

  it('should return the missing die summing to 6 when all three distinct', () => {
    // 0, 1, 2, 3 are the possible numbers on the die (sum is 6 for 0+1+2+3)
    // The rule is 6 - f[0] - f[1] - f[2]
    expect(game.get_answer([0, 1, 2])).toBe(3); // 6 - 0 - 1 - 2 = 3
    expect(game.get_answer([0, 2, 3])).toBe(1); // 6 - 0 - 2 - 3 = 1
    expect(game.get_answer([1, 2, 3])).toBe(0); // 6 - 1 - 2 - 3 = 0
    expect(game.get_answer([0, 1, 3])).toBe(2); // 6 - 0 - 1 - 3 = 2
  });
});
