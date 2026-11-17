"use client";

import { useEffect } from "react";

const LOCK_MS = 8000;

/**
 * Duplicate-submission guard for every form. It blocks a second submit for a
 * short window and fades the buttons. The lock is time-based rather than a
 * permanent `disabled` attribute so a server-action redirect that reuses the
 * DOM can never leave a form stuck. The ledger itself has a durable
 * idempotency key in lib/stock.ts.
 */
export function FormGuard() {
  useEffect(() => {
    function onSubmit(event: Event) {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;

      const started = Number(form.dataset.submittingSince ?? 0);
      if (started && Date.now() - started < LOCK_MS) {
        event.preventDefault();
        return;
      }

      form.dataset.submittingSince = String(Date.now());
      form.setAttribute("aria-busy", "true");

      const buttons = form.querySelectorAll<HTMLButtonElement>('button[type="submit"]');
      for (const button of buttons) {
        button.classList.add("pointer-events-none", "opacity-60");
      }

      window.setTimeout(() => {
        delete form.dataset.submittingSince;
        form.removeAttribute("aria-busy");
        for (const button of buttons) {
          button.classList.remove("pointer-events-none", "opacity-60");
        }
      }, LOCK_MS);
    }

    document.addEventListener("submit", onSubmit, true);
    return () => document.removeEventListener("submit", onSubmit, true);
  }, []);

  return null;
}
