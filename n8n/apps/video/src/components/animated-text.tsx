import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

/** Fade + slide-up text reveal */
export const RevealText: React.FC<{
  text: string;
  style?: React.CSSProperties;
  delay?: number;
  duration?: number;
}> = ({ text, style, delay = 0, duration = 20 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200, stiffness: 80, mass: 1 },
  });

  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const translateY = interpolate(progress, [0, 1], [24, 0]);

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        ...style,
      }}
    >
      {text}
    </div>
  );
};

/** Typewriter character-by-character reveal */
export const TypewriterText: React.FC<{
  text: string;
  startFrame: number;
  charsPerFrame?: number;
  style?: React.CSSProperties;
}> = ({ text, startFrame, charsPerFrame = 0.5, style }) => {
  const frame = useCurrentFrame();
  const elapsed = Math.max(0, frame - startFrame);
  const visibleChars = Math.min(text.length, Math.floor(elapsed * charsPerFrame));

  return (
    <div style={style}>
      {text.slice(0, visibleChars)}
      {visibleChars < text.length && (
        <span style={{ opacity: Math.floor(elapsed * 0.1) % 2 === 0 ? 1 : 0 }}>|</span>
      )}
    </div>
  );
};

/** Word-by-word staggered reveal */
export const WordReveal: React.FC<{
  text: string;
  startFrame: number;
  stagger?: number;
  style?: React.CSSProperties;
  wordStyle?: React.CSSProperties;
}> = ({ text, startFrame, stagger = 5, style, wordStyle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25em", ...style }}>
      {words.map((word, i) => {
        const delay = startFrame + i * stagger;
        const progress = spring({
          frame: frame - delay,
          fps,
          config: { damping: 200, stiffness: 100 },
        });
        return (
          <span
            key={i}
            style={{
              opacity: interpolate(progress, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(progress, [0, 1], [16, 0])}px)`,
              display: "inline-block",
              ...wordStyle,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

/** Horizontal scan-line reveal (left-to-right clip) */
export const ScanReveal: React.FC<{
  children: React.ReactNode;
  startFrame: number;
  duration?: number;
  style?: React.CSSProperties;
}> = ({ children, startFrame, duration = 30, style }) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [startFrame, startFrame + duration], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        clipPath: `inset(0 ${100 - progress}% 0 0)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
