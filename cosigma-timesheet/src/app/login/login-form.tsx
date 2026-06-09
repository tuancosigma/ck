"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { FloatingInput } from "@/components/login/floating-input";
import {
  MorphSubmitButton,
  type SubmitState,
} from "@/components/login/morph-submit-button";

// Each demo role maps to a distinct accent glow that the card morphs toward
// when the role chip is hovered or selected.
const DEMO = [
  { label: "Admin", email: "admin@cosigma.com", glow: "rgba(147,51,234,0.45)", ring: "#a855f7" },
  { label: "Manager", email: "manager@cosigma.com", glow: "rgba(16,185,129,0.45)", ring: "#10b981" },
  { label: "Employee", email: "employee@cosigma.com", glow: "rgba(34,211,238,0.45)", ring: "#22d3ee" },
];

const DEFAULT_GLOW = "rgba(99,102,241,0.08)";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("employee@cosigma.com");
  const [password, setPassword] = useState("Password123!");
  const [error, setError] = useState("");
  const [state, setState] = useState<SubmitState>("idle");
  const [glow, setGlow] = useState(DEFAULT_GLOW);

  // Active role derived from the current email -> drives the persistent glow.
  const activeRole = DEMO.find((d) => d.email === email);
  const effectiveGlow = glow !== DEFAULT_GLOW ? glow : activeRole?.glow ?? DEFAULT_GLOW;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state !== "idle") return;
    setError("");
    setState("loading");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (res.ok) {
      setState("success");
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 850);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Login failed.");
      setState("idle");
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative z-10 w-full max-w-md"
    >
      <div className="mb-8 flex flex-col items-center text-center">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 13, delay: 0.1 }}
          className="logo-ring relative mb-5"
        >
          <Image
            src="/brand/cosigma-logo-transparent.png"
            alt="Cosigma logo"
            width={88}
            height={88}
            priority
            className="drop-shadow-[0_0_18px_rgba(168,85,247,0.5)]"
          />
        </motion.div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-50">
          <span className="gradient-text">Cosigma</span> Timesheet
        </h1>
        <p className="mt-2 text-sm font-light tracking-wide text-slate-300/80">
          Premium time tracking &amp; onsite compliance
        </p>
      </div>

      {/* Glassmorphic card with role-reactive accent glow */}
      <motion.div
        animate={{ boxShadow: `0 0 50px ${effectiveGlow}` }}
        transition={{ type: "spring", stiffness: 120, damping: 20 }}
        className="rounded-2xl border border-white/10 bg-slate-900/60 p-7 backdrop-blur-2xl"
      >
        <form onSubmit={submit} className="space-y-5">
          <FloatingInput label="Email" type="email" value={email} onChange={setEmail} required />
          <FloatingInput label="Password" type="password" value={password} onChange={setPassword} required />

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300"
            >
              {error}
            </motion.p>
          )}

          <MorphSubmitButton state={state} />
        </form>

        <div className="mt-6 border-t border-white/5 pt-4">
          <p className="mb-2 text-center text-xs uppercase tracking-wide text-slate-500">
            Demo accounts
          </p>
          <div className="flex gap-2">
            {DEMO.map((d) => {
              const selected = d.email === email;
              return (
                <motion.button
                  key={d.email}
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.96 }}
                  onMouseEnter={() => setGlow(d.glow)}
                  onMouseLeave={() => setGlow(DEFAULT_GLOW)}
                  onClick={() => setEmail(d.email)}
                  animate={{
                    borderColor: selected ? d.ring : "rgba(255,255,255,0.1)",
                    color: selected ? "#fff" : "#cbd5e1",
                  }}
                  className="flex-1 rounded-lg border bg-white/5 px-2 py-1.5 text-xs"
                  style={{ boxShadow: selected ? `0 0 16px ${d.glow}` : "none" }}
                >
                  {d.label}
                </motion.button>
              );
            })}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
