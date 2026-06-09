/**
 * Generates WAV audio assets for F-GUARD promo video.
 * Uses raw PCM — no external dependencies required.
 */

const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "../public");
fs.mkdirSync(OUT_DIR, { recursive: true });

const SAMPLE_RATE = 44100;

/**
 * Build a 16-bit PCM WAV buffer.
 * @param {Float32Array} samples  values in [-1, 1]
 */
function buildWav(samples) {
  const numSamples = samples.length;
  const dataSize = numSamples * 2; // 16-bit = 2 bytes per sample
  const buf = Buffer.alloc(44 + dataSize);

  // RIFF header
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);

  // fmt chunk
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);        // chunk size
  buf.writeUInt16LE(1, 20);         // PCM = 1
  buf.writeUInt16LE(1, 22);         // mono
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32);         // block align
  buf.writeUInt16LE(16, 34);        // bits per sample

  // data chunk
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  return buf;
}

/** Sine wave at given frequency, with optional envelope */
function sine(freq, durationSec, { attack = 0.005, decay = 0, sustain = 1, release = 0.02, volume = 0.6 } = {}) {
  const n = Math.ceil(durationSec * SAMPLE_RATE);
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const total = durationSec;
    // Envelope
    let env = 1;
    if (t < attack) env = t / attack;
    else if (t > total - release) env = (total - t) / release;
    samples[i] = Math.sin(2 * Math.PI * freq * t) * env * volume;
  }
  return samples;
}

/** Frequency sweep (whoosh) */
function sweep(freqStart, freqEnd, durationSec, volume = 0.4) {
  const n = Math.ceil(durationSec * SAMPLE_RATE);
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const ratio = t / durationSec;
    const freq = freqStart + (freqEnd - freqStart) * ratio;
    const env = ratio < 0.1 ? ratio / 0.1 : ratio > 0.8 ? (1 - ratio) / 0.2 : 1;
    samples[i] = Math.sin(2 * Math.PI * freq * t) * env * volume;
  }
  return samples;
}

/** Two sine waves mixed (chord) */
function chord(freqs, durationSec, options = {}) {
  const parts = freqs.map(f => sine(f, durationSec, { ...options, volume: (options.volume || 0.5) / freqs.length }));
  const n = parts[0].length;
  const out = new Float32Array(n);
  for (const p of parts) for (let i = 0; i < n; i++) out[i] += p[i];
  return out;
}

/** Mix multiple sample arrays (must be same length, zero-padded) */
function mix(...arrays) {
  const n = Math.max(...arrays.map(a => a.length));
  const out = new Float32Array(n);
  for (const a of arrays) for (let i = 0; i < a.length; i++) out[i] += a[i];
  return out;
}

/** Ambient atmospheric pad — layered low harmonics + subtle noise */
function ambientPad(durationSec, volume = 0.09) {
  const n = Math.ceil(durationSec * SAMPLE_RATE);
  const out = new Float32Array(n);
  const freqs = [55, 82.5, 110, 165, 220]; // A1 chord harmonics
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    // Fade in first 2s, fade out last 2s
    const fadeIn  = Math.min(1, t / 2);
    const fadeOut = Math.min(1, (durationSec - t) / 2);
    const env = fadeIn * fadeOut;
    let s = 0;
    for (let fi = 0; fi < freqs.length; fi++) {
      const f = freqs[fi];
      const amp = 1 / (fi + 1); // fundamental louder than harmonics
      // Slight LFO modulation per harmonic for movement
      const lfo = 1 + 0.015 * Math.sin(2 * Math.PI * (0.12 + fi * 0.07) * t);
      s += Math.sin(2 * Math.PI * f * lfo * t) * amp;
    }
    // Normalise harmonics sum then apply volume + envelope
    out[i] = (s / freqs.length) * env * volume;
  }
  return out;
}

// ── Asset definitions ──────────────────────────────────────────────────────

const assets = {
  // Short UI click for node appearances / KPI counters
  "click.wav": buildWav(sine(1400, 0.035, { attack: 0.001, release: 0.008, volume: 0.45 })),

  // Softer sub-click for JSON typing
  "type.wav": buildWav(sine(1800, 0.018, { attack: 0.001, release: 0.005, volume: 0.3 })),

  // Transition whoosh — downward sweep for impact
  "transition.wav": buildWav(
    mix(
      sweep(800, 80, 0.4, 0.38),   // main whoosh
      sweep(1200, 200, 0.3, 0.15)  // high sparkle layer
    )
  ),

  // Success chime — bright major triad arpeggio feel
  "success.wav": buildWav(
    mix(
      sine(523, 0.35, { attack: 0.008, release: 0.12, volume: 0.28 }), // C5
      sine(659, 0.35, { attack: 0.025, release: 0.12, volume: 0.24 }), // E5
      sine(784, 0.42, { attack: 0.045, release: 0.15, volume: 0.2  }), // G5
      sine(1047,0.28, { attack: 0.07,  release: 0.1,  volume: 0.14 })  // C6
    )
  ),

  // Scan/reveal — rising sweep + punch
  "reveal.wav": buildWav(
    mix(
      sweep(60, 520, 0.45, 0.28),
      sine(520, 0.12, { attack: 0.01, release: 0.06, volume: 0.22 })
    )
  ),

  // KPI counter tick — crisp metallic
  "tick.wav": buildWav(
    mix(
      sine(1000, 0.02, { attack: 0.001, release: 0.004, volume: 0.3 }),
      sine(2000, 0.015, { attack: 0.001, release: 0.003, volume: 0.12 })
    )
  ),

  // CTA accent chord — warm major 7th
  "accent.wav": buildWav(
    mix(
      sine(220, 0.7, { attack: 0.04, release: 0.25, volume: 0.22 }), // A3
      sine(277, 0.7, { attack: 0.06, release: 0.25, volume: 0.18 }), // C#4
      sine(330, 0.7, { attack: 0.08, release: 0.25, volume: 0.18 }), // E4
      sine(415, 0.8, { attack: 0.1,  release: 0.3,  volume: 0.15 }), // Ab4
      sine(523, 0.8, { attack: 0.12, release: 0.3,  volume: 0.13 })  // C5
    )
  ),

  // 30s atmospheric ambient drone played throughout entire video
  "ambient.wav": buildWav(ambientPad(30.5, 0.09)),
};

for (const [name, buf] of Object.entries(assets)) {
  const outPath = path.join(OUT_DIR, name);
  fs.writeFileSync(outPath, buf);
  console.log(`✓ ${name}  (${buf.length} bytes)`);
}

console.log("\nAll audio assets generated.");
