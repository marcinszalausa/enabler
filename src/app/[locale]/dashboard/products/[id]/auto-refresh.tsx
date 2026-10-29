"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-renders the page every few seconds while a generation is running.
// Video runs also need a nudge to collect clips the video model finished.
export function AutoRefresh({
  active,
  videoRuns = [],
}: {
  active: boolean;
  videoRuns?: string[];
}) {
  const router = useRouter();
  const runs = videoRuns.join(",");
  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function tick() {
      await Promise.all(
        runs
          .split(",")
          .filter(Boolean)
          .map((id) =>
            fetch(`/api/generations/${id}/advance`, { method: "POST" }).catch(
              () => null,
            ),
          ),
      );
      if (stopped) return;
      router.refresh();
      timer = setTimeout(tick, 4000);
    }
    timer = setTimeout(tick, 4000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [active, runs, router]);
  return null;
}
