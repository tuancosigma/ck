import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";

type Particle = {
  x: number;
  y: number;
  size: number;
  speed: number;
  color: string;
  phase: number;
};

const COLORS = ["#F25E22", "#7C3AED", "#10B981", "#F25E22", "#7C3AED"];

function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    x: seededRandom(i * 7) * 1920,
    y: seededRandom(i * 13) * 1080,
    size: 1.5 + seededRandom(i * 17) * 3,
    speed: 0.3 + seededRandom(i * 23) * 0.7,
    color: COLORS[Math.floor(seededRandom(i * 31) * COLORS.length)],
    phase: seededRandom(i * 37) * Math.PI * 2,
  }));
}

const PARTICLES = generateParticles(80);

export const Particles: React.FC<{ opacity?: number }> = ({ opacity = 1 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        opacity,
        pointerEvents: "none",
      }}
      viewBox="0 0 1920 1080"
    >
      {PARTICLES.map((p, i) => {
        const drift = Math.sin(t * p.speed + p.phase) * 30;
        const driftX = Math.cos(t * p.speed * 0.7 + p.phase) * 20;
        const glow = 0.3 + Math.sin(t * p.speed * 2 + p.phase) * 0.3;
        return (
          <circle
            key={i}
            cx={p.x + driftX}
            cy={p.y + drift}
            r={p.size}
            fill={p.color}
            opacity={glow}
          />
        );
      })}
    </svg>
  );
};

export const GridLines: React.FC<{ opacity?: number }> = ({ opacity = 0.04 }) => (
  <svg
    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    viewBox="0 0 1920 1080"
  >
    <defs>
      <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse">
        <path d="M 80 0 L 0 0 0 80" fill="none" stroke="#ffffff" strokeWidth="0.5" opacity={opacity} />
      </pattern>
    </defs>
    <rect width="1920" height="1080" fill="url(#grid)" />
  </svg>
);

export const GlowOrb: React.FC<{
  cx: number;
  cy: number;
  r: number;
  color: string;
  opacity?: number;
}> = ({ cx, cy, r, color, opacity = 0.12 }) => (
  <svg
    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    viewBox="0 0 1920 1080"
  >
    <defs>
      <radialGradient id={`orb-${cx}-${cy}`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor={color} stopOpacity={opacity} />
        <stop offset="100%" stopColor={color} stopOpacity="0" />
      </radialGradient>
    </defs>
    <ellipse cx={cx} cy={cy} rx={r} ry={r * 0.6} fill={`url(#orb-${cx}-${cy})`} />
  </svg>
);
