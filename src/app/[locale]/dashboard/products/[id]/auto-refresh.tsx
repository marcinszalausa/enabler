"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";

// Polling only collects existing jobs; it never starts a paid generation.
export function AutoRefresh({ active, videoRuns = [] }: { active: boolean; videoRuns?: string[] }) {
  const router = useRouter();
  const { t } = useI18n();
  const runs = videoRuns.join(",");
  const [connection, setConnection] = useState<"auto" | "offline" | "retrying">("auto");
  const [checking, setChecking] = useState(false);
  const check = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!active) return;
    let stopped = false, inFlight = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | null = null;
    const schedule = () => { if (!stopped) timer = setTimeout(tick, 4000); };
    async function tick() {
      if (stopped || inFlight) return;
      clearTimeout(timer);
      if (!navigator.onLine) { setConnection("offline"); schedule(); return; }
      if (document.hidden) { schedule(); return; }
      inFlight = true; setChecking(true);
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 30000);
      try {
        const responses = await Promise.all(runs.split(",").filter(Boolean).map(id =>
          fetch("/api/generations/" + id + "/advance", { method: "POST", signal: controller!.signal }),
        ));
        if (responses.some(r => !r.ok)) throw new Error("Progress check failed");
        if (!stopped) { setConnection("auto"); router.refresh(); }
      } catch {
        controller.abort();
        if (!stopped) { setConnection(navigator.onLine ? "retrying" : "offline"); router.refresh(); }
      } finally {
        clearTimeout(timeout);
        inFlight = false;
        if (!stopped) { setChecking(false); schedule(); }
      }
    }
    const resume = () => { if (!document.hidden) void tick(); };
    const offline = () => setConnection("offline");
    check.current = () => { void tick(); };
    addEventListener("online", resume); addEventListener("offline", offline);
    document.addEventListener("visibilitychange", resume);
    schedule();
    return () => {
      stopped = true; check.current = null; clearTimeout(timer); controller?.abort();
      removeEventListener("online", resume); removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [active, runs, router]);
  if (!active) return null;
  return <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm">
    <p role="status" className={connection === "auto" ? "text-muted" : "text-warn"}>{t.run[connection]}</p>
    <button type="button" disabled={checking} onClick={() => check.current?.()}
      className="min-h-11 rounded-lg border border-line-strong bg-raised px-3 font-medium hover:border-accent disabled:opacity-60">
      {checking ? t.app.loading : t.run.check}
    </button>
  </div>;
}
