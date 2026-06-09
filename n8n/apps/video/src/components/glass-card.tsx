import React from "react";
import { useCurrentFrame, spring, interpolate, useVideoConfig } from "remotion";

export const GlassCard: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
  enterFrame?: number;
  glowColor?: string;
}> = ({ children, style, enterFrame = 0, glowColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - enterFrame,
    fps,
    config: { damping: 120, stiffness: 60, mass: 1 },
  });

  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const scale = interpolate(progress, [0, 1], [0.92, 1]);
  const translateY = interpolate(progress, [0, 1], [20, 0]);

  return (
    <div
      style={{
        opacity,
        transform: `scale(${scale}) translateY(${translateY}px)`,
        background: "rgba(10,13,20,0.75)",
        backdropFilter: "blur(20px)",
        border: `1px solid rgba(255,255,255,0.08)`,
        borderRadius: 16,
        boxShadow: glowColor
          ? `0 0 40px ${glowColor}22, 0 0 80px ${glowColor}11, inset 0 1px 0 rgba(255,255,255,0.06)`
          : "inset 0 1px 0 rgba(255,255,255,0.06), 0 20px 60px rgba(0,0,0,0.5)",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const StatusBadge: React.FC<{
  label: string;
  color: string;
  bgColor: string;
}> = ({ label, color, bgColor }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "4px 12px",
      borderRadius: 999,
      background: bgColor,
      border: `1px solid ${color}44`,
      fontSize: 13,
      fontWeight: 600,
      color,
      letterSpacing: "0.04em",
    }}
  >
    <div
      style={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: color,
        boxShadow: `0 0 6px ${color}`,
      }}
    />
    {label}
  </div>
);
