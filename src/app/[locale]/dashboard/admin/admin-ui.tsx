import type { ReactNode } from "react";

// Pieces shared by the admin pages. Admin pages are staff-only and in English.

export const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n < 100 ? 2 : 0 });
export const num = (n: number) => n.toLocaleString("en-US");
export const day = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "Never";
export const when = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC" : "Never";

export function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-raised p-4">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">{value}</dd>
      {note && <dd className="mt-1 text-xs text-muted">{note}</dd>}
    </div>
  );
}

export function Section({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section className="edge mt-6 min-w-0 p-5">
      <h2 className="font-semibold">{title}</h2>
      {note && <p className="mt-1 text-sm text-muted">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

// Daily counts as a small column chart. Every day keeps its column, so a
// quiet day reads as zero rather than disappearing.
export function DayBars({ label, days }: { label: string; days: { day: string; count: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((s, d) => s + d.count, 0);
  return (
    <figure>
      <figcaption className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted tabular-nums">{num(total)} in 30 days</span>
      </figcaption>
      <div className="mt-3 flex h-28 items-end gap-[3px]" role="img" aria-label={`${label}: ${days.map((d) => `${d.day} ${d.count}`).join(", ")}`}>
        {days.map((d) => (
          <div key={d.day} className="group relative flex h-full flex-1 items-end" title={`${day(d.day)}: ${d.count}`}>
            <div
              className={`w-full rounded-t-[3px] ${d.count ? "bg-accent" : "bg-line"}`}
              style={{ height: d.count ? `${Math.max(6, (d.count / max) * 100)}%` : "2px" }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted">
        <span>{day(days[0]?.day)}</span>
        <span>Today</span>
      </div>
    </figure>
  );
}

const tone: Record<string, string> = {
  succeeded: "bg-ok-bg text-ok",
  published: "bg-ok-bg text-ok",
  partial: "bg-warn-bg text-warn",
  running: "bg-accent-soft text-accent",
  queued: "bg-accent-soft text-accent",
  scheduled: "bg-accent-soft text-accent",
  publishing: "bg-accent-soft text-accent",
  failed: "bg-danger-bg text-danger",
  cancelled: "bg-surface text-muted",
};

export function Status({ value }: { value: string }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${tone[value] ?? "bg-surface text-muted"}`}>{value}</span>;
}

export function PlanChip({ label, paid }: { label: string; paid: boolean }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${paid ? "bg-accent text-accent-fg" : "bg-accent-soft text-accent"}`}>
      {label}
    </span>
  );
}

// A table that scrolls sideways on phones instead of widening the page.
export function Table({ head, children, empty, wide }: { head: string[]; children: ReactNode; empty?: boolean; wide?: boolean }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className={`w-full text-start text-sm ${wide ? "min-w-[44rem]" : "min-w-[20rem]"}`}>
        <thead>
          <tr className="border-b border-line text-xs text-muted">
            {head.map((h, i) => (
              <th key={h} scope="col" className={`py-2 pe-3 font-medium ${i ? "text-end" : "text-start"}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
      {empty && <p className="py-6 text-center text-sm text-muted">Nothing here yet.</p>}
    </div>
  );
}

export const cell = "py-2.5 pe-3 text-end tabular-nums whitespace-nowrap";
export const firstCell = "py-2.5 pe-3 text-start";
