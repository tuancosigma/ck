"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/utils/api";
import {
  Lock,
  Mail,
  User,
  ShieldAlert,
  Cpu,
  Sparkles,
  ArrowRight,
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
} from "lucide-react";
import { gsap } from "gsap";
import Lenis from "@studio-freight/lenis";

export default function LoginPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [audioMuted, setAudioMuted] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const formCardRef = useRef<HTMLDivElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  const toggleAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    gsap.killTweensOf(audio);
    if (audioMuted) {
      audio.volume = 0;
      audio.play().catch(() => {});
      gsap.to(audio, { volume: 0.45, duration: 1.2, ease: "power2.out" });
      setAudioMuted(false);
    } else {
      gsap.to(audio, {
        volume: 0,
        duration: 0.8,
        ease: "power2.in",
        onComplete: () => audio.pause(),
      });
      setAudioMuted(true);
    }
  }, [audioMuted]);

  useEffect(() => {
    const lenis = new Lenis({ duration: 1.2 });
    const raf = (time: number) => { lenis.raf(time); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);

    const ctx = gsap.context(() => {
      // Video: fade in từ 0 → full opacity (màu tự nhiên)
      if (videoRef.current) {
        videoRef.current.muted = true;
        videoRef.current.play().catch(() => { });
        gsap.set(videoRef.current, { opacity: 0 });
        gsap.to(videoRef.current, { opacity: 1, duration: 2, delay: 0.2, ease: "power2.inOut" });
      }

      // Left panel slide từ trái
      gsap.set(leftPanelRef.current, { x: -50, opacity: 0 });
      gsap.to(leftPanelRef.current, { x: 0, opacity: 1, duration: 1.0, delay: 0.3, ease: "power3.out" });

      // Right panel slide từ phải
      gsap.set(rightPanelRef.current, { x: 50, opacity: 0 });
      gsap.to(rightPanelRef.current, { x: 0, opacity: 1, duration: 1.0, delay: 0.4, ease: "power3.out" });

      // Brand drop-in
      gsap.set(brandRef.current, { y: -20, opacity: 0 });
      gsap.to(brandRef.current, { y: 0, opacity: 1, duration: 0.7, delay: 0.7, ease: "power3.out" });

      // Form card spring-in
      gsap.set(formCardRef.current, { y: 30, opacity: 0, scale: 0.96 });
      gsap.to(formCardRef.current, { y: 0, opacity: 1, scale: 1, duration: 0.9, delay: 0.85, ease: "back.out(1.4)" });
    }, containerRef);

    const audio = audioRef.current;
    if (audio) { audio.volume = 0; audio.loop = true; }

    return () => {
      lenis.destroy();
      ctx.revert();
      if (audio) {
        audio.pause();
        gsap.killTweensOf(audio);
      }
    };
  }, []);



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isRegister) {
        const res = await api.auth.register({ email, password, name });
        localStorage.setItem("token", res.token);
      } else {
        const res = await api.auth.login({ email, password });
        localStorage.setItem("token", res.token);
      }
      gsap.to(containerRef.current, {
        opacity: 0, duration: 0.45, ease: "power2.in",
        onComplete: () => router.push("/workflows"),
      });
    } catch (err: any) {
      setError(err.message || "Failed to authenticate.");
      gsap.fromTo(formCardRef.current, { x: -10 }, { x: 0, duration: 0.5, ease: "elastic.out(1,0.3)" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      ref={containerRef}
      className="min-h-screen flex overflow-hidden select-none bg-[#080c14] relative"
    >
      {/* Hidden ambient audio */}
      <audio ref={audioRef} src="/ambient-login.wav" preload="auto" />

      {/* Video nền toàn màn hình - nhích sang phải 40 (160px) để tránh dính lề trái */}
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 left-40 w-full h-full object-cover pointer-events-none z-0"
        style={{ opacity: 0 }}
      >
        <source src="/video.mp4" type="video/mp4" />
      </video>

      {/* ══════════════════════════════════════
          LEFT — Video tự nhiên full màu
      ══════════════════════════════════════ */}
      <div ref={leftPanelRef} className="hidden lg:block flex-1 relative overflow-hidden z-10 bg-transparent">

        {/* Chỉ dark edge ở phía phải để blending với panel form — không che màu video */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(to right, transparent 55%, rgba(8,12,20,0.85) 100%)",
          }}
        />
        {/* Top/bottom vignette nhẹ */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(to bottom, rgba(8,12,20,0.4) 0%, transparent 20%, transparent 80%, rgba(8,12,20,0.5) 100%)",
          }}
        />

        {/* Branding + copy overlay trên video */}
        <div className="relative z-10 h-full flex flex-col justify-between p-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-orange-400 flex items-center justify-center shadow-lg shadow-primary/40">
                <Cpu className="w-5 h-5 text-white" />
              </div>
              <span className="text-white font-black text-lg tracking-tight drop-shadow-lg">F-GUARD</span>
            </div>
            <button
              onClick={toggleAudio}
              title={audioMuted ? "Enable ambient sound" : "Mute ambient sound"}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
              style={{
                background: audioMuted ? "rgba(255,255,255,0.07)" : "rgba(242,94,34,0.18)",
                border: audioMuted ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(242,94,34,0.4)",
                boxShadow: audioMuted ? "none" : "0 0 12px rgba(242,94,34,0.25)",
              }}
            >
              {audioMuted
                ? <VolumeX className="w-3.5 h-3.5 text-white/40" />
                : <Volume2 className="w-3.5 h-3.5 text-primary" />
              }
            </button>
          </div>

          {/* Bottom headline */}
          <div className="space-y-3 max-w-xs">
            <div className="inline-flex items-center gap-1.5 bg-white/10 border border-white/15 rounded-full px-3 py-1 backdrop-blur-sm">
              <Sparkles className="w-3 h-3 text-primary" />
              <span className="text-[9px] font-bold text-white/80 uppercase tracking-widest">AI-Powered Automation</span>
            </div>
            <h1 className="text-3xl font-black text-white leading-tight drop-shadow-xl">
              Orchestrate your<br />
              <span className="bg-gradient-to-r from-primary via-orange-400 to-yellow-300 bg-clip-text text-transparent">
                digital workflows
              </span>
            </h1>
            <p className="text-white/60 text-sm leading-relaxed">
              Build powerful visual pipelines and automate any process without a single line of code.
            </p>
            <div className="flex flex-col gap-1.5 pt-1">
              {["Visual drag-and-drop builder", "500+ node integrations", "Real-time execution monitor"].map((f) => (
                <div key={f} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span className="text-white/70 text-xs font-medium">{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════
          RIGHT — Auth form panel
      ══════════════════════════════════════ */}
      <div
        ref={rightPanelRef}
        className="w-full lg:w-[460px] xl:w-[500px] flex-shrink-0 flex flex-col items-center justify-center relative px-8 py-12 z-10"
        style={{ background: "rgba(8,12,20,0.97)" }}
      >
        {/* Subtle ambient glow */}
        <div className="absolute top-[-10%] right-[-10%] w-72 h-72 rounded-full bg-primary/6 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-72 h-72 rounded-full bg-indigo-600/5 blur-[100px] pointer-events-none" />

        <div className="w-full max-w-[340px] relative z-10">

          {/* Brand header */}
          <div ref={brandRef} className="flex flex-col items-center gap-2 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary to-orange-400 flex items-center justify-center shadow-2xl shadow-primary/35 hover:scale-105 active:scale-95 transition-transform duration-200 lg:hidden">
              <Cpu className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              {isRegister ? "Create account" : "Welcome back"}
            </h2>
            <p className="text-slate-500 text-[11px] font-medium text-center">
              {isRegister
                ? "Start building serverless visual workflows"
                : "Sign in to your F-GUARD workspace"}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-300 rounded-xl p-3.5 text-xs flex items-center gap-2.5 mb-5">
              <ShieldAlert className="w-4 h-4 flex-shrink-0 text-red-400" />
              <span className="font-semibold">{error}</span>
            </div>
          )}

          {/* Glass form card */}
          <div
            ref={formCardRef}
            className="rounded-2xl border border-white/[0.08] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
            style={{
              background: "rgba(255,255,255,0.03)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
          >
            {/* Tab switcher */}
            <div className="flex bg-white/[0.04] border border-white/[0.07] rounded-xl p-0.5 mb-5">
              {["Sign In", "Sign Up"].map((tab, i) => (
                <button
                  key={tab}
                  onClick={() => { setIsRegister(i === 1); setError(""); }}
                  className={`flex-1 py-1.5 text-[11px] font-bold rounded-[10px] transition-all duration-200 ${(i === 0) === !isRegister
                      ? "bg-primary text-white shadow-md shadow-primary/25"
                      : "text-slate-500 hover:text-white"
                    }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {isRegister && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="John Doe"
                      className="w-full bg-white/[0.05] border border-white/[0.08] hover:border-white/[0.16] focus:border-primary/60 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-slate-600 font-medium"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full bg-white/[0.05] border border-white/[0.08] hover:border-white/[0.16] focus:border-primary/60 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-slate-600 font-medium"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Password
                  </label>
                  {!isRegister && (
                    <button type="button" className="text-[10px] text-primary/60 hover:text-primary font-bold transition-colors">
                      Forgot?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white/[0.05] border border-white/[0.08] hover:border-white/[0.16] focus:border-primary/60 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-slate-600 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                id="login-submit-btn"
                className="w-full mt-1 bg-gradient-to-r from-primary to-orange-500 hover:from-primary/90 hover:to-orange-400 text-white font-bold rounded-xl py-2.5 text-[11px] shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all disabled:opacity-50 disabled:pointer-events-none uppercase tracking-wider flex items-center justify-center gap-2 group"
              >
                {loading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    {isRegister ? "Create Account" : "Sign In"}
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-[10px] text-slate-600 font-medium">
            By continuing you agree to our{" "}
            <span className="text-slate-500 hover:text-slate-300 cursor-pointer transition-colors">Terms</span>{" "}
            &{" "}
            <span className="text-slate-500 hover:text-slate-300 cursor-pointer transition-colors">Privacy Policy</span>
          </p>
        </div>
      </div>
    </main>
  );
}
