import * as Tone from 'tone';

let cueSynth: Tone.PolySynth | null = null;
let reverb: Tone.Reverb | null = null;
let initialized = false;

export type CueType = 'inhale' | 'exhale' | 'hold' | 'finish';

/**
 * Make sure Tone has a running AudioContext.
 * NOTE: must be called from a user gesture to fully unlock on iOS.
 */
export async function unlockAudio(): Promise<boolean> {
  try {
    await Tone.start();
    if (Tone.context.state !== 'running') {
      await Tone.context.resume();
    }
    return Tone.context.state === 'running';
  } catch (e) {
    console.warn("Audio unlock failed", e);
    return false;
  }
}

export async function initAudio(): Promise<void> {
  if (initialized) return;

  reverb = new Tone.Reverb({ decay: 1.5, wet: 0.25 }).toDestination();
  await reverb.generate();

  cueSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.02, decay: 0.1, sustain: 0.08, release: 0.8 },
  }).connect(reverb);

  cueSynth.volume.value = -12;
  initialized = true;
}

export function cleanupAudio(): void {
  cueSynth?.dispose();
  reverb?.dispose();
  cueSynth = null;
  reverb = null;
  initialized = false;
}

export async function playCue(type: CueType, enabled: boolean): Promise<void> {
  if (!enabled) return;
  await initAudio();
  if (!cueSynth) return;

  const now = Tone.now();
  switch (type) {
    case 'inhale':
      // Uplifting major third
      cueSynth.triggerAttackRelease(['C4', 'E4'], '8n', now);
      break;
    case 'exhale':
      // Grounding perfect fourth down
      cueSynth.triggerAttackRelease(['G3', 'C3'], '4n', now);
      break;
    case 'hold':
      // Subtle high tick
      cueSynth.triggerAttackRelease(['C5'], '32n', now, 0.1);
      break;
    case 'finish':
      // C Major chord
      cueSynth.triggerAttackRelease(['C4', 'G4', 'C5'], '1n', now);
      break;
  }
}