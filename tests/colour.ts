/** Test helper: CIE L*a*b* (D65) and the CIE76 colour difference, for readability checks. */
export function lab(c: number): [number, number, number] {
  const lin = (u: number): number => (u > 0.04045 ? ((u + 0.055) / 1.055) ** 2.4 : u / 12.92);
  const r = lin(((c >> 16) & 255) / 255);
  const g = lin(((c >> 8) & 255) / 255);
  const b = lin((c & 255) / 255);
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

export function deltaE(a: number, b: number): number {
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}
