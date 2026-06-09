import React from "react";
import { Sequence, staticFile, interpolate } from "remotion";
import { Audio } from "@remotion/media";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { SceneLoginHero } from "./scenes/scene-login-hero";
import { SceneDashboardKpi } from "./scenes/scene-dashboard-kpi";
import { SceneWorkflowCanvas } from "./scenes/scene-workflow-canvas";
import { SceneExecutionTrace } from "./scenes/scene-execution-trace";
import { SceneCredentialsCta } from "./scenes/scene-credentials-cta";

// Root timeline (30fps, 900 frames = 30s):
//
//  Scene 1  Login Hero     frames   0 – 220  (7.3s)
//  T1 fade                 frames 200 – 220  (overlap 20)
//  Scene 2  Dashboard KPI  frames 200 – 390  (6.3s)
//  T2 slide-right          frames 370 – 390  (overlap 20)
//  Scene 3  Workflow        frames 370 – 550  (6s)
//  T3 wipe-left            frames 530 – 550  (overlap 20)
//  Scene 4  Execution       frames 530 – 710  (6s)
//  T4 fade                 frames 690 – 710  (overlap 20)
//  Scene 5  Credentials CTA frames 690 – 900  (7s)

// KPI counter frames (root coords):
//   Card 0: 200+20=220 → 200+70=270   mid≈245
//   Card 1: 200+28=228 → 200+78=278   mid≈253
//   Card 2: 200+36=236 → 200+86=286   mid≈261
//   Card 3: 200+44=244 → 200+94=294   mid≈269
// Spread ticks evenly across 220–295

const KPI_TICKS = Array.from({ length: 20 }, (_, i) => 220 + i * 4); // every 4 frames

// JSON typing frames (scene 4 local 30+4*i → root 530+30+4*i = 560+4*i)
const JSON_TYPE_FRAMES = [
  ...Array.from({ length: 8 }, (_, i) => 560 + i * 4),  // input block
  ...Array.from({ length: 9 }, (_, i) => 595 + i * 4),  // output block
];

// Node click frames (scene 3: edges appear at local 10+i*8 → root 370+10+i*8)
const NODE_CLICKS = Array.from({ length: 8 }, (_, i) => 380 + i * 8);

export const FGuardPromo: React.FC = () => {
  return (
    <>
      {/* ── Ambient pad — plays entire 30s, fades in/out in the WAV itself ── */}
      <Audio
        src={staticFile("ambient.wav")}
        volume={(f) => interpolate(f, [0, 15, 870, 900], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
      />

      {/* ── Scene 1: Brand reveal ────────────────────────────────────────── */}
      <Sequence from={8} layout="none">
        <Audio src={staticFile("reveal.wav")} volume={0.6} />
      </Sequence>

      {/* ── Transition 1 → Dashboard ────────────────────────────────────── */}
      <Sequence from={198} layout="none">
        <Audio src={staticFile("transition.wav")} volume={0.5} />
      </Sequence>

      {/* ── Scene 2: KPI counter ticks ──────────────────────────────────── */}
      {KPI_TICKS.map((f) => (
        <Sequence key={`tick-${f}`} from={f} layout="none">
          <Audio src={staticFile("tick.wav")} volume={0.22} />
        </Sequence>
      ))}

      {/* ── Transition 2 → Workflow Canvas ──────────────────────────────── */}
      <Sequence from={368} layout="none">
        <Audio src={staticFile("transition.wav")} volume={0.5} />
      </Sequence>

      {/* ── Scene 3: Node connection clicks ─────────────────────────────── */}
      {NODE_CLICKS.map((f) => (
        <Sequence key={`click-${f}`} from={f} layout="none">
          <Audio src={staticFile("click.wav")} volume={0.28} />
        </Sequence>
      ))}

      {/* ── Transition 3 → Execution Trace ──────────────────────────────── */}
      <Sequence from={528} layout="none">
        <Audio src={staticFile("transition.wav")} volume={0.5} />
      </Sequence>

      {/* ── Scene 4: Execution step success chimes ──────────────────────── */}
      <Sequence from={542} layout="none">
        <Audio src={staticFile("success.wav")} volume={0.38} />
      </Sequence>
      <Sequence from={556} layout="none">
        <Audio src={staticFile("success.wav")} volume={0.32} />
      </Sequence>
      <Sequence from={570} layout="none">
        <Audio src={staticFile("success.wav")} volume={0.27} />
      </Sequence>

      {/* ── Scene 4: JSON typing sounds ─────────────────────────────────── */}
      {JSON_TYPE_FRAMES.map((f) => (
        <Sequence key={`type-${f}`} from={f} layout="none">
          <Audio src={staticFile("type.wav")} volume={0.18} />
        </Sequence>
      ))}

      {/* ── Transition 4 → Credentials CTA ──────────────────────────────── */}
      <Sequence from={688} layout="none">
        <Audio src={staticFile("transition.wav")} volume={0.55} />
      </Sequence>

      {/* ── Scene 5: CTA chord entrance ─────────────────────────────────── */}
      <Sequence from={718} layout="none">
        <Audio src={staticFile("accent.wav")} volume={0.6} />
      </Sequence>

      {/* ── Video scenes ────────────────────────────────────────────────── */}
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={220}>
          <SceneLoginHero />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 20 })}
        />

        <TransitionSeries.Sequence durationInFrames={190}>
          <SceneDashboardKpi />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={linearTiming({ durationInFrames: 20 })}
        />

        <TransitionSeries.Sequence durationInFrames={180}>
          <SceneWorkflowCanvas />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={wipe({ direction: "from-left" })}
          timing={linearTiming({ durationInFrames: 20 })}
        />

        <TransitionSeries.Sequence durationInFrames={180}>
          <SceneExecutionTrace />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 20 })}
        />

        <TransitionSeries.Sequence durationInFrames={210}>
          <SceneCredentialsCta />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </>
  );
};
