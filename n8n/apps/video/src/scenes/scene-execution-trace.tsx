import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { GlowOrb, Particles, GridLines } from "../components/particles";

const ORANGE = "#F25E22";
const VIOLET = "#7C3AED";
const EMERALD = "#10B981";

// Content confined to x=60–1060 (1000px wide).

type Step = { name: string; duration: string; status: "success"|"error"|"running"; input: string };

const STEPS: Step[] = [
  { name: "Webhook Trigger",    duration: "12ms",   status: "success", input: `{ "event": "user.signup", "userId": "u_8x2k9" }` },
  { name: "Filter: Role Check", duration: "3ms",    status: "success", input: `{ "role": "admin", "passed": true }` },
  { name: "HTTP: Fetch Profile",duration: "184ms",  status: "success", input: `GET /api/users/u_8x2k9` },
  { name: "Transform: Map",     duration: "7ms",    status: "success", input: `{ "plan": "enterprise", "name": "Alice Chen" }` },
  { name: "Send Welcome Email", duration: "340ms",  status: "running", input: `{ "to": "user@acme.com", "template": "welcome_ent" }` },
];

function JsonLine({ line, color }: { line: string; color: string }) {
  return <div style={{ fontFamily: "monospace", fontSize: 11, color, lineHeight: 1.6, whiteSpace: "nowrap" }}>{line}</div>;
}

export const SceneExecutionTrace: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerProgress = spring({ frame, fps, config: { damping: 200, stiffness: 80 } });
  const fadeOut = interpolate(frame, [130, 150], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div style={{ width: 1920, height: 1080, background: "#0a0d14", overflow: "hidden", position: "relative", opacity: fadeOut, fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" }}>
      <GridLines opacity={0.02} />
      <GlowOrb cx={560} cy={540} r={600} color={EMERALD} opacity={0.05} />
      <GlowOrb cx={1500} cy={300} r={400} color={VIOLET} opacity={0.04} />
      <Particles opacity={0.22} />

      {/* Header */}
      <div style={{
        position: "absolute", top: 55, left: 60,
        opacity: interpolate(headerProgress, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(headerProgress, [0, 1], [-14, 0])}px)`,
      }}>
        <div style={{ fontSize: 12, color: EMERALD, letterSpacing: "0.15em", fontWeight: 600, marginBottom: 5 }}>EXECUTION MONITOR</div>
        <div style={{ fontSize: 36, fontWeight: 800, color: "white" }}>Step-by-Step Trace</div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.32)", marginTop: 5 }}>
          Execution #48,291 · user-onboarding-flow · 546ms total
        </div>
      </div>

      {/* Two-column layout — x=60 to x=1060 */}
      <div style={{
        position: "absolute", top: 190, left: 60, width: 1000, bottom: 55,
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20,
      }}>
        {/* Timeline */}
        <div style={{ background: "rgba(10,13,20,0.82)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 22, overflow: "hidden" }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 18, letterSpacing: "0.08em" }}>EXECUTION TIMELINE</div>
          {STEPS.map((step, i) => {
            const sp = spring({ frame: frame - i * 13, fps, config: { damping: 150, stiffness: 70 } });
            const statusColor = step.status === "success" ? EMERALD : step.status === "running" ? ORANGE : "#F43F5E";
            const isRunning = step.status === "running";
            const pulse = isRunning ? 0.5 + Math.sin(frame * 0.2) * 0.5 : 1;
            return (
              <div key={i} style={{
                display: "flex", gap: 14, marginBottom: 0,
                opacity: interpolate(sp, [0, 1], [0, 1]),
                transform: `translateX(${interpolate(sp, [0, 1], [-24, 0])}px)`,
              }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 18 }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: statusColor, boxShadow: `0 0 8px ${statusColor}`, opacity: pulse, flexShrink: 0, marginTop: 9 }} />
                  {i < STEPS.length - 1 && <div style={{ width: 2, flex: 1, background: `linear-gradient(${statusColor}, rgba(255,255,255,0.06))`, minHeight: 36 }} />}
                </div>
                <div style={{ flex: 1, paddingBottom: 18, borderBottom: i < STEPS.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.88)" }}>{step.name}</div>
                    <div style={{ fontSize: 11, color: statusColor, background: `${statusColor}18`, padding: "2px 8px", borderRadius: 5, fontWeight: 600 }}>
                      {isRunning ? "RUNNING" : step.duration}
                    </div>
                  </div>
                  <div style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,0.28)", marginTop: 3 }}>
                    {step.input.slice(0, 48)}{step.input.length > 48 ? "…" : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* JSON Inspector */}
        <div style={{ background: "rgba(10,13,20,0.82)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 22, overflow: "hidden" }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 18, letterSpacing: "0.08em" }}>JSON INSPECTOR — HTTP: Fetch Profile</div>

          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: EMERALD, fontWeight: 600, letterSpacing: "0.08em" }}>INPUT</div>
              <div style={{ fontSize: 10, color: VIOLET, background: `${VIOLET}18`, padding: "2px 8px", borderRadius: 5 }}>Copy</div>
            </div>
            <div style={{ background: "rgba(0,0,0,0.4)", border: `1px solid ${EMERALD}20`, borderRadius: 8, padding: "12px 14px" }}>
              {[`{`, `  "userId": "u_8x2k9",`, `  "endpoint": "/api/users",`, `  "method": "GET"`, `}`].map((line, i) => {
                const p = interpolate(frame, [30 + i * 4, 48 + i * 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
                return <div key={i} style={{ opacity: p }}><JsonLine line={line} color={line.includes('"') && line.includes(':') ? "#60A5FA" : "rgba(255,255,255,0.38)"} /></div>;
              })}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: ORANGE, fontWeight: 600, letterSpacing: "0.08em", marginBottom: 8 }}>OUTPUT</div>
            <div style={{ background: "rgba(0,0,0,0.4)", border: `1px solid ${ORANGE}20`, borderRadius: 8, padding: "12px 14px" }}>
              {[`{`, `  "status": 200,`, `  "name": "Alice Chen",`, `  "plan": "enterprise",`, `  "tier": "ENT"`, `}`].map((line, i) => {
                const p = interpolate(frame, [62 + i * 4, 80 + i * 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
                return <div key={i} style={{ opacity: p }}><JsonLine line={line} color={line.includes('"') && line.includes(':') ? "#FBBF24" : "rgba(255,255,255,0.38)"} /></div>;
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Right ambient */}
      <svg style={{ position: "absolute", inset: 0, pointerEvents: "none" }} viewBox="0 0 1920 1080" width="1920" height="1080">
        <line x1="1100" y1="0" x2="1100" y2="1080" stroke="rgba(255,255,255,0.02)" strokeWidth="1" strokeDasharray="4 10" />
      </svg>
    </div>
  );
};
