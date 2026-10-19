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

export class SaveStore {
  constructor(
    private readonly backend: StorageBackend,
    private readonly key: string = SAVE_KEY,
  ) {}

  /** Never rejects: any failure yields a fresh default save. */
  async load(): Promise<SaveData> {
    try {
      const raw = await this.backend.get(this.key);
      if (!raw) return defaultSave();
      return migrate(JSON.parse(raw) as unknown);
    } catch {
      return defaultSave();
    }
  }

  /** Never rejects: returns false when the backend failed. */
  async save(data: SaveData): Promise<boolean> {
    try {
      await this.backend.set(this.key, JSON.stringify(data));
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
}
