import { describe, expect, it } from 'vitest';
import { LEVELS, levelFor } from '../src/data/levels';

describe('levelFor (GDD §8)', () => {
  it('gives level n of the list; past the end the last level repeats (v0.1)', () => {
    expect(levelFor(1).id).toBe(1);
    expect(levelFor(57).id).toBe(57);
    expect(levelFor(LEVELS.length + 5).id).toBe(LEVELS.length);
    expect(levelFor(0).id).toBe(1);
    expect(levelFor(Number.NaN).id).toBe(1);
  });
});
