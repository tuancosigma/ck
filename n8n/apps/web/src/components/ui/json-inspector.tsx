"use client";

import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check } from "lucide-react";

const PANEL_STYLE: React.CSSProperties = {
  background: "rgba(10,13,20,0.9)",
  borderRadius: "10px",
  fontSize: "11px",
  lineHeight: "1.65",
  padding: "14px 16px",
  border: "1px solid rgba(255,255,255,0.06)",
  margin: 0,
};

interface JsonInspectorProps {
  data: unknown;
  label?: string;
  maxHeight?: string;
}

export function JsonInspector({ data, label, maxHeight = "200px" }: JsonInspectorProps) {
  const [copied, setCopied] = useState(false);
  const text = JSON.stringify(data, null, 2);

  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="relative">
      {label && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</span>
          <button
            onClick={copy}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold
                       border border-border/60 hover:border-border bg-white/[0.03] hover:bg-white/[0.06]
                       text-slate-400 hover:text-white transition-all duration-150"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}
      <div style={{ maxHeight, overflowY: "auto" }} className="rounded-[10px]">
        <SyntaxHighlighter
          language="json"
          style={vscDarkPlus}
          customStyle={PANEL_STYLE}
          wrapLongLines
        >
          {text}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
