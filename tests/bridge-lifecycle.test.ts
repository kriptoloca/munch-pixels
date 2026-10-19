import { describe, expect, it } from 'vitest';
import { markInteractive, type Platform, type PlatformMessageName } from '../src/platform/bridge';

/**
 * CLAUDE.md rule 3: the loading phase closes once, then GameReady (the platform guards repeats).
 */
describe('markInteractive', () => {
  it('closes the loading phase once per page and asks for GameReady each time', () => {
    const sent: PlatformMessageName[] = [];
    const platform = {
      sendMessage: (name: PlatformMessageName) => {
        sent.push(name);
      },
    } as unknown as Platform;
    markInteractive(platform);
    expect(sent).toEqual(['in_game_loading_stopped', 'game_ready']);
    markInteractive(platform);
    expect(sent).toEqual(['in_game_loading_stopped', 'game_ready', 'game_ready']);
  });
});
