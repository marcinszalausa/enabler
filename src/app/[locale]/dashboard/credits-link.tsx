import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";
import { fmt } from "@/i18n/format";
import { createClient } from "@/lib/supabase/server";

// Below this, the balance turns amber: about one more image run.
export const LOW_CREDITS = 20;

// The credit balance, always in the top bar. Opens the wallet on the Billing
// page, where credits can be topped up.
export async function CreditsLink({
  locale,
  className = "",
}: {
  locale: Locale;
  className?: string;
}) {
  const supabase = await createClient();
  const { data: ws } = await supabase
    .from("workspaces")
    .select("credits")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!ws) return null;
  const t = await getMessages(locale);
  const number = ws.credits.toLocaleString(locale);
  return (
    <CreditsView
      credits={ws.credits}
      number={number}
      label={fmt(t.app.credits, { count: number })}
      low={ws.credits < LOW_CREDITS}
      lowLabel={t.billing.lowCredits}
      className={className}
    />
  );
}

export function CreditsView({
  credits,
  number,
  label,
  low,
  lowLabel,
  className = "",
}: {
  credits: number;
  number: string;
  // Worded, e.g. "240 credits".
  label: string;
  low: boolean;
  lowLabel: string;
  className?: string;
}) {
  const full = low ? `${label} · ${lowLabel}` : label;
  return (
    <Link
      href="/dashboard/billing"
      prefetch={false}
      data-credits-balance={credits}
      title={full}
      aria-label={full}
      className={`${className || "inline-flex"} min-h-11 shrink-0 items-center gap-1 rounded-full px-1.5 text-sm font-medium transition hover:bg-surface sm:gap-1.5 sm:px-2.5 ${
        low ? "text-warn" : ""
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-[18px] w-[18px] shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5v9M9.5 10a2.5 2 0 0 1 2.5-1.5c1.4 0 2.5.7 2.5 1.7S13.4 12 12 12s-2.5.6-2.5 1.8S10.6 15.5 12 15.5a2.5 2 0 0 0 2.5-1.5" />
      </svg>
      <span aria-hidden="true" className="tabular-nums">
        {number}
      </span>
      <span
        aria-hidden="true"
        className="credits-word hidden text-muted md:inline"
      >
        {label.replace(number, "").trim()}
      </span>
    </Link>
  );
}
