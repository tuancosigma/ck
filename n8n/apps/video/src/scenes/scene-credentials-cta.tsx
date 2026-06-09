import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { GlowOrb, Particles, GridLines } from "../components/particles";

const ORANGE = "#F25E22";
const VIOLET = "#7C3AED";
const EMERALD = "#10B981";

// Content confined to x=60–1060 (1000px wide).
// Right 860px is ambient — hidden behind login form panel.

const CREDS = [
  { name: "Production Database",  typeLabel: "PostgreSQL", color: "#60A5FA", lastUsed: "2m ago"  },
  { name: "Sendgrid Email API",   typeLabel: "API Key",    color: ORANGE,    lastUsed: "18m ago" },
  { name: "SMTP Relay Server",    typeLabel: "SMTP",       color: EMERALD,   lastUsed: "1h ago"  },
  { name: "Stripe Payments",      typeLabel: "API Key",    color: ORANGE,    lastUsed: "3h ago"  },
  { name: "Slack Workspace",      typeLabel: "OAuth2",     color: VIOLET,    lastUsed: "5h ago"  },
];

const LockIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="11" width="18" height="12" rx="3" fill={color} opacity="0.15" stroke={color} strokeWidth="1.5" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="12" cy="17" r="1.5" fill={color} />
  </svg>
);

export const SceneCredentialsCta: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerProgress = spring({ frame, fps, config: { damping: 200, stiffness: 80 } });

  const ctaStart = 140;
  const ctaProgress = spring({ frame: frame - ctaStart, fps, config: { damping: 120, stiffness: 60 } });
  const ctaOpacity = interpolate(ctaProgress, [0, 1], [0, 1]);
  const ctaScale = interpolate(ctaProgress, [0, 1], [0.88, 1]);
  const ringScale = 1 + Math.sin(frame * 0.07) * 0.04;
  const ringOpacity = 0.15 + Math.sin(frame * 0.07) * 0.08;
  const scanY = ((frame * 2) % 560) - 30;

  return (
    <div style={{
      width: 1920, height: 1080, background: "#0a0d14",
      overflow: "hidden", position: "relative",
      fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
    }}>
      <GridLines opacity={0.022} />
      <GlowOrb cx={560} cy={540} r={700} color={ORANGE} opacity={0.04} />
      <GlowOrb cx={200} cy={200} r={400} color={VIOLET} opacity={0.08} />
      <GlowOrb cx={950} cy={800} r={350} color={EMERALD} opacity={0.05} />
      <GlowOrb cx={1500} cy={540} r={500} color={ORANGE} opacity={0.02} />
      <Particles opacity={0.4} />

      {/* Two-column layout: vault list (left) + CTA (right) — all within x=60–1060 */}
      <div style={{
        position: "absolute", inset: 0,
        display: "grid", gridTemplateColumns: "1fr 1fr",
        paddingLeft: 60, paddingRight: 860, // right 860px = ambient zone
      }}>
        {/* LEFT: vault list */}
        <div style={{ padding: "70px 20px 70px 0" }}>
          <div style={{
            opacity: interpolate(headerProgress, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(headerProgress, [0, 1], [-14, 0])}px)`,
          }}>
            <div style={{ fontSize: 12, color: VIOLET, letterSpacing: "0.15em", fontWeight: 600, marginBottom: 7 }}>CREDENTIALS VAULT</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: "white", marginBottom: 5 }}>Secure Secret Management</div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 24 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L4 5v6c0 5 4 9.6 8 11 4-1.4 8-6 8-11V5L12 2z" fill={ORANGE} opacity="0.15" stroke={ORANGE} strokeWidth="1.5" />
                <path d="M9 12l2 2 4-4" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.32)" }}>AES-256 encrypted · Zero plaintext exposure</span>
            </div>
          </div>

          <div style={{ background: "rgba(10,13,20,0.85)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden", position: "relative" }}>
            <div style={{ position: "absolute", left: 0, right: 0, top: scanY, height: 30, background: `linear-gradient(transparent,${VIOLET}08,transparent)`, pointerEvents: "none" }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 70px", gap: 12, padding: "11px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 10, color: "rgba(255,255,255,0.28)", letterSpacing: "0.08em" }}>
              <span>NAME</span><span>TYPE</span><span>USED</span>
            </div>
            {CREDS.map((c, i) => {
              const ip = spring({ frame: frame - i * 9, fps, config: { damping: 150, stiffness: 70 } });
              return (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "1fr 80px 70px", gap: 12,
                  padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)",
                  opacity: interpolate(ip, [0, 1], [0, 1]),
                  transform: `translateX(${interpolate(ip, [0, 1], [-16, 0])}px)`,
                  alignItems: "center",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <LockIcon color={c.color} />
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.78)", fontWeight: 500 }}>{c.name}</span>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: c.color, background: `${c.color}15`, padding: "2px 8px", borderRadius: 5, textAlign: "center" }}>{c.typeLabel}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.22)" }}>{c.lastUsed}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: CTA */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "70px 0 70px 20px" }}>
          <div style={{ opacity: ctaOpacity, transform: `scale(${ctaScale})`, textAlign: "center", maxWidth: 380 }}>
            {/* Shield */}
            <div style={{ position: "relative", display: "inline-block", marginBottom: 32 }}>
              <div style={{ position: "absolute", inset: -32, borderRadius: "50%", border: `2px solid ${ORANGE}`, transform: `scale(${ringScale})`, opacity: ringOpacity }} />
              <div style={{ position: "absolute", inset: -55, borderRadius: "50%", border: `1px solid ${ORANGE}`, transform: `scale(${ringScale * 0.94})`, opacity: ringOpacity * 0.5 }} />
              <svg viewBox="0 0 100 100" width="100" height="100">
                <defs>
                  <radialGradient id="sg2" cx="50%" cy="30%" r="70%">
                    <stop offset="0%" stopColor={ORANGE} /><stop offset="100%" stopColor="#c44010" />
                  </radialGradient>
                  <filter id="sg2f"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                </defs>
                <path d="M50 6 L86 23 L86 54 Q86 77 50 94 Q14 77 14 54 L14 23 Z" fill="url(#sg2)" filter="url(#sg2f)" />
                <path d="M55 31 L43 52 L52 52 L45 70 L60 46 L51 46 Z" fill="white" opacity="0.95" />
              </svg>
            </div>

            <div style={{ fontSize: 52, fontWeight: 900, color: "white", letterSpacing: "0.1em", textShadow: `0 0 50px ${ORANGE}55`, marginBottom: 12, lineHeight: 1 }}>F-GUARD</div>
            <div style={{ fontSize: 16, color: "rgba(255,255,255,0.48)", marginBottom: 32, lineHeight: 1.6 }}>
              Automate everything.<br /><span style={{ color: ORANGE }}>Secure</span> by design.
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 24 }}>
              <div style={{ padding: "11px 28px", borderRadius: 10, background: ORANGE, color: "white", fontSize: 13, fontWeight: 700, boxShadow: `0 0 30px ${ORANGE}44` }}>Get Started Free</div>
              <div style={{ padding: "11px 28px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.65)", fontSize: 13, fontWeight: 600 }}>View Docs</div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              {[
                { label: "Real-Time Logs",    color: EMERALD },
                { label: "Visual Builder",    color: VIOLET  },
                { label: "500+ Integrations", color: ORANGE  },
                { label: "SOC 2 Compliant",   color: "#60A5FA" },
              ].map((b, i) => {
                const bp = spring({ frame: frame - ctaStart - 16 - i * 7, fps, config: { damping: 200, stiffness: 100 } });
                return (
                  <div key={i} style={{
                    opacity: interpolate(bp, [0, 1], [0, 1]),
                    transform: `translateY(${interpolate(bp, [0, 1], [10, 0])}px)`,
                    padding: "5px 12px", borderRadius: 999,
                    border: `1px solid ${b.color}40`, background: `${b.color}0d`,
                    color: b.color, fontSize: 11, fontWeight: 500,
                  }}>{b.label}</div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Right ambient decoration */}
      <svg style={{ position: "absolute", inset: 0, pointerEvents: "none" }} viewBox="0 0 1920 1080" width="1920" height="1080">
        <line x1="1100" y1="0" x2="1100" y2="1080" stroke="rgba(255,255,255,0.02)" strokeWidth="1" strokeDasharray="4 10" />
        {Array.from({ length: 5 }, (_, i) => (
          <circle key={i} cx={1400 + i * 90} cy={540} r={60 + i * 30} fill="none" stroke="rgba(242,94,34,0.025)" strokeWidth="1" />
        ))}
      </svg>
    </div>
  );
};