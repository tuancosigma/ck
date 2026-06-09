"use client";

// Global smooth-scroll provider (Lenis) wired to GSAP ScrollTrigger, plus a
// colourful scroll-progress bar pinned to the top of the viewport.

import { ReactLenis, useLenis } from "lenis/react";
import { useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  // Keep GSAP triggers in sync with Lenis and track scroll progress (0..1).
  useLenis((lenis) => {
    setProgress(lenis.progress || 0);
    ScrollTrigger.update();
  });

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]">
      <div
        className="h-full origin-left bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-cyan-400 shadow-[0_0_12px_rgba(168,85,247,0.7)]"
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  );
}

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  return (
    <ReactLenis
      root
      options={{ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1, touchMultiplier: 1.5 }}
    >
      <ScrollProgress />
      {children}
    </ReactLenis>
  );
}
