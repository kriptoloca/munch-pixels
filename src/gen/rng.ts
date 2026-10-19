/** Deterministic randomness for the content pipeline (CLAUDE.md: same seed → same level). */

/**
 * cyrb53 (bryc, public domain) folded to 32 bits. Integer-only (Math.imul), so identical on
 * every JS engine.
 */
export function hashSeed(str: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}

/**
 * mulberry32. Every piece of gameplay randomness goes through an instance created from a seed.
 * No Math.random, no Date, and no transcendental functions (sin/cos/log) anywhere in the
 * generator: those may differ in the last bit between engines, which would break "every device
 * gets the same level list".
 */
export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  /** Uniform in [0, 1). */
  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [a, b], inclusive. */
  int(a: number, b: number): number {
    if (b < a) throw new Error(`Rng.int: empty range ${String(a)}..${String(b)}`);
    return a + Math.floor(this.next() * (b - a + 1));
  }

  /** Float in [a, b). */
  float(a: number, b: number): number {
    return a + this.next() * (b - a);
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('Rng.pick: empty array');
    return arr[this.int(0, arr.length - 1)] as T;
  }

  /** Fisher–Yates, in place; returns the same array. */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      const tmp = arr[i] as T;
      arr[i] = arr[j] as T;
      arr[j] = tmp;
    }
    return arr;
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Approximate normal via Irwin–Hall (sum of 12 uniforms). Engine-independent. */
  gauss(mean = 0, sd = 1): number {
    let s = 0;
    for (let i = 0; i < 12; i++) s += this.next();
    return mean + (s - 6) * sd;
  }

  /** Weighted index pick. Weights must be ≥ 0 and not all zero. */
  weighted(weights: readonly number[]): number {
    let total = 0;
    for (const w of weights) total += w;
    if (total <= 0) throw new Error('Rng.weighted: weights sum to zero');
    let r = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i] as number;
      if (r < 0) return i;
    }
    return weights.length - 1;
  }
}
