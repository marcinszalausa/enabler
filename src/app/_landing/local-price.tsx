"use client";

import { useEffect, useState } from "react";
import { fmt } from "@/i18n/format";

type Fx = { currency: string; rate: number } | null;

// One request per page, shared by every price on it.
let fx: Promise<Fx> | undefined;
function loadFx() {
  fx ??= fetch("/api/fx")
    .then((res) => (res.ok ? (res.json() as Promise<Fx>) : null))
    .catch(() => null);
  return fx;
}

// Stripe's rate at checkout includes a 2–4% conversion fee.
const CHECKOUT_FEE = 1.03;

// "about 118 zł" beside a dollar price, for visitors outside the US. Shows
// nothing until the rate arrives, or where we have none.
export function LocalPrice({
  usd,
  locale,
  template,
  className,
}: {
  usd: number;
  locale: string;
  // Worded with a {price} placeholder, e.g. "about {price}".
  template: string;
  className?: string;
}) {
  const [rate, setRate] = useState<Fx>(null);
  useEffect(() => {
    let live = true;
    loadFx().then((value) => live && setRate(value));
    return () => {
      live = false;
    };
  }, []);
  if (!rate || rate.currency === "USD" || usd <= 0) return null;

  const price = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: rate.currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  }).format(roughly(usd * rate.rate * CHECKOUT_FEE));
  return <span className={className}>{fmt(template, { price })}</span>;
}

// Three significant digits: 118, 4,410, 470,000.
function roughly(value: number) {
  if (value < 1000) return Math.round(value);
  const step = 10 ** (Math.floor(Math.log10(value)) - 2);
  return Math.round(value / step) * step;
}
