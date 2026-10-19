import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * public/playgama-bridge-config.json drives SDK behaviour the platform rules depend on
 * (docs/bridge-notes.md). A stray key could switch on SDK UI with outbound links (cross-promo
 * modal), the loading logo or analytics calls, so the shape is pinned here.
 */
const config = JSON.parse(
  readFileSync(new URL('../public/playgama-bridge-config.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;

describe('Bridge config', () => {
  it('targets YouTube with the interstitial delay guard and no error popup', () => {
    expect(Object.keys(config.platforms as object)).toContain('youtube');
    const ads = config.advertisement as Record<string, unknown>;
    expect(ads.minimumDelayBetweenInterstitial).toBe(120);
    expect(ads.useAdvertisementErrorPopup).toBe(false);
  });

  it('keeps the SDK logo and analytics off and never enables SDK promo UI', () => {
    expect(config.disableLoadingLogo).toBe(true);
    expect(config.sendAnalyticsEvents).toBe(false);
    expect(JSON.stringify(config)).not.toMatch(/crossPromo|banner|leaderboard|payments/i);
  });
});
