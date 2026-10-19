/**
 * True inside the YouTube Playables host. In practice the frame domain decides (the SDK uses
 * the same `usercontent.goog` test); the `ytgame` global is injected by the host and may not
 * exist yet when this runs before the SDK's own handshake, so it is only a secondary signal.
 */
export function hostedByYoutube(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof (window as { ytgame?: unknown }).ytgame !== 'undefined') return true;
  return /\.usercontent\.goog$/.test(window.location.hostname);
}
