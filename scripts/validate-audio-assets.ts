import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { AUDIO_ASSET_MANIFEST } from '../src/services/audioAssets';
import type { AudioAssetCategory } from '../src/services/audioAssets';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

const ffmpegPath: string | undefined = process.env.FFMPEG_PATH || require('ffmpeg-static');
const ffprobePath: string | undefined = process.env.FFPROBE_PATH || require('ffprobe-static')?.path;

if (!ffmpegPath || !ffprobePath) {
  console.error('Missing ffmpeg/ffprobe. Install dev deps or set FFMPEG_PATH/FFPROBE_PATH.');
  process.exit(1);
}

const ROOT_DIR = process.cwd();
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

const AUDIO_EXTENSIONS = new Set(['.wav', '.mp3', '.ogg', '.m4a']);

const CATEGORY_SPECS: Record<AudioAssetCategory, {
  targetLufs: number;
  lufsTolerance: number;
  truePeakMaxDb: number;
  loopWindowSec: number;
  loopRmsThreshold: number;
}> = {
  cue: {
    targetLufs: -18,
    lufsTolerance: 6,
    truePeakMaxDb: -1.0,
    loopWindowSec: 0.08,
    loopRmsThreshold: 0.02
  },
  ambience: {
    targetLufs: -18,
    lufsTolerance: 3,
    truePeakMaxDb: -1.0,
    loopWindowSec: 0.12,
    loopRmsThreshold: 0.02
  },
  soundscape: {
    targetLufs: -18,
    lufsTolerance: 3,
    truePeakMaxDb: -1.0,
    loopWindowSec: 0.12,
    loopRmsThreshold: 0.02
  }
};

type ProbeResult = {
  durationSec: number;
  sampleRate: number;
  channels: number;
};

function toPublicPath(file: string): string {
  const rel = file.startsWith('/') ? file.slice(1) : file;
  return path.join(PUBLIC_DIR, rel);
}

function toManifestPath(rel: string): string {
  const normalized = rel.split(path.sep).join('/');
  return `/${normalized}`;
}

async function walkAudioFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkAudioFiles(fullPath));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (AUDIO_EXTENSIONS.has(ext)) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

async function probeAudio(filePath: string): Promise<ProbeResult> {
  const { stdout } = await execFileAsync(ffprobePath, [
    '-v', 'error',
    '-select_streams', 'a:0',
    '-show_entries', 'stream=sample_rate,channels',
    '-show_entries', 'format=duration',
    '-of', 'json',
    filePath
  ], { encoding: 'utf8' });

  const data = JSON.parse(stdout);
  const stream = Array.isArray(data.streams) ? data.streams[0] : {};
  const duration = Number.parseFloat(data.format?.duration ?? '0');
  const sampleRate = Number.parseInt(stream?.sample_rate ?? '48000', 10);
  const channels = Number.parseInt(stream?.channels ?? '2', 10);

  return {
    durationSec: Number.isFinite(duration) ? duration : 0,
    sampleRate: Number.isFinite(sampleRate) ? sampleRate : 48000,
    channels: Number.isFinite(channels) ? channels : 2
  };
}

async function measureLoudness(filePath: string): Promise<{ integrated: number; truePeak: number }> {
  const { stderr } = await execFileAsync(ffmpegPath, [
    '-hide_banner',
    '-nostats',
    '-i', filePath,
    '-filter_complex', 'ebur128=peak=true',
    '-f', 'null',
    '-'
  ], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 5 });

  const integratedMatches = [...stderr.matchAll(/I:\s*(-?\d+(\.\d+)?)\s*LUFS/g)];
  const truePeakMatches = [...stderr.matchAll(/TP:\s*(-?\d+(\.\d+)?)\s*dBTP/g)];
  if (!integratedMatches.length || !truePeakMatches.length) {
    throw new Error('Unable to parse loudness metrics');
  }

  const integrated = Number.parseFloat(integratedMatches[integratedMatches.length - 1][1]);
  const truePeak = Number.parseFloat(truePeakMatches[truePeakMatches.length - 1][1]);
  return { integrated, truePeak };
}

async function readPcmSegment(filePath: string, startSec: number, durationSec: number, sampleRate: number): Promise<Int16Array> {
  const { stdout } = await execFileAsync(ffmpegPath, [
    '-hide_banner',
    '-loglevel', 'error',
    '-ss', startSec.toFixed(3),
    '-t', durationSec.toFixed(3),
    '-i', filePath,
    '-ac', '1',
    '-ar', String(sampleRate),
    '-f', 's16le',
    'pipe:1'
  ], { encoding: 'buffer', maxBuffer: 1024 * 1024 });

  const buffer = stdout as Buffer;
  return new Int16Array(buffer.buffer, buffer.byteOffset, Math.floor(buffer.byteLength / 2));
}

function rmsDiff(a: Int16Array, b: Int16Array): number {
  const len = Math.min(a.length, b.length);
  if (!len) return 0;
  let sum = 0;
  for (let i = 0; i < len; i++) {
    const diff = (a[i] - b[i]) / 32768;
    sum += diff * diff;
  }
  return Math.sqrt(sum / len);
}

async function validateLoop(filePath: string, durationSec: number, sampleRate: number, windowSec: number, rmsThreshold: number): Promise<string | null> {
  if (durationSec <= windowSec * 2) {
    return 'Audio too short for loop analysis';
  }
  const head = await readPcmSegment(filePath, 0, windowSec, sampleRate);
  const tailStart = Math.max(0, durationSec - windowSec);
  const tail = await readPcmSegment(filePath, tailStart, windowSec, sampleRate);
  const diff = rmsDiff(head, tail);
  if (diff > rmsThreshold) {
    return `Loop seam RMS ${diff.toFixed(4)} exceeds ${rmsThreshold}`;
  }
  return null;
}

async function run(): Promise<void> {
  let errors = 0;
  let warnings = 0;

  const manifestFiles = new Set(AUDIO_ASSET_MANIFEST.map((entry) => entry.file));
  const diskFiles = (await walkAudioFiles(path.join(PUBLIC_DIR, 'audio')))
    .map((fullPath) => toManifestPath(path.relative(PUBLIC_DIR, fullPath)));
  const diskFileSet = new Set(diskFiles);

  const missing = [...manifestFiles].filter((file) => !diskFileSet.has(file));
  const extra = [...diskFileSet].filter((file) => !manifestFiles.has(file));

  if (missing.length) {
    errors += missing.length;
    console.error('Missing audio files:');
    missing.forEach((file) => console.error(`  - ${file}`));
  }

  if (extra.length) {
    errors += extra.length;
    console.error('Unexpected audio files (not in manifest):');
    extra.forEach((file) => console.error(`  - ${file}`));
  }

  for (const entry of AUDIO_ASSET_MANIFEST) {
    const spec = CATEGORY_SPECS[entry.category];
    const filePath = toPublicPath(entry.file);

    try {
      await fs.access(filePath);
    } catch {
      continue;
    }

    try {
      const probe = await probeAudio(filePath);
      const metrics = await measureLoudness(filePath);

      if (Math.abs(metrics.integrated - spec.targetLufs) > spec.lufsTolerance) {
        errors += 1;
        console.error(`${entry.file}: integrated loudness ${metrics.integrated.toFixed(2)} LUFS outside target ${spec.targetLufs} ± ${spec.lufsTolerance}`);
      }

      if (metrics.truePeak > spec.truePeakMaxDb) {
        errors += 1;
        console.error(`${entry.file}: true peak ${metrics.truePeak.toFixed(2)} dBTP exceeds ${spec.truePeakMaxDb} dBTP`);
      }

      if (entry.loop) {
        if (entry.expectedDurationSec && Math.abs(probe.durationSec - entry.expectedDurationSec) > 0.25) {
          warnings += 1;
          console.warn(`${entry.file}: duration ${probe.durationSec.toFixed(2)}s differs from expected ${entry.expectedDurationSec}s`);
        }

        const loopIssue = await validateLoop(filePath, probe.durationSec, probe.sampleRate, spec.loopWindowSec, spec.loopRmsThreshold);
        if (loopIssue) {
          errors += 1;
          console.error(`${entry.file}: ${loopIssue}`);
        }
      }
    } catch (err) {
      errors += 1;
      console.error(`${entry.file}: validation failed (${(err as Error).message})`);
    }
  }

  const total = AUDIO_ASSET_MANIFEST.length;
  console.log(`Checked ${total} manifest entries with ${warnings} warnings.`);

  if (errors > 0) {
    console.error(`Audio validation failed with ${errors} error(s).`);
    process.exit(1);
  }

  console.log('Audio validation passed.');
}

run().catch((err) => {
  console.error(`Validator crashed: ${(err as Error).message}`);
  process.exit(1);
});
