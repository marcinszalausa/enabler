"use client";

import { useEffect, useState } from "react";

const compact = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

// A number that keeps climbing, like likes on a post going viral.
export function Ticker({
  start,
  step = 37,
  every = 900,
}: {
  start: number;
  step?: number;
  every?: number;
}) {
  const [value, setValue] = useState(start);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(
      () => setValue((v) => v + Math.ceil(Math.random() * step)),
      every,
    );
    return () => clearInterval(id);
  }, [step, every]);

  return <span className="tabular-nums">{compact.format(value)}</span>;
}
