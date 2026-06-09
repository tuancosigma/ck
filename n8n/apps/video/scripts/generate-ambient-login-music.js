/**
 * Generates a cyberpunk ambient background loop for the F-GUARD login page.
 * 75 BPM · Am7 tonality · 25.6s seamless loop
 * Layers: sub-bass drone · analog pad chord · ethereal high pad ·
 *         lofi kick/hihat · glitch bursts · sparse melody · reverb simulation
 */

const fs   = require("fs");
const path = require("path");

const SR        = 44100;          // sample rate
const BPM       = 75;
const BEAT_S    = 60 / BPM;       // 0.8 s/beat
const BEAT_N    = Math.round(SR * BEAT_S);
const TOTAL_B   = 32;             // 8 bars × 4 beats = 32 beats
const N         = TOTAL_B * BEAT_N; // ~1,128,960 samples ≈ 25.6 s

const out = new Float32Array(N);

/* ─── helpers ─────────────────────────────────────────────────────────────── */

function rng(seed) {          // seeded PRNG (xorshift32)
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}
const rand = rng(0xdeadbeef);

function env(i, dur, att, rel) {
  if (i < att)       return i / att;
  if (i > dur - rel) return Math.max(0, (dur - i) / rel);
  return 1;
}

/** Add a sine wave (with optional detuning companion for chorus effect) */
function addPad(freq, startI, dur, amp, attI, relI, detune = 0.18, lfoHz = 0.07, lfoDepth = 0.18, phase = 0) {
  for (let i = 0; i < dur && startI + i < N; i++) {
    const t   = i / SR;
    const lfo = 1 - lfoDepth + lfoDepth * Math.sin(2 * Math.PI * lfoHz * t + phase);
    const e   = env(i, dur, attI, relI);
    const s   = Math.sin(2 * Math.PI * freq * t)
              + Math.sin(2 * Math.PI * (freq + detune) * t) * 0.55;  // chorus
    out[startI + i] += s * e * lfo * amp;
  }
}

/** Fake reverb: mix 4 delayed copies with decay */
function addReverb(src, startI, delaysMs = [24, 49, 81, 112], decay = 0.38) {
  for (let d = 0; d < delaysMs.length; d++) {
    const offset = Math.round(delaysMs[d] / 1000 * SR);
    const gain   = decay ** (d + 1);
    for (let i = 0; i < src.length; i++) {
      const j = startI + i + offset;
      if (j < N) out[j] += src[i] * gain;
    }
  }
}

/** Build a transient tone as Float32Array then mix + reverb */
function addTransient(startI, fn) {
  const buf = fn();
  for (let i = 0; i < buf.length && startI + i < N; i++) out[startI + i] += buf[i];
  addReverb(buf, startI);
}

/* ─── Layer 1: Sub-bass drone A1 (55 Hz) + 2nd harmonic ─────────────────── */
{
  const attI = Math.round(2.5 * SR);
  const relI = Math.round(2 * SR);
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    // Slow pitch waver ±0.4 Hz
    const lfo  = 1 + 0.007 * Math.sin(2 * Math.PI * 0.06 * t);
    const vol  = 0.18 + 0.04 * Math.sin(2 * Math.PI * 0.04 * t + 1.2);
    const e    = env(i, N, attI, relI);
    out[i] += (Math.sin(2 * Math.PI * 55 * lfo * t)
             + Math.sin(2 * Math.PI * 110 * lfo * t) * 0.35
             + Math.sin(2 * Math.PI * 27.5 * lfo * t) * 0.18) * e * vol;
  }
}

/* ─── Layer 2: Am7 chord pad (A2 C3 E3 G3 + octave A3) ──────────────────── */
{
  // [freq, relAmp, detuneHz, lfoHz, lfoDepth, phase]
  const padVoices = [
    [110,   1.00, 0.22, 0.06, 0.20, 0.00],  // A2
    [130.81,0.88, 0.18, 0.05, 0.18, 1.10],  // C3
    [164.81,0.82, 0.14, 0.07, 0.22, 2.20],  // E3
    [196.00,0.72, 0.20, 0.04, 0.16, 3.30],  // G3
    [220,   0.60, 0.10, 0.08, 0.25, 0.55],  // A3
  ];
  const attI = Math.round(3 * SR);
  const relI = Math.round(2.5 * SR);
  const baseAmp = 0.095;
  for (const [freq, rel, det, lHz, lD, ph] of padVoices) {
    addPad(freq, 0, N, baseAmp * rel, attI, relI, det, lHz, lD, ph);
  }
}

/* ─── Layer 3: High ethereal pad (E5 A5) ────────────────────────────────── */
{
  const attI = Math.round(5 * SR);
  const relI = Math.round(3 * SR);
  addPad(659.25, 0, N, 0.045, attI, relI, 0.5, 0.11, 0.30, 0.0);  // E5
  addPad(880.00, 0, N, 0.028, attI, relI, 0.3, 0.09, 0.28, 1.5);  // A5
  // Subtle A6 shimmer
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const e = env(i, N, Math.round(6 * SR), Math.round(4 * SR));
    const lfo = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.13 * t);
    out[i] += Math.sin(2 * Math.PI * 1760 * t) * e * lfo * 0.012;
  }
}

/* ─── Layer 4: LoFi kick + hihat ─────────────────────────────────────────── */
{
  // Kick on beats 0, 2 of each bar (every 2 beats)
  for (let beat = 0; beat < TOTAL_B; beat += 2) {
    addTransient(beat * BEAT_N, () => {
      const dur = Math.round(0.32 * SR);
      const b   = new Float32Array(dur);
      for (let i = 0; i < dur; i++) {
        const t    = i / SR;
        const freq = 62 * Math.exp(-t * 11) + 28;   // pitch drop
        const amp  = Math.exp(-t * 7.5) * 0.42;
        b[i] = Math.sin(2 * Math.PI * freq * t) * amp;
        // click transient
        if (i < 80) b[i] += (rand() * 2 - 1) * Math.exp(-i / 20) * 0.18;
      }
      return b;
    });

    // Ghost kick on beat 3.5 of some bars for groove
    if (beat % 8 < 4) {
      const ghostStart = Math.round((beat + 1.5) * BEAT_N);
      addTransient(ghostStart, () => {
        const dur = Math.round(0.18 * SR);
        const b = new Float32Array(dur);
        for (let i = 0; i < dur; i++) {
          const t = i / SR;
          b[i] = Math.sin(2 * Math.PI * (55 * Math.exp(-t * 14)) * t) * Math.exp(-t * 10) * 0.16;
        }
        return b;
      });
    }
  }

  // Hihat: every half-beat (quiet, lofi high noise)
  for (let hb = 0; hb < TOTAL_B * 2; hb++) {
    const start  = Math.round(hb * BEAT_N / 2);
    const isDown = hb % 2 === 0;      // on-beat louder
    const vol    = isDown ? 0.038 : 0.022;
    const dur    = Math.round((isDown ? 0.06 : 0.035) * SR);
    const buf    = new Float32Array(dur);
    for (let i = 0; i < dur; i++) {
      const e = Math.exp(-i / (SR * 0.02));
      buf[i] = (rand() * 2 - 1) * e * vol;
    }
    for (let i = 0; i < dur && start + i < N; i++) out[start + i] += buf[i];
    // Slight reverb only on down-beats
    if (isDown) addReverb(buf, start, [18, 36], 0.18);
  }

  // Open hihat every 8 beats (bar start) — slightly longer
  for (let bar = 0; bar < 8; bar++) {
    const start = bar * 4 * BEAT_N;
    const dur   = Math.round(0.18 * SR);
    const buf   = new Float32Array(dur);
    for (let i = 0; i < dur; i++) {
      const e = Math.exp(-i / (SR * 0.07));
      buf[i] = (rand() * 2 - 1) * e * 0.055;
    }
    for (let i = 0; i < dur && start + i < N; i++) out[start + i] += buf[i];
    addReverb(buf, start, [20, 44, 75], 0.28);
  }
}

/* ─── Layer 5: Digital glitch bursts ─────────────────────────────────────── */
{
  // Subtle noise clicks at off-grid positions
  const glitchFrames = [3.9, 7.85, 11.9, 15.8, 19.88, 23.82, 27.9, 31.8].map(
    b => Math.round(b * BEAT_N)
  );
  for (const gf of glitchFrames) {
    const dur = Math.round(0.018 * SR);
    const buf = new Float32Array(dur);
    for (let i = 0; i < dur; i++) {
      const e = i < dur * 0.3 ? i / (dur * 0.3) : (dur - i) / (dur * 0.7);
      buf[i] = (rand() * 2 - 1) * e * 0.055;
    }
    for (let i = 0; i < dur && gf + i < N; i++) out[gf + i] += buf[i];
    addReverb(buf, gf, [10, 22], 0.2);
  }

  // Digital stutter (repeat-click) at bar 4
  const stutterStart = Math.round(16 * BEAT_N);
  for (let r = 0; r < 6; r++) {
    const onset = stutterStart + Math.round(r * 0.065 * SR);
    const dur   = Math.round(0.04 * SR);
    for (let i = 0; i < dur && onset + i < N; i++) {
      const e = Math.exp(-i / (SR * 0.012));
      out[onset + i] += (rand() * 2 - 1) * e * 0.04 * (1 - r / 6);
    }
  }
}

/* ─── Layer 6: Sparse melody (single notes, long decay) ─────────────────── */
{
  const melNotes = [
    { beat: 0,  freq: 220,    amp: 0.072, dur: 7.0, att: 0.6, rel: 3.0 }, // A3
    { beat: 8,  freq: 164.81, amp: 0.060, dur: 6.0, att: 0.8, rel: 2.5 }, // E3
    { beat: 16, freq: 261.63, amp: 0.065, dur: 5.5, att: 0.5, rel: 2.8 }, // C4
    { beat: 20, freq: 196.00, amp: 0.050, dur: 4.5, att: 0.9, rel: 2.0 }, // G3
    { beat: 24, freq: 220,    amp: 0.068, dur: 7.2, att: 0.6, rel: 3.2 }, // A3
    { beat: 28, freq: 329.63, amp: 0.042, dur: 3.8, att: 0.4, rel: 2.0 }, // E4
  ];

  for (const note of melNotes) {
    const startI = Math.round(note.beat * BEAT_N);
    const durI   = Math.round(note.dur * SR);
    const attI   = Math.round(note.att * SR);
    const relI   = Math.round(note.rel * SR);
    const buf    = new Float32Array(durI);

    for (let i = 0; i < durI; i++) {
      const t = i / SR;
      const e = env(i, durI, attI, relI);
      // Main tone + slight 2nd harmonic for warmth
      buf[i] = (Math.sin(2 * Math.PI * note.freq * t)
             + Math.sin(2 * Math.PI * note.freq * 2 * t) * 0.18) * e * note.amp;
    }

    for (let i = 0; i < durI && startI + i < N; i++) out[startI + i] += buf[i];
    addReverb(buf, startI, [30, 62, 95, 140], 0.42);  // lush reverb tail
  }
}

/* ─── Soft limiter + normalize ─────────────────────────────────────────────── */
{
  // Soft tanh limiter
  for (let i = 0; i < N; i++) out[i] = Math.tanh(out[i] * 1.1) * 0.88;

  // Global fade-in / fade-out for seamless loop
  const FI = Math.round(0.08 * SR);
  const FO = Math.round(0.15 * SR);
  for (let i = 0; i < FI; i++) out[i] *= i / FI;
  for (let i = 0; i < FO; i++) out[N - 1 - i] *= i / FO;
}

/* ─── Build WAV ──────────────────────────────────────────────────────────── */
function buildWav(samples) {
  const data = samples.length * 2;
  const buf  = Buffer.alloc(44 + data);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + data, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(data, 40);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  return buf;
}

const outPath = path.join(__dirname, "../public/ambient-login.wav");
fs.writeFileSync(outPath, buildWav(out));

const sizeMB = (44 + N * 2) / 1024 / 1024;
console.log(`✓ ambient-login.wav  ${sizeMB.toFixed(1)} MB  (${(N / SR).toFixed(1)}s @ ${BPM}BPM, ${N} samples)`);
