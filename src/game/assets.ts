import Phaser from 'phaser';

/**
 * Runs one loader pass and resolves when every queued file finished (ported from Peek & Find's
 * assets.ts). A failed file is logged and the game goes on without it: the callers check the
 * cache afterwards (audio plays nothing for a missing key).
 */
export function runLoader(
  scene: Phaser.Scene,
  enqueue: (loader: Phaser.Loader.LoaderPlugin) => void,
): Promise<void> {
  return new Promise((resolve) => {
    const loader = scene.load;
    const onError = (file: Phaser.Loader.File): void => {
      // `url` is a string for every file type the game loads (JSON, audio).
      const url = typeof file.url === 'string' ? file.url : '?';
      console.error(`asset load failed: ${file.key} (${url})`);
    };
    loader.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
    loader.once(Phaser.Loader.Events.COMPLETE, () => {
      loader.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
      resolve();
    });
    enqueue(loader);
    loader.start();
  });
}
