"use client";

import { useEffect, useState, type RefObject } from "react";
type Connection = EventTarget & { saveData?: boolean };

// No media sources are attached until the phone is near the viewport.
// Playback additionally waits for load/idle, a visible tab, and user policy.
export function useMediaActivity<T extends Element>(root: RefObject<T | null>) {
  const [nearby, setNearby] = useState(false);
  const [visible, setVisible] = useState(false);
  const [idle, setIdle] = useState(false);
  const [foreground, setForeground] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [saveData, setSaveData] = useState(false);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const connection = (navigator as Navigator & { connection?: Connection }).connection;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const preferences = () => { setReducedMotion(motion.matches); setSaveData(Boolean(connection?.saveData)); };
    const visibility = () => setForeground(document.visibilityState !== "hidden");
    queueMicrotask(preferences);
    queueMicrotask(visibility);
    motion.addEventListener("change", preferences);
    connection?.addEventListener("change", preferences);
    document.addEventListener("visibilitychange", visibility);
    const near = new IntersectionObserver(([entry]) => setNearby(entry.isIntersecting), { rootMargin: "300px 0px" });
    const inView = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting && entry.intersectionRatio >= 0.25), { threshold: [0,0.25] });
    near.observe(element);
    inView.observe(element);
    let idleId: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const loaded = () => {
      if ("requestIdleCallback" in window) idleId = window.requestIdleCallback(() => setIdle(true), { timeout: 2000 });
      else timer = setTimeout(() => setIdle(true), 600);
    };
    if (document.readyState === "complete") loaded();
    else window.addEventListener("load", loaded, { once: true });
    return () => {
      near.disconnect(); inView.disconnect();
      motion.removeEventListener("change", preferences);
      connection?.removeEventListener("change", preferences);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("load", loaded);
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [root]);
  return { nearby, idle, reducedMotion, restricted: reducedMotion || saveData, inView: visible && foreground, active: visible && idle && foreground };
}
