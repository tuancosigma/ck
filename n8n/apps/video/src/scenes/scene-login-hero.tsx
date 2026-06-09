import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { Particles, GridLines, GlowOrb } from "../components/particles";

const ORANGE = "#F25E22";
const VIOLET = "#7C3AED";

// Content is intentionally confined to x=0–1100 (left portion of 1920px frame).
// The right 820px is ambient-only — stays visible as background on login page.

export const SceneLoginHero: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoProgress = spring({ frame, fps, config: { damping: 120, stiffness: 60 } });
  const logoScale = interpolate(logoProgress, [0, 1], [0.4, 1]);
  const logoOpacity = interpolate(logoProgress, [0, 1], [0, 1]);
  const shieldPulse = 1 + Math.sin(frame * 0.08) * 0.04;

  const scanProgress = interpolate(frame, [20, 60], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const orbOpacity = interpolate(frame, [10, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const taglineProgress = spring({ frame: frame - 50, fps, config: { damping: 200, stiffness: 60 } });
  const taglineOpacity = interpolate(taglineProgress, [0, 1], [0, 1]);
  const taglineY = interpolate(taglineProgress, [0, 1], [20, 0]);

  const lineProgress = interpolate(frame, [30, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const fadeOut = interpolate(frame, [190, 220], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Content center: x=540 (left-side center), leaving x=1100–1920 as ambient
  const contentCenterX = 540;

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        background: "#0a0d14",
        overflow: "hidden",
        position: "relative",
        opacity: fadeOut,
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      }}
    >
      <GridLines opacity={0.035} />

      {/* Atmospheric orbs — left-biased */}
      <div style={{ opacity: orbOpacity }}>
        <GlowOrb cx={540} cy={400} r={600} color={ORANGE} opacity={0.1} />
        <GlowOrb cx={200} cy={900} r={400} color={VIOLET} opacity={0.12} />
        <GlowOrb cx={950} cy={600} r={350} color={VIOLET} opacity={0.07} />
        {/* Ambient right-side glow — purely decorative */}
        <GlowOrb cx={1500} cy={540} r={500} color={ORANGE} opacity={0.03} />
      </div>

      <Particles opacity={0.6} />

      {/* Corner accents on left portion only */}
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
        viewBox="0 0 1920 1080"
      >
        <line x1="80" y1="80" x2={80 + lineProgress * 120} y2="80" stroke={ORANGE} strokeWidth="2" opacity="0.6" />
        <line x1="80" y1="80" x2="80" y2={80 + lineProgress * 120} stroke={ORANGE} strokeWidth="2" opacity="0.6" />
        <line x1="1000" y1="1000" x2={1000 - lineProgress * 100} y2="1000" stroke={VIOLET} strokeWidth="2" opacity="0.5" />
        <line x1="1000" y1="1000" x2="1000" y2={1000 - lineProgress * 100} stroke={VIOLET} strokeWidth="2" opacity="0.5" />
        {/* Vertical separator hint at x=1100 */}
        <line x1="1100" y1="0" x2="1100" y2="1080" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
      </svg>

      {/* Center content in left portion: x=contentCenterX, y=540 */}
      <div
        style={{
          position: "absolute",
          left: contentCenterX - 300,
          top: 0,
          width: 600,
          height: 1080,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
        }}
      >
        {/* Shield logo */}
        <div
          style={{
            opacity: logoOpacity,
            transform: `scale(${logoScale * shieldPulse})`,
            width: 110,
            height: 110,
            position: "relative",
          }}
        >
          <svg viewBox="0 0 120 120" width="110" height="110">
            <defs>
              <radialGradient id="shieldGrad" cx="50%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#F25E22" />
                <stop offset="100%" stopColor="#c44010" />
              </radialGradient>
              <filter id="shieldGlow">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <circle cx="60" cy="60" r="58" fill="none" stroke={ORANGE} strokeWidth="1" opacity="0.3" />
            <path d="M60 10 L100 30 L100 65 Q100 90 60 110 Q20 90 20 65 L20 30 Z" fill="url(#shieldGrad)" filter="url(#shieldGlow)" />
            <path d="M66 38 L52 62 L62 62 L54 84 L72 56 L62 56 Z" fill="white" opacity="0.95" />
          </svg>
          <div
            style={{
              position: "absolute",
              inset: -20,
              borderRadius: "50%",
              border: `2px solid ${ORANGE}`,
              opacity: 0.2 + Math.sin(frame * 0.1) * 0.15,
            }}
          />
        </div>

        {/* Brand name scan-reveal */}
        <div
          style={{
            clipPath: `inset(0 ${100 - scanProgress}% 0 0)`,
            fontSize: 88,
            fontWeight: 800,
            letterSpacing: "0.15em",
            color: "white",
            textShadow: `0 0 40px ${ORANGE}66`,
          }}
        >
          F-GUARD
        </div>

        {/* Accent underline */}
        <div
          style={{
            width: `${lineProgress * 360}px`,
            height: 2,
            background: `linear-gradient(90deg, transparent, ${ORANGE}, transparent)`,
          }}
        />

        {/* Tagline */}
        <div
          style={{
            opacity: taglineOpacity,
            transform: `translateY(${taglineY}px)`,
            fontSize: 21,
            color: "rgba(255,255,255,0.55)",
            letterSpacing: "0.08em",
            fontWeight: 300,
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          AI-POWERED WORKFLOW<br />AUTOMATION PLATFORM
        </div>

        {/* Sub-badges */}
        <div
          style={{
            opacity: taglineOpacity,
            transform: `translateY(${taglineY}px)`,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            alignItems: "center",
            marginTop: 4,
          }}
        >
          {["Real-Time Execution", "Node-Based Flows", "Enterprise Security"].map((label, i) => (
            <div
              key={i}
              style={{
                padding: "5px 16px",
                borderRadius: 999,
                border: `1px solid rgba(242,94,34,0.3)`,
                background: "rgba(242,94,34,0.06)",
                color: ORANGE,
                fontSize: 13,
                fontWeight: 500,
                letterSpacing: "0.05em",
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Right-side ambient decorative elements (purely visual, no text) */}
      <svg
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        viewBox="0 0 1920 1080"
        width="1920" height="1080"
      >
        {/* Hexagonal grid hint on right side */}
        {Array.from({ length: 6 }, (_, row) =>
          Array.from({ length: 4 }, (_, col) => {
            const cx = 1200 + col * 180;
            const cy = 100 + row * 170;
            const p = interpolate(frame, [20 + row * 8 + col * 5, 60 + row * 8 + col * 5], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <circle
                key={`${row}-${col}`}
                cx={cx} cy={cy} r={40}
                fill="none"
                stroke="rgba(124,58,237,0.08)"
                strokeWidth="1"
                opacity={p}
              />
            );
          })
        )}
      </svg>
    </div>
  );
};
