import type { Messages } from "@/i18n/messages";
import { fmt } from "@/i18n/format";
import { generationPresentation, settledCredits, type CreditReceipt, type RunSnapshot } from "@/lib/generation-presentation";

export function GenerationStatus({ t, generation: g, receipt, canRetry = false }: {
  t: Messages;
  generation: RunSnapshot & { id: string; error: string | null };
  receipt?: CreditReceipt | null;
  canRetry?: boolean;
}) {
  const view = generationPresentation(g);
  const credits = settledCredits(g, receipt);
  const phase = view.phase;
  const tone = phase === "failed" ? "border-danger/30 bg-danger-bg" : phase === "partial" ? "border-warn/30 bg-warn-bg" : view.active ? "border-accent/30 bg-accent-soft" : "border-ok/30 bg-ok-bg";
  const steps = view.video ? ["preparing", "creating", "finishing", "ready"] as const : ["creating", "finishing", "ready"] as const;
  const current = steps.findIndex(step => step === phase);
  return (
    <section data-generation-status={phase} className={"mb-5 rounded-2xl border p-5 sm:p-6 " + tone}>
      <div role="status" aria-live="polite" aria-atomic="true">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-semibold">
            {view.active && <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent motion-reduce:animate-none" />}
            {t.run[phase]}
          </h2>
          <p className="rounded-full border border-current/10 px-3 py-1 text-sm font-medium">{fmt(t.run.saved, { done: view.saved, total: view.total })}</p>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted">{view.active ? t.run.working : phase === "partial" ? t.run.partialBody : phase === "failed" ? t.run.failedBody : t.run.readyBody}</p>
      </div>
      {view.active && <ol aria-label={t.run.stages} className="mt-5 grid grid-cols-2 gap-2 text-xs sm:flex sm:flex-wrap">
        {steps.map((step, i) => <li key={step} aria-current={i === current ? "step" : undefined}
          className={"rounded-lg border px-3 py-2 " + (i === current ? "border-accent bg-raised font-semibold text-accent" : "border-line text-muted")}>
          <span aria-hidden className="me-1.5">{current > i ? "✓" : i + 1}</span>{t.run[step]}
        </li>)}
      </ol>}
      <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-3 border-t border-current/10 pt-4 text-sm">
        <div><dt className="text-muted">{t.run.cost}</dt><dd className="mt-0.5 font-medium">{fmt(t.app.credits, { count: g.cost_credits })}</dd></div>
        {credits?.used !== null && credits?.used !== undefined && <div data-credits-used><dt className="text-muted">{t.run.used}</dt><dd className="mt-0.5 font-medium">{fmt(t.app.credits, { count: credits.used })}</dd></div>}
        {credits && <div data-credits-returned><dt className="text-muted">{t.run.returned}</dt><dd className="mt-0.5 font-medium">{fmt(t.app.credits, { count: credits.returned })}</dd></div>}
      </dl>
      {!view.active && !credits && <p className="mt-3 text-xs leading-relaxed text-muted">{t.run.noReceipt}</p>}
      {(phase === "partial" || phase === "failed") && <>
        {canRetry && <div className="mt-5 flex flex-wrap items-center gap-3">
          <a href="#generate-ads" className="inline-flex min-h-11 items-center rounded-xl border border-line-strong bg-raised px-4 text-sm font-medium hover:border-accent hover:text-accent">{t.run.retry}</a>
          <p className="max-w-lg text-xs leading-relaxed text-muted">{t.run.retryHint}</p>
        </div>}
        <details className="mt-4 text-xs text-muted">
          <summary className="inline-flex min-h-11 cursor-pointer items-center font-medium underline underline-offset-4">{t.run.details}</summary>
          <p className="mt-2 leading-relaxed">{g.error && /quality|opening frame|visible defects/i.test(g.error) ? t.run.quality : t.run.failedBody}</p>
          <p className="mt-2 break-all font-mono">{g.id}</p>
        </details>
      </>}
    </section>
  );
}
