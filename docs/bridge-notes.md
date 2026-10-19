# Playgama Bridge integration notes

Copied from Peek & Find (2026-10-19), where every name was verified against the SDK source; Munch Pixels uses the same SDK version and the same wrapper. Differences: rewarded placements `slot` and `undo` (the lose panel's "continue" is the `slot` placement); the in-game menu lifecycle and the level messages arrive in Epic 5. Sections below that cite Peek & Find dates or decisions describe the SDK behaviour found there; the Munch Pixels epic that uses each one is named in brackets.

Source of truth read on 2026-10-16: the SDK repository `github.com/Playgama/bridge` at version **2.3.1** (npm `@playgama/bridge@2.3.1`). `wiki.playgama.com` was not reachable from the cloud session; every name below was taken from the source files quoted in brackets.

## How the SDK is loaded
- npm package `@playgama/bridge`, pinned `2.3.1`. The runtime is `dist/playgama-bridge.js` (≈ 300 KB UMD, all platform adapters inlined, sets `window.bridge`). The ESM entry is only a typed proxy to `window.bridge` plus constants.
- Vite plugin `@playgama/bridge/vite` with `{ mode: 'local' }` [vite/index.cjs]: injects `<script src="./playgama-bridge.js">` into `index.html` (head-prepend), serves the file in dev and emits it into `dist/` on build. No CDN tag is produced in local mode, so CLAUDE.md rule 1 holds.
- Config file `playgama-bridge-config.json` next to `index.html` (we keep it in `public/`). The SDK fetches it with a same-origin relative `fetch('./playgama-bridge-config.json')` [lib/bridge-config/BridgeConfig.ts]. Our config: `platforms.youtube: {}`, `advertisement.minimumDelayBetweenInterstitial: 120`, `advertisement.useAdvertisementErrorPopup: false` (otherwise the SDK shows its own "ad failed" popup; we only read the `failed` state).
- `bridge.initialize()` [PlaygamaBridge.ts]: loads config → detects platform → creates the platform bridge → initialises modules → resolves. Platform detection: YouTube when `location.hostname` includes `usercontent.goog` [platformDetectors.ts]; anything unknown falls back to `PLATFORM_ID.MOCK`, which uses `PlatformBridgeBase` (ads unsupported, storage → localStorage) [platformImports.ts].
- `?debug=true` (constant `DEBUG_QUERY_PARAM`) enables SDK logging [lib/logger/constants.ts].

## Constants and events used
`import bridge, { EVENT_NAME, PLATFORM_MESSAGE, INTERSTITIAL_STATE, REWARDED_STATE } from '@playgama/bridge'`
- `EVENT_NAME.PAUSE_STATE_CHANGED` → `(isPaused: boolean)`; `EVENT_NAME.AUDIO_STATE_CHANGED` → `(isEnabled: boolean)`; `EVENT_NAME.VISIBILITY_STATE_CHANGED` → `'visible' | 'hidden'`; `EVENT_NAME.INTERSTITIAL_STATE_CHANGED` → `'loading' | 'opened' | 'closed' | 'failed'`; `EVENT_NAME.REWARDED_STATE_CHANGED` → `'loading' | 'opened' | 'rewarded' | 'closed' | 'failed'` [constants/eventName.ts, modules/advertisement/constants.ts].
- Subscription: `bridge.on(eventName, cb)` / `bridge.off(eventName, cb)` (the root is an EventEmitter; module events are forwarded to the global bus) [PlaygamaBridge.ts, modules/ModuleBase.ts].
- The pause state aggregates platform pause, hidden visibility and open ads: while an interstitial or rewarded ad is open the SDK reports paused [platform-bridges/PlatformBridgeBase.ts `_pauseStateAggregator`].
- The same base feeds the aggregator's "visibility" input from window `blur` (→ hidden) and `focus` (→ visible) wherever `isPlatformPageVisibilityApiAllowed` is true (the base default; the YouTube bridge returns false). In an iframe host an ad in the parent page blurs the game and focus only returns with the next tap inside it: `src/platform/bridge.ts` `regainFocus()` and `RESUME_TAP_GRACE_MS`, docs/questions.md 2026-10-18 (host focus) [dist/playgama-bridge.js 2.3.1, `_setVisibilityState`].

## Platform module
- `bridge.platform.id`, `.language`, `.isAudioEnabled`, `.isPaused` [modules/platform/PlatformModule.ts].
- `bridge.platform.sendMessage(PLATFORM_MESSAGE.X)` with `GAME_READY`, `IN_GAME_LOADING_STARTED/STOPPED`, `GAMEPLAY_STARTED/STOPPED`, `LEVEL_STARTED/COMPLETED/FAILED` [modules/platform/constants.ts]. On YouTube `GAME_READY` calls `ytgame.game.gameReady()`; `firstFrameReady()` is called by the SDK itself at the end of its own initialisation [platform-bridges/YoutubePlatformBridge.ts].
- `bridge.setGameLoadingProgress(percent)` drives the SDK loading screen.

## Advertisement module
- `bridge.advertisement.isInterstitialSupported`, `.isRewardedSupported` (both `true` on YouTube, `false` on the mock platform).
- `bridge.advertisement.setMinimumDelayBetweenInterstitial(seconds)` (default 60). The config file carries `minimumDelayBetweenInterstitial: 120`, and when the config has a value the SDK ignores the runtime call (`if (null !== config) return` in the advertisement module), so the config is the effective setting; the call stays as a no-op guard. The SDK counts its 120 s from the moment the previous interstitial closed, our `AdGate` from the moment the previous one was requested and also requires 3 completed levels, so the SDK can only make ads rarer, never more frequent.
- `bridge.advertisement.showInterstitial()`; `showRewarded(placement?)`; results arrive through the state events above. YouTube maps them to `ytgame.ads.requestInterstitialAd()` and `ytgame.ads.requestRewardedAd(placement)`; a resolved rewarded promise with `true` yields `REWARDED` then `CLOSED`, a rejection yields `FAILED`.
- Placements we use: `slot` (one more waiting slot) and `undo` (undo the last tap), GDD §7.

## Storage module
- `bridge.storage.get(key, tryParseJson)` and `bridge.storage.set(key, value)` [modules/storage/StorageModule.ts]. We pass `tryParseJson = false` and store the save as a JSON string under one key, which the YouTube adapter folds into `ytgame.game.saveData` / `loadData` [YoutubePlatformBridge.ts]. On the mock platform the module writes localStorage itself. Calls before `initialize()` throw `SDK_NOT_INITIALIZED`, so BootScene initialises the bridge first.

## Our wrapper (`src/platform/bridge.ts`)
- Lifecycle around the in-game menu (GDD §9, Epic 5): `gameplay_stopped` when the pause menu opens on a playing level, `gameplay_started` on Resume; the platform pause keeps its own path (`onPause`), and a platform resume over the open menu leaves the game frozen.
- `markInteractive(platform)`: sends `in_game_loading_stopped` once per page and then `game_ready` (itself guarded to once), called by the Title (and by the Game scene when a dev URL starts there), so GameReady only goes out when the player can act (CLAUDE.md rule 3).
- `initPlatform()` resolves to a `Platform` object: `platformId`, `interstitialSupported`, `rewardedSupported`, `showInterstitial()`, `showRewarded(placement)`, `sendMessage(name)`, `storage` (a `StorageBackend`), `isAudioEnabled()`, `onPause(cb)`, `onAudio(cb)`. If `window.bridge` is missing or `initialize()` fails or exceeds 6 s, it resolves to a stub with the same shape (ads unsupported, localStorage) — the game is always playable.
- Dev builds: `?fakeads=1` makes the stub simulate ads (1.5 s overlay, rewarded always earned) so the booster and interstitial flows can be tested without a platform.

## Still to verify on the real platform (Epic 6)
- `disableLoadingLogo`: off, as in Peek & Find; the game draws its own boot screen (GDD §9). Revisit only if Playgama requires the logo.
- Behaviour of `useAdvertisementErrorPopup: false` on YouTube when an ad fails.
- The Playgama QA tool platform (`PLATFORM_ID.QA_TOOL`) is selected by the tool itself; our build needs no special handling.

## Analytics (added 2026-10-17)

`modules/analytics/AnalyticsModule.ts` posts events to `https://api.playgama.com` (fetch + sendBeacon on
unload) unless one of these holds: the page is on `localhost` / `127.0.0.1` / `file://`, the platform
adapter reports `isPlatformExternalCallsSupported === false`, or the config says
`"sendAnalyticsEvents": false` (ignored on Playgama's own portal, where it is always on).
`YoutubePlatformBridge.isPlatformExternalCallsSupported` returns `false`, so on YouTube the SDK makes
no external calls by itself. Our config sets `sendAnalyticsEvents: false` anyway so the GitHub Pages
test site (mock platform) behaves like YouTube (Peek & Find's live e2e run caught the difference;
`tests/bridge-config.test.ts` pins the setting here).
