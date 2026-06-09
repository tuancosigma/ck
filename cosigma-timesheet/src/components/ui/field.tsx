"use client";

// Styled form primitives with the pulsing indigo focus glow.

import { cn } from "@/lib/cn";

const base =
  "w-full rounded-xl bg-slate-950/50 border border-white/10 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 input-glow transition-colors";

export function Input(
  props: React.InputHTMLAttributes<HTMLInputElement> & { className?: string }
) {
  const { className, ...rest } = props;
  return <input className={cn(base, className)} {...rest} />;
}

export function Textarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    className?: string;
  }
) {
  const { className, ...rest } = props;
  return <textarea className={cn(base, "resize-none", className)} {...rest} />;
}

export function Select(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & { className?: string }
) {
  const { className, children, ...rest } = props;
  return (
    <select className={cn(base, "appearance-none cursor-pointer", className)} {...rest}>
      {children}
    </select>
  );
}

export function Label({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400",
        className
      )}
    >
      {children}
    </label>
  );
}
