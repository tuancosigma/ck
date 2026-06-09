import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { Particles, GridLines, GlowOrb } from "../components/particles";
import { StatusBadge } from "../components/glass-card";

const ORANGE = "#F25E22";
const VIOLET = "#7C3AED";
const EMERALD = "#10B981";
const ROSE = "#F43F5E";

// Content confined to x=60–1060 (1000px wide).
// Right 860px (x=1060–1920) is ambient — hidden behind login form.

type KPI = {
  label: string;
  numeric: number;
  unit: string;
  trend: string;
  trendUp: boolean;
  color: string;
};

const KPIS: KPI[] = [
  { label: "Total Executions", numeric: 48291, unit: "",  trend: "+12.4%", trendUp: true,  color: ORANGE  },
  { label: "Success Rate",     numeric: 98.7,  unit: "%", trend: "+0.3%",  trendUp: true,  color: EMERALD },
  { label: "Active Workflows", numeric: 127,   unit: "",  trend: "+8",     trendUp: true,  color: VIOLET  },
  { label: "Avg Run Duration", numeric: 1.24,  unit: "s", trend: "-0.18s", trendUp: false, color: "#60A5FA"},
];

function formatAnimated(numeric: number, progress: number, unit: string): string {
  const current = numeric * progress;
  if (unit === "%") return current.toFixed(1) + "%";
  if (unit === "s") return current.toFixed(2) + "s";
  if (numeric > 1000) return Math.floor(current).toLocaleString();
  return Math.floor(current).toString();
}

const MiniBar: React.FC<{ color: string; enterFrame: number }> = ({ color, enterFrame }) => {
  const frame = useCurrentFrame();
  const bars = [40, 65, 45, 80, 55, 90, 70, 85, 60, 95];
  return (
    <svg width="110" height="32" viewBox="0 0 110 32">
      {bars.map((h, i) => {
        const p = interpolate(frame, [enterFrame + i * 3, enterFrame + i * 3 + 12], [0, 1], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
        });
        const barH = (h / 100) * 28 * p;
        return <rect key={i} x={i * 12 + 2} y={32 - barH} width={8} height={barH} rx={2} fill={color} opacity={0.45 + (h / 100) * 0.5} />;
      })}
    </svg>
  );
};

export const SceneDashboardKpi: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerProgress = spring({ frame, fps, config: { damping: 200, stiffness: 80 } });
  const fadeOut = interpolate(frame, [155, 175], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Area chart points scaled to 460px wide (x=60 to x=520)
  const chartPts = [
    [0,110],[50,85],[100,95],[150,65],[200,75],[250,50],[300,62],[350,38],[400,45],[460,22],[460,115],[0,115],
  ];
  const chartProgress = interpolate(frame, [40, 100], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const visible = Math.floor(chartProgress * (chartPts.length - 3));
  const displayPts = [...chartPts.slice(0, visible + 1), [chartPts[visible][0], 115], [0, 115]];

  return (
    <div style={{ width: 1920, height: 1080, background: "#0a0d14", overflow: "hidden", position: "relative", opacity: fadeOut, fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" }}>
      <GridLines opacity={0.025} />
      <GlowOrb cx={560} cy={200} r={600} color={ORANGE} opacity={0.06} />
      <GlowOrb cx={900} cy={700} r={400} color={VIOLET} opacity={0.07} />
      {/* Ambient right side */}
      <GlowOrb cx={1500} cy={540} r={500} color={VIOLET} opacity={0.025} />
      <Particles opacity={0.3} />

      {/* Header — left of x=1060 */}
      <div style={{
        position: "absolute", top: 70, left: 60,
        opacity: interpolate(headerProgress, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(headerProgress, [0, 1], [-20, 0])}px)`,
      }}>
        <div style={{ fontSize: 12, color: ORANGE, letterSpacing: "0.15em", fontWeight: 600, marginBottom: 6 }}>COMMAND CENTER</div>
        <div style={{ fontSize: 42, fontWeight: 800, color: "white", letterSpacing: "-0.02em" }}>Platform Overview</div>
        <div style={{ fontSize: 16, color: "rgba(255,255,255,0.38)", marginTop: 6 }}>Real-time execution metrics — last 30 days</div>
      </div>

      <div style={{ position: "absolute", top: 70, left: 820 }}>
        <StatusBadge label="LIVE" color={EMERALD} bgColor="rgba(16,185,129,0.1)" />
      </div>

      {/* 2×2 KPI grid: x=60–1040, y=220–500 */}
      <div style={{
        position: "absolute", top: 220, left: 60, width: 980,
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20,
      }}>
        {KPIS.map((kpi, i) => {
          const cp = spring({ frame: frame - i * 10, fps, config: { damping: 120, stiffness: 60 } });
          const kpiCount = interpolate(frame, [i * 8 + 20, i * 8 + 70], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div key={i} style={{
              opacity: interpolate(cp, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(cp, [0, 1], [28, 0])}px) scale(${interpolate(cp, [0, 1], [0.94, 1])})`,
              background: "rgba(10,13,20,0.82)", backdropFilter: "blur(20px)",
              border: `1px solid rgba(255,255,255,0.07)`, borderTop: `2px solid ${kpi.color}`,
              borderRadius: 14, padding: "22px 22px 16px",
              boxShadow: `0 0 30px ${kpi.color}10`,
            }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em", marginBottom: 12 }}>
                {kpi.label.toUpperCase()}
              </div>
              <div style={{ fontSize: 46, fontWeight: 800, color: kpi.color, letterSpacing: "-0.02em", lineHeight: 1, textShadow: `0 0 24px ${kpi.color}44` }}>
                {formatAnimated(kpi.numeric, kpiCount, kpi.unit)}
              </div>
              <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <MiniBar color={kpi.color} enterFrame={i * 8 + 28} />
                <div style={{ fontSize: 13, fontWeight: 600, color: kpi.trendUp ? EMERALD : ROSE, background: kpi.trendUp ? "rgba(16,185,129,0.1)" : "rgba(244,63,94,0.1)", padding: "3px 9px", borderRadius: 7 }}>
                  {kpi.trend}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom row: chart + activity feed — both within x=60–1040 */}
      <div style={{ position: "absolute", bottom: 60, left: 60, width: 980, display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
        {/* Area chart */}
        <div style={{ background: "rgba(10,13,20,0.82)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 22 }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 14 }}>Execution Volume — 30 Days</div>
          <svg width="100%" height="110" viewBox="0 0 460 115" preserveAspectRatio="none">
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={VIOLET} stopOpacity="0.45" />
                <stop offset="100%" stopColor={VIOLET} stopOpacity="0" />
              </linearGradient>
            </defs>
            {displayPts.length > 2 && (
              <polygon points={displayPts.map(([x, y]) => `${x},${y}`).join(" ")} fill="url(#areaGrad)" />
            )}
            {visible > 1 && (
              <polyline points={chartPts.slice(0, visible + 1).map(([x, y]) => `${x},${y}`).join(" ")} fill="none" stroke={VIOLET} strokeWidth="2.5" />
            )}
          </svg>
        </div>

        {/* Activity feed */}
        <div style={{ background: "rgba(10,13,20,0.82)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 20, overflow: "hidden" }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 14 }}>Recent Activity</div>
          {[
            { name: "Sync CRM Records",   color: EMERALD, status: "SUCCESS" },
            { name: "Send Invoice Email",  color: EMERALD, status: "SUCCESS" },
            { name: "Process Webhook",     color: ORANGE,  status: "RUNNING" },
            { name: "Daily DB Backup",     color: ROSE,    status: "FAILED"  },
            { name: "Slack Notification",  color: EMERALD, status: "SUCCESS" },
          ].map((item, i) => {
            const ip = spring({ frame: frame - 30 - i * 10, fps, config: { damping: 200, stiffness: 80 } });
            return (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 0", borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.05)" : "none",
                opacity: interpolate(ip, [0, 1], [0, 1]),
                transform: `translateX(${interpolate(ip, [0, 1], [-14, 0])}px)`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: item.color, boxShadow: `0 0 5px ${item.color}` }} />
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>{item.name}</span>
                </div>
                <span style={{ fontSize: 10, color: item.color, fontWeight: 600 }}>{item.status}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right ambient decorative lines */}
      <svg style={{ position: "absolute", inset: 0, pointerEvents: "none" }} viewBox="0 0 1920 1080" width="1920" height="1080">
        <line x1="1100" y1="0" x2="1100" y2="1080" stroke="rgba(255,255,255,0.025)" strokeWidth="1" strokeDasharray="4 8" />
        {[1200, 1400, 1600, 1800].map(x => (
          <line key={x} x1={x} y1="200" x2={x} y2="880" stroke="rgba(124,58,237,0.04)" strokeWidth="1" />
        ))}
      </svg>
    </div>
  );
};
