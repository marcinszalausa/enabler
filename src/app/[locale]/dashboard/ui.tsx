import type { ReactNode } from "react";
import Link from "next/link";

// Small pieces shared by the dashboard pages, in the same style as the site.

export function BackLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-raised px-3 py-1 text-sm text-muted transition hover:border-line-strong hover:text-fg"
    >
      <span aria-hidden>←</span>
      {children}
    </Link>
  );
}

export function CreditsBadge({
  credits,
  plan,
}: {
  // Already worded, e.g. "40 credits" and "· free plan".
  credits: string;
  plan?: string;
}) {
  return (
    <p className="inline-flex items-center gap-2 rounded-full border border-line bg-raised px-3.5 py-1.5 text-sm shadow-sm">
      <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
      <span className="font-medium">{credits}</span>
      {plan && <span className="text-muted">{plan}</span>}
    </p>
  );
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong bg-surface/60 px-6 py-12 text-center">
      <span
        className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent"
        aria-hidden
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </span>
      <p className="mt-4 font-medium">{title}</p>
      <p className="mt-1 max-w-md text-sm leading-relaxed text-muted">
        {children}
      </p>
    </div>
  );
}

// A run that is still going: what is happening and roughly how long it takes,
// with a bar that keeps moving so the page never looks stuck.
export function ProgressCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="edge p-6">
      <div className="flex items-center gap-3">
        <span
          className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-accent/25 border-t-accent motion-reduce:animate-none"
          aria-hidden
        />
        <p className="font-medium">{title}</p>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted">{children}</p>
      <div className="progress-track mt-5" aria-hidden>
        <span />
      </div>
    </div>
  );
}

export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium capitalize text-accent">
      {children}
    </span>
  );
}

export const smallButton =
  "inline-flex items-center gap-1.5 rounded-lg border border-line bg-raised px-3 py-1.5 text-sm font-medium transition hover:border-accent hover:text-accent";

export function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 4v11m-5-5 5 5 5-5M5 20h14" />
    </svg>
  );
}
