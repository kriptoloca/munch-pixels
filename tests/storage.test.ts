import { describe, expect, it } from 'vitest';
import {
  FACES_MAX,
  MemoryBackend,
  SAVE_KEY,
  SAVE_VERSION,
  SaveStore,
  defaultSave,
  migrate,
  type StorageBackend,
} from '../src/platform/storage';

describe('save model', () => {
  it('a fresh save starts at level 1 with sound and music on', () => {
    expect(defaultSave()).toEqual({
      version: SAVE_VERSION,
      level: 1,
      sound: true,
      music: true,
      levelsCompleted: 0,
      facesFound: [],
    });
  });

  it('migrate coerces broken fields and keeps good ones', () => {
    const s = migrate({
      version: SAVE_VERSION,
      level: 7.8,
      sound: false,
      music: 'yes',
      levelsCompleted: -3,
      facesFound: [3, 1, 3, 'x', 0, 2.5, 9],
    });
    expect(s).toEqual({
      version: SAVE_VERSION,
      level: 7,
      sound: false,
      music: true,
      levelsCompleted: 0,
      facesFound: [1, 3, 9],
    });
  });

  it('an unknown version, garbage or a level below 1 never breaks the game', () => {
    expect(migrate(null)).toEqual(defaultSave());
    expect(migrate('x')).toEqual(defaultSave());
    expect(migrate({ version: 99, level: 50 })).toEqual(defaultSave());
    expect(migrate({ version: SAVE_VERSION, level: 0 }).level).toBe(1);
  });

  it('caps the face list', () => {
    const many = Array.from({ length: FACES_MAX + 50 }, (_, i) => i + 1);
    expect(migrate({ version: SAVE_VERSION, facesFound: many }).facesFound).toHaveLength(FACES_MAX);
  });
});

describe('SaveStore', () => {
  it('round-trips through the backend under the game key', async () => {
    const backend = new MemoryBackend();
    const store = new SaveStore(backend);
    const s = { ...defaultSave(), level: 12, facesFound: [1, 2] };
    expect(await store.save(s)).toBe(true);
    expect(await backend.get(SAVE_KEY)).toContain('"level":12');
    expect(await store.load()).toEqual(s);
  });

  it('never rejects: a failing or corrupt backend yields a fresh save', async () => {
    const broken: StorageBackend = {
      get: () => Promise.reject(new Error('down')),
      set: () => Promise.reject(new Error('down')),
    };
    const store = new SaveStore(broken);
    expect(await store.load()).toEqual(defaultSave());
    expect(await store.save(defaultSave())).toBe(false);
    const corrupt = new MemoryBackend();
    await corrupt.set(SAVE_KEY, '{not json');
    expect(await new SaveStore(corrupt).load()).toEqual(defaultSave());
  });
});
