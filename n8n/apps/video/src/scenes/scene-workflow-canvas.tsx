import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { GlowOrb, Particles } from "../components/particles";

const ORANGE = "#F25E22";
const VIOLET = "#7C3AED";
const EMERALD = "#10B981";

// All node positions confined to x=60–1060 (1000px wide content area)

type Node = { id: number; x: number; y: number; label: string; sub: string; type: "trigger"|"action"|"condition"|"output"; status: "running"|"done"|"idle" };
type Edge = { from: number; to: number };

const NODES: Node[] = [
  { id: 0, x: 60,  y: 380, label: "Webhook",   sub: "Trigger",    type: "trigger",   status: "done"    },
  { id: 1, x: 280, y: 250, label: "Filter",     sub: "Data",       type: "condition", status: "done"    },
  { id: 2, x: 280, y: 510, label: "Fetch",      sub: "API",        type: "action",    status: "done"    },
  { id: 3, x: 500, y: 380, label: "Transform",  sub: "JSON",       type: "action",    status: "running" },
  { id: 4, x: 720, y: 260, label: "Send",       sub: "Email",      type: "output",    status: "idle"    },
  { id: 5, x: 720, y: 500, label: "Update",     sub: "Database",   type: "output",    status: "idle"    },
  { id: 6, x: 930, y: 380, label: "Slack",      sub: "Notify",     type: "output",    status: "idle"    },
];

const EDGES: Edge[] = [
  { from: 0, to: 1 }, { from: 0, to: 2 },
  { from: 1, to: 3 }, { from: 2, to: 3 },
  { from: 3, to: 4 }, { from: 3, to: 5 },
  { from: 4, to: 6 }, { from: 5, to: 6 },
];

const NODE_COLORS = {
  trigger:   { bg: "#F25E2218", border: ORANGE,   text: ORANGE   },
  action:    { bg: "#7C3AED18", border: VIOLET,   text: VIOLET   },
  condition: { bg: "#60A5FA18", border: "#60A5FA", text: "#60A5FA" },
  output:    { bg: "#10B98118", border: EMERALD,  text: EMERALD  },
};

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

const AnimatedEdge: React.FC<{ from: Node; to: Node; enterFrame: number; color: string }> = ({ from, to, enterFrame, color }) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [enterFrame, enterFrame + 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const x1 = from.x + 120, y1 = from.y + 28;
  const x2 = to.x,         y2 = to.y + 28;
  const mx = (x1 + x2) / 2;
  const ex = lerp(x1, x2, progress), ey = lerp(y1, y2, progress);
  const pt = ((frame - enterFrame) % 36) / 36;
  const px = lerp(lerp(x1, mx, pt), lerp(mx, x2, pt), pt);
  const py = lerp(lerp(y1, y1, pt), lerp(y1, y2, pt), pt);
  const dash = -((frame - enterFrame) * 0.5);
  return (
    <g>
      <path d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${ex},${ey}`} fill="none" stroke={color} strokeWidth="1.8" opacity="0.35" />
      {progress >= 1 && <>
        <path d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} fill="none" stroke={color} strokeWidth="1.8" opacity="0.65" strokeDasharray="5 5" strokeDashoffset={dash} />
        <circle cx={px} cy={py} r="3.5" fill={color} opacity="0.85" />
      </>}
    </g>
  );
};

export const SceneWorkflowCanvas: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeOut = interpolate(frame, [130, 150], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const headerProgress = spring({ frame, fps, config: { damping: 200, stiffness: 80 } });

  return (
    <div style={{ width: 1920, height: 1080, background: "#070a10", overflow: "hidden", position: "relative", opacity: fadeOut, fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" }}>
      {/* Dot grid */}
      <svg style={{ position: "absolute", inset: 0, pointerEvents: "none" }} width="1920" height="1080">
        <defs>
          <pattern id="dots" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="1" fill="rgba(255,255,255,0.055)" />
          </pattern>
        </defs>
        <rect width="1920" height="1080" fill="url(#dots)" />
      </svg>

      <GlowOrb cx={560} cy={490} r={600} color={VIOLET} opacity={0.07} />
      <GlowOrb cx={1500} cy={540} r={400} color={ORANGE} opacity={0.025} />
      <Particles opacity={0.2} />

      {/* Header */}
      <div style={{
        position: "absolute", top: 55, left: 60,
        opacity: interpolate(headerProgress, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(headerProgress, [0, 1], [-14, 0])}px)`,
      }}>
        <div style={{ fontSize: 12, color: VIOLET, letterSpacing: "0.15em", fontWeight: 600, marginBottom: 5 }}>WORKFLOW BUILDER</div>
        <div style={{ fontSize: 36, fontWeight: 800, color: "white" }}>Visual Node Graph Editor</div>
      </div>

      {/* Canvas — x=60 to x=1080 */}
      <div style={{
        position: "absolute", top: 160, left: 60, width: 1020, bottom: 70,
        background: "rgba(7,10,16,0.55)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 18, overflow: "hidden",
      }}>
        <svg width="1020" height="780" viewBox="0 0 1020 780">
          {EDGES.map((edge, i) => {
            const fn = NODES.find(n => n.id === edge.from)!;
            const tn = NODES.find(n => n.id === edge.to)!;
            const c = fn.status === "done" ? EMERALD : fn.status === "running" ? ORANGE : "rgba(255,255,255,0.18)";
            const offset = { x: 0, y: 150 };
            return <AnimatedEdge key={i} from={{ ...fn, y: fn.y - offset.y }} to={{ ...tn, y: tn.y - offset.y }} enterFrame={10 + i * 8} color={c} />;
          })}

          {NODES.map((node, i) => {
            const np = spring({ frame: frame - i * 6, fps, config: { damping: 120, stiffness: 70 } });
            const colors = NODE_COLORS[node.type];
            const isRunning = node.status === "running";
            const glow = isRunning ? 0.3 + Math.sin(frame * 0.15) * 0.2 : 0;
            const ny = node.y - 150;
            return (
              <g key={node.id} transform={`translate(${node.x + 60},${ny + 28}) scale(${interpolate(np, [0, 1], [0.6, 1])}) translate(${-(node.x + 60)},${-(ny + 28)})`} opacity={interpolate(np, [0, 1], [0, 1])}>
                {isRunning && <rect x={node.x - 3} y={ny - 3} width={126} height={62} rx={12} fill="none" stroke={ORANGE} strokeWidth="2" opacity={glow} />}
                <rect x={node.x} y={ny} width={120} height={56} rx={9} fill={colors.bg} stroke={colors.border} strokeWidth={isRunning ? 2 : 1} strokeOpacity={isRunning ? 1 : 0.45} />
                <circle cx={node.x + 106} cy={ny + 11} r={4.5}
                  fill={node.status === "done" ? EMERALD : node.status === "running" ? ORANGE : "rgba(255,255,255,0.18)"}
                  opacity={isRunning ? 0.6 + Math.sin(frame * 0.2) * 0.4 : 1}
                />
                <text x={node.x + 12} y={ny + 24} fontSize="12" fontWeight="600" fill={colors.text} fontFamily="Inter,system-ui,sans-serif">{node.label}</text>
                <text x={node.x + 12} y={ny + 40} fontSize="10" fill="rgba(255,255,255,0.38)" fontFamily="Inter,system-ui,sans-serif">{node.sub}</text>
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div style={{
          position: "absolute", bottom: 16, right: 20, display: "flex", gap: 18,
          opacity: interpolate(frame, [40, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}>
          {[{ color: EMERALD, label: "Completed" }, { color: ORANGE, label: "Running" }, { color: "rgba(255,255,255,0.18)", label: "Pending" }].map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: item.color }} />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right ambient decoration */}
      <svg style={{ position: "absolute", inset: 0, pointerEvents: "none" }} viewBox="0 0 1920 1080" width="1920" height="1080">
        <line x1="1100" y1="0" x2="1100" y2="1080" stroke="rgba(255,255,255,0.02)" strokeWidth="1" strokeDasharray="4 10" />
        {Array.from({ length: 5 }, (_, i) => (
          <circle key={i} cx={1250 + i * 120} cy={540} r={80 + i * 20} fill="none" stroke="rgba(124,58,237,0.03)" strokeWidth="1" />
        ))}
      </svg>
    </div>
  );
};
