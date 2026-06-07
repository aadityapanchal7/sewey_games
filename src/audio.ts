// 6. Audio - Howler-backed, synthesized in-code (no asset files). Nothing touches
// AudioContext until unlock() is called from the Ready Gate click. safe() no-ops
// when not unlocked or muted.

import { Howl, Howler } from 'howler';

type Wave = 'sine' | 'square' | 'triangle' | 'sawtooth';

let _unlocked = false;
let _muted = false;

// ---- WAV synthesis (tone envelopes → base64 WAV → Howl) -------------------
const SR = 44100;

function encodeWav(samples: Float32Array): string {
  const len = samples.length;
  const buffer = new ArrayBuffer(44 + len * 2);
  const view = new DataView(buffer);
  const wr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  wr(0, 'RIFF');
  view.setUint32(4, 36 + len * 2, true);
  wr(8, 'WAVE');
  wr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SR, true);
  view.setUint32(28, SR * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  wr(36, 'data');
  view.setUint32(40, len * 2, true);
  let off = 44;
  for (let i = 0; i < len; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  let bin = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return 'data:audio/wav;base64,' + btoa(bin);
}

interface ToneOpts {
  wave?: Wave;
  freq: number;
  slideTo?: number;
  dur: number; // seconds
  decay?: number; // 0..1 exponential decay strength
  gain?: number;
  noise?: number; // 0..1 mix of filtered noise
}

function tone(o: ToneOpts): string {
  const n = Math.floor(o.dur * SR);
  const out = new Float32Array(n);
  const wave = o.wave ?? 'square';
  const gain = o.gain ?? 0.5;
  const decay = o.decay ?? 4;
  let last = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const prog = i / n;
    const freq = o.slideTo ? o.freq + (o.slideTo - o.freq) * prog : o.freq;
    const ph = 2 * Math.PI * freq * t;
    let s: number;
    switch (wave) {
      case 'sine':
        s = Math.sin(ph);
        break;
      case 'triangle':
        s = Math.asin(Math.sin(ph)) * (2 / Math.PI);
        break;
      case 'sawtooth':
        s = 2 * (freq * t - Math.floor(freq * t + 0.5));
        break;
      default:
        s = Math.sin(ph) >= 0 ? 1 : -1;
    }
    if (o.noise) {
      // simple low-passed noise
      const white = Math.random() * 2 - 1;
      last = last + 0.2 * (white - last);
      s = s * (1 - o.noise) + last * o.noise;
    }
    const env = Math.exp(-decay * prog);
    out[i] = s * env * gain;
  }
  return encodeWav(out);
}

function howl(src: string, loop = false, volume = 0.6): Howl {
  return new Howl({ src: [src], loop, volume, html5: false });
}

// flat-envelope low-passed noise - seamless loop bed (crowd rumble).
function noiseLoop(dur: number, gain: number, lp = 0.12): string {
  const n = Math.floor(dur * SR);
  const out = new Float32Array(n);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const white = Math.random() * 2 - 1;
    last = last + lp * (white - last);
    // slow amplitude wobble = crowd swell/ebb
    const wob = 0.75 + 0.25 * Math.sin((i / n) * Math.PI * 4);
    out[i] = last * gain * wob;
  }
  return encodeWav(out);
}

// ---- Banks -----------------------------------------------------------------
let clicks: Howl[] = [];
let hoverH: Howl | null = null;
let repBank: Record<string, Howl[]> = {};
let bgBank: Record<string, Howl> = {};
let currentBg: Howl | null = null;
let crowdH: Howl | null = null; // looping crowd bed (volume tracks streak)
let correctH: Howl | null = null;
let wrongH: Howl | null = null;

function buildBanks() {
  clicks = [
    howl(tone({ wave: 'square', freq: 420, slideTo: 620, dur: 0.08, gain: 0.4 })),
    howl(tone({ wave: 'square', freq: 380, slideTo: 560, dur: 0.08, gain: 0.4 })),
  ];
  hoverH = howl(tone({ wave: 'sine', freq: 700, dur: 0.05, gain: 0.25 }));

  // per-mode rep hit sounds
  repBank = {
    // SIUUU - two real shout clips; Audio.rep('siuu') ALTERNATES between them
    // (see _repIdx / alternateModes) so each rep flips to the other voice.
    siuu: [
      howl('/sfx/siuu-speed.mp3', false, 0.9),
      howl('/sfx/siuu-classic.mp3', false, 0.9),
    ],
    suii: [
      howl(tone({ wave: 'sawtooth', freq: 300, slideTo: 900, dur: 0.18, gain: 0.45 })),
      howl(tone({ wave: 'sawtooth', freq: 340, slideTo: 1000, dur: 0.18, gain: 0.45 })),
    ],
    // SAMBA DRUM - deep tom boom + click attack
    drum: [
      howl(tone({ wave: 'sine', freq: 110, slideTo: 70, dur: 0.26, decay: 7, gain: 0.8 })),
      howl(tone({ wave: 'sine', freq: 130, slideTo: 80, dur: 0.24, decay: 7, gain: 0.8 })),
    ],
    // MBAPPÉ - short triumphant rising chord
    mbappe: [
      howl(tone({ wave: 'sawtooth', freq: 330, slideTo: 523, dur: 0.3, decay: 3, gain: 0.4 })),
    ],
    // GUESS - used as the "GOAL!" hit
    guess: [howl(tone({ wave: 'square', freq: 523, slideTo: 784, dur: 0.22, gain: 0.4 }))],
  };

  correctH = howl(tone({ wave: 'sine', freq: 660, slideTo: 990, dur: 0.2, decay: 3, gain: 0.45 }));
  wrongH = howl(tone({ wave: 'square', freq: 200, slideTo: 110, dur: 0.28, decay: 4, gain: 0.35 }));

  // looping chiptune beds (simple - replace with richer loops later)
  bgBank = {
    chrome: howl(
      tone({ wave: 'triangle', freq: 220, dur: 2.0, decay: 0.2, gain: 0.12 }),
      true,
      0.5
    ),
    siuu: howl(
      tone({ wave: 'square', freq: 160, dur: 2.0, decay: 0.15, gain: 0.08 }),
      true,
      0.4
    ),
  };

  // crowd rumble bed - starts silent, volume driven by streak during play.
  crowdH = howl(noiseLoop(2.0, 0.5), true, 0);
}

function safe(fn: () => void) {
  if (!_unlocked || _muted) return;
  try {
    fn();
  } catch {
    /* no-op */
  }
}

const rand = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

// Modes whose rep sounds cycle in ORDER (alternate) instead of playing randomly.
const alternateModes = new Set(['siuu']);
const _repIdx: Record<string, number> = {}; // next index per alternating mode

// ---- Public API ------------------------------------------------------------
export const Audio = {
  unlock() {
    if (_unlocked) return;
    buildBanks(); // constructs Howler's AudioContext inside the gesture
    const ctx = Howler.ctx;
    if (ctx && ctx.state === 'suspended') ctx.resume();
    _unlocked = true;
  },
  isUnlocked: () => _unlocked,
  click: () => safe(() => rand(clicks).play()),
  hover: () => safe(() => hoverH?.play()),
  rep: (mode: string) =>
    safe(() => {
      const bank = repBank[mode] ?? repBank.suii;
      if (!bank || !bank.length) return;
      if (alternateModes.has(mode)) {
        // cycle through this mode's clips in order, flipping each rep
        const i = _repIdx[mode] ?? 0;
        const clip = bank[i % bank.length];
        clip.stop(); // restart cleanly if a rapid rep retriggers the same clip
        clip.play();
        _repIdx[mode] = (i + 1) % bank.length;
      } else {
        rand(bank).play();
      }
    }),
  // reset alternating-rep cursors so each new round starts on the first clip
  resetReps() {
    for (const k of Object.keys(_repIdx)) _repIdx[k] = 0;
  },
  startBg(key: string) {
    safe(() => {
      const next = bgBank[key];
      if (!next || next === currentBg) return;
      currentBg?.stop();
      currentBg = next;
      next.play();
    });
  },
  stopBg() {
    currentBg?.stop();
    currentBg = null;
  },
  setMuted(v: boolean) {
    _muted = v;
    Howler.mute(v);
    if (v) {
      currentBg?.stop();
    }
  },
  isMuted: () => _muted,
  preview: (mode: string) =>
    safe(() => (repBank[mode] ?? repBank.siuu)?.[0]?.play()),
  correct: () => safe(() => correctH?.play()),
  wrong: () => safe(() => wrongH?.play()),

  // ---- crowd bed (builds with streak) ----
  startCrowd() {
    safe(() => {
      if (!crowdH) return;
      crowdH.volume(0.08);
      if (!crowdH.playing()) crowdH.play();
    });
  },
  setCrowdIntensity(x: number) {
    // x in 0..1 → fade crowd volume toward target over 400ms
    safe(() => {
      if (!crowdH) return;
      const target = 0.08 + Math.max(0, Math.min(1, x)) * 0.42;
      crowdH.fade(crowdH.volume(), target, 400);
    });
  },
  stopCrowd() {
    crowdH?.stop();
  },
};
