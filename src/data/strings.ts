/**
 * UI strings (≤ 10, CLAUDE.md rule 8): gameplay is text-free; these appear only where the
 * platform shows text anyway (the boot fallback when the wordmark is missing).
 */
export interface Strings {
  title: string;
}

const EN: Strings = { title: 'Munch Pixels' };

export function t(): Strings {
  return EN;
}
