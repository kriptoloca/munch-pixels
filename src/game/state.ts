import { defaultSave, mergeSaves, type SaveData, type SaveStore } from '../platform/storage';

/**
 * The player's progress in memory and its persistence (GDD §8). Scenes read and change
 * `progress`, then call `persistProgress()`; saving is fire-and-forget and never throws.
 */
export const progress: SaveData = defaultSave();

let store: SaveStore | null = null;

export function attachSaveStore(s: SaveStore | null): void {
  store = s;
}

export function hydrateProgress(data: SaveData): void {
  Object.assign(progress, data, { facesFound: [...data.facesFound] });
}

/**
 * A first read that missed the boot timeout lands later: its progress is merged into the running
 * one (the furthest level wins), so a slow host store never sends the player back to level 1.
 */
export function adoptLateSave(s: SaveStore): void {
  void s.late().then((stored) => {
    if (stored) hydrateProgress(mergeSaves(stored, progress));
  });
}

export function persistProgress(): void {
  if (!store) return;
  void store.save({ ...progress, facesFound: [...progress.facesFound] });
}

/** Dev `?reset=1` and the dev menu: back to a fresh save. */
export function resetProgress(): void {
  hydrateProgress(defaultSave());
  persistProgress();
}
