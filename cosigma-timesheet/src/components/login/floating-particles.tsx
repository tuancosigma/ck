"use client";

// Ambient background: ~18 glowing orbs that drift, rotate and pulse on
// independent loops to create a slow-moving neon field behind the login card.

import { motion } from "framer-motion";
import { useMemo } from "react";

interface Orb {
  size: number;
  left: number;
  top: number;
  hue: string;
  duration: number;
  delay: number;
  drift: number;
}

const HUES = [
  "rgba(99,102,241,0.35)", // indigo
  "rgba(139,92,246,0.30)", // violet
  "rgba(16,185,129,0.25)", // emerald
  "rgba(56,189,248,0.28)", // cyan
];

// Deterministic pseudo-random so server/client markup matches (no hydration drift).
function seeded(i: number, salt: number) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function FloatingParticles({ count = 18 }: { count?: number }) {
  const orbs = useMemo<Orb[]>(
    () =>
      Array.from({ length: count }, (_, i) => ({
        size: 60 + seeded(i, 1) * 220,
        left: seeded(i, 2) * 100,
        top: seeded(i, 3) * 100,
        hue: HUES[Math.floor(seeded(i, 4) * HUES.length)],
        duration: 16 + seeded(i, 5) * 22,
        delay: seeded(i, 6) * -20,
        drift: 30 + seeded(i, 7) * 80,
      })),
    [count]
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {orbs.map((o, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: o.size,
            height: o.size,
            left: `${o.left}%`,
            top: `${o.top}%`,
            background: `radial-gradient(circle at 30% 30%, ${o.hue}, transparent 70%)`,
            filter: "blur(8px)",
          }}
          animate={{
            x: [0, o.drift, -o.drift * 0.5, 0],
            y: [0, -o.drift * 0.7, o.drift, 0],
            rotate: [0, 180, 360],
            scale: [1, 1.15, 0.9, 1],
            opacity: [0.4, 0.75, 0.5, 0.4],
          }}
          transition={{
            duration: o.duration,
            delay: o.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
