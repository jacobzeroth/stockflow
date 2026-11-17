"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copy order" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" onClick={copy} className="btn-ghost btn-sm">
      {copied ? "Copied ✓" : label}
    </button>
  );
}
