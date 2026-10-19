import { describe, expect, it } from 'vitest';
import { adoptLateSave, hydrateProgress, progress } from '../src/game/state';
import { SAVE_KEY, SaveStore, defaultSave, type StorageBackend } from '../src/platform/storage';

describe('progress (GDD §8)', () => {
  it('a save that arrives after the boot timeout is merged into the running progress', async () => {
    let answer: (v: string) => void = () => undefined;
    const slow: StorageBackend = {
      get: () =>
        new Promise<string | null>((resolve) => {
          answer = resolve;
        }),
      set: () => Promise.resolve(),
    };
    const store = new SaveStore(slow, SAVE_KEY, 10, 10_000);
    hydrateProgress(await store.load());
    adoptLateSave(store);
    expect(progress.level).toBe(1);
    answer(JSON.stringify({ ...defaultSave(), level: 57, levelsCompleted: 60 }));
    await store.late();
    await Promise.resolve();
    expect(progress.level).toBe(57);
    expect(progress.levelsCompleted).toBe(60);
  });
});
