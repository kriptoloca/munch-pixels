// ffmpeg plumbing of the audio pipeline (scripts/audio.mjs, tests/audio-encode.test.ts).
import { spawnSync } from 'node:child_process';
import { rmSync, statSync } from 'node:fs';

const MAX_BUFFER = 64 * 1024 * 1024;

/**
 * Encodes one source file (any format ffmpeg reads) to mono 44.1 kHz with `codecArgs`, without
 * metadata; returns the output size in bytes. ffmpeg reads the source by its path, never through
 * a pipe: an MP4/M4A with its index (moov) at the end needs a seekable input, and through a pipe
 * it came out as a silent stub while ffmpeg reported success (Epic 4 audit). `-xerror` turns any
 * decode error (a cut or corrupt source) into a failure; a failed output is removed. Throws when
 * ffmpeg is missing or fails.
 */
export function encodeAudio(srcPath, outPath, codecArgs) {
  const base = ['-hide_banner', '-loglevel', 'error', '-xerror', '-y', '-i', srcPath];
  const tail = ['-map_metadata', '-1', '-fflags', '+bitexact', '-flags', '+bitexact', outPath];
  const r = spawnSync(
    'ffmpeg',
    [...base, '-vn', '-ac', '1', '-ar', '44100', ...codecArgs, ...tail],
    {
      maxBuffer: MAX_BUFFER,
    },
  );
  if (r.error) {
    throw new Error(
      'ffmpeg not found: install ffmpeg (with libvorbis and aac) to run npm run audio',
    );
  }
  if (r.status !== 0) {
    rmSync(outPath, { force: true });
    throw new Error(`ffmpeg failed for ${outPath}: ${r.stderr.toString()}`);
  }
  return statSync(outPath).size;
}

/** Duration of an audio file in seconds by ffprobe; null when it has none it can read. */
export function probeDuration(path) {
  const r = spawnSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
    { maxBuffer: MAX_BUFFER },
  );
  if (r.error) throw new Error('ffprobe not found: install ffmpeg to check the audio');
  const s = Number.parseFloat(r.stdout.toString().trim());
  return r.status === 0 && Number.isFinite(s) ? s : null;
}

/** An encode may differ from its source by a codec frame of padding at most, never by more. */
const DURATION_SLACK_S = 0.03;
const DURATION_SLACK_SHARE = 0.01;

/**
 * True when an output's duration matches its source's (both in seconds, null when unreadable):
 * an empty, cut or padded encode does not.
 */
export function durationMatches(source, output) {
  if (source === null || output === null) return false;
  return Math.abs(output - source) <= Math.max(DURATION_SLACK_S, DURATION_SLACK_SHARE * source);
}
