import { withTimeout } from './timeout';

/**
 * Save model and storage (GDD §8, CLAUDE.md rule 7). The backend is an interface: the Playgama
 * Bridge storage API in production, localStorage or memory in dev and tests. Nothing in here ever
 * throws into gameplay.
 */

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'munch-pixels:save';
/** The album of found faces keeps at most this many level ids (the level list has 100). */
export const FACES_MAX = 1000;

export interface SaveData {
  version: number;
  /** The level to play next, 1-based. */
  level: number;
  sound: boolean;
  music: boolean;
  /** Levels won, all time (repeats count). */
  levelsCompleted: number;
  /** Ids of the levels whose hidden face the player has revealed (GDD §5; album in v2). */
  facesFound: number[];
}

export interface StorageBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export class MemoryBackend implements StorageBackend {
  private readonly map = new Map<string, string>();
  get(key: string): Promise<string | null> {
    return Promise.resolve(this.map.get(key) ?? null);
  }
  set(key: string, value: string): Promise<void> {
    this.map.set(key, value);
    return Promise.resolve();
  }
}

/** Browser localStorage; private mode or quota errors degrade to "nothing stored". */
export class LocalStorageBackend implements StorageBackend {
  get(key: string): Promise<string | null> {
    try {
      return Promise.resolve(window.localStorage.getItem(key));
    } catch {
      return Promise.resolve(null);
    }
  }
  set(key: string, value: string): Promise<void> {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // ignore: saving is best effort
    }
    return Promise.resolve();
  }
}

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    level: 1,
    sound: true,
    music: true,
    levelsCompleted: 0,
    facesFound: [],
  };
}

function num(v: unknown, fallback: number, min = 0): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= min ? Math.floor(v) : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function faces(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  const ids = v.filter((x): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 1);
  return [...new Set(ids)].sort((a, b) => a - b).slice(0, FACES_MAX);
}

/** Coerces whatever was stored into a valid SaveData; unknown or newer versions start fresh. */
export function migrate(raw: unknown): SaveData {
  if (typeof raw !== 'object' || raw === null) return defaultSave();
  const r = raw as Record<string, unknown>;
  const d = defaultSave();
  if (num(r.version, 0) !== SAVE_VERSION) return d;
  return {
    version: SAVE_VERSION,
    level: num(r.level, d.level, 1),
    sound: bool(r.sound, d.sound),
    music: bool(r.music, d.music),
    levelsCompleted: num(r.levelsCompleted, d.levelsCompleted),
    facesFound: faces(r.facesFound),
  };
}

/** A host storage read that has not answered by then no longer holds Boot (and GameReady). */
export const LOAD_TIMEOUT_MS = 4000;
/**
 * A read that missed LOAD_TIMEOUT_MS is still awaited this long before the first save may write
 * without it (a storage that never answers would otherwise block every save of the session).
 */
export const LATE_READ_MAX_MS = 30_000;

/**
 * A save read late meets the progress made meanwhile: the furthest progress wins, the found
 * faces are merged, and the settings come from the stored save (a toggle made during a slow
 * first read is the only thing lost).
 */
export function mergeSaves(stored: SaveData, local: SaveData): SaveData {
  return {
    version: SAVE_VERSION,
    level: Math.max(stored.level, local.level),
    sound: stored.sound,
    music: stored.music,
    levelsCompleted: Math.max(stored.levelsCompleted, local.levelsCompleted),
    facesFound: faces([...stored.facesFound, ...local.facesFound]),
  };
}

export class SaveStore {
  /** A first read that outlived LOAD_TIMEOUT_MS (null when the load answered in time). */
  private lateRead: Promise<SaveData | null> | null = null;
  /** The late read has finished; saves started from then on carry the merged progress. */
  private lateSettled = false;

  constructor(
    private readonly backend: StorageBackend,
    private readonly key: string = SAVE_KEY,
    private readonly timeoutMs: number = LOAD_TIMEOUT_MS,
    private readonly lateMaxMs: number = LATE_READ_MAX_MS,
  ) {}

  /**
   * Never rejects and never hangs: a failure, an empty store or a timeout yields a fresh default
   * save. After a timeout the read goes on; `late()` delivers it and `save()` merges with it.
   */
  async load(): Promise<SaveData> {
    const read = this.read();
    try {
      return (await withTimeout(read, this.timeoutMs)) ?? defaultSave();
    } catch {
      this.lateRead = withTimeout(read, this.lateMaxMs).catch(() => null);
      // Attached first, so it runs before any save waiting on the same read continues.
      void this.lateRead.then(() => {
        this.lateSettled = true;
      });
      return defaultSave();
    }
  }

  /** The stored save once a timed-out first read has finished; null when there is none. */
  late(): Promise<SaveData | null> {
    return this.lateRead ?? Promise.resolve(null);
  }

  /**
   * Never rejects: returns false when the backend failed. A save started while a late first read
   * is still on its way waits for it and writes the merge (`mergeSaves`), so a slow store never
   * loses the player's real progress to the fresh save Boot started with.
   */
  async save(data: SaveData): Promise<boolean> {
    let out = data;
    if (this.lateRead && !this.lateSettled) {
      const stored = await this.lateRead;
      if (stored) out = mergeSaves(stored, data);
    }
    try {
      await this.backend.set(this.key, JSON.stringify(out));
      return true;
    } catch {
      return false;
    }
  }

  async clear(): Promise<void> {
    try {
      await this.backend.set(this.key, '');
    } catch {
      // ignore
    }
  }

  /** The stored save, or null when the store is empty, unreadable or holds garbage. */
  private async read(): Promise<SaveData | null> {
    try {
      const raw = await this.backend.get(this.key);
      if (!raw) return null;
      return migrate(JSON.parse(raw) as unknown);
    } catch {
      return null;
    }
  }
}
