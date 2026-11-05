import type { Messages } from "@/i18n/messages";
import { fmt } from "@/i18n/format";
import { isQuality } from "@/lib/quality";
import { settledCredits, type CreditReceipt } from "@/lib/generation-presentation";
import type { Generation } from "./generation-block";

export function NoteIcon() {
  return <span aria-hidden className="grid h-5 w-5 flex-none place-items-center rounded-full bg-surface text-[11px] font-bold text-muted">!</span>;
}

// Batches that ended with no saved ads fold into one quiet row. The credits
// are already back in the wallet, so there is nothing to act on or clean up.
export function FailedBatches({ t, locale, runs, receipts, canRetry }: {
  t: Messages;
  locale: string;
  runs: Generation[];
  receipts: Map<string, CreditReceipt>;
  canRetry: boolean;
}) {
  if (!runs.length) return null;
  return (
    <details data-failed-batches={runs.length} className="group border-y border-line text-sm">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 py-2 [&::-webkit-details-marker]:hidden">
        <NoteIcon />
        <span className="flex-1 text-muted">
          <span className="font-medium text-fg">{runs.length === 1 ? t.run.groupOne : fmt(t.run.groupMany, { count: runs.length })}</span>
          {" · "}{t.run.creditsBack}
        </span>
        <span className="inline-flex items-center gap-1 text-sm font-medium text-accent">
          <span className="group-open:hidden">{t.run.show}</span>
          <span className="hidden group-open:inline">{t.run.hide}</span>
          <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5 transition group-open:rotate-180"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      </summary>
      <ul className="flex flex-col gap-1.5 pb-3 ps-8 text-xs text-muted">
        {runs.map(g => {
          const quality = (g.request_options as { quality?: unknown } | null | undefined)?.quality;
          const credits = settledCredits(g, receipts.get(g.id));
          return (
            <li key={g.id} id={`ad-${g.id}`} data-failed-batch={g.id} className="scroll-mt-40">
              {new Date(g.created_at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}
              {isQuality(quality) && <> · {t.app.qualities[quality]}</>}
              {credits && <> · {fmt(t.run.returnedN, { count: credits.returned })}</>}
            </li>
          );
        })}
        {canRetry && <li><a href="#generate-ads" className="inline-flex min-h-11 items-center font-medium text-accent hover:underline">{t.run.tryAgain}</a></li>}
      </ul>
    </details>
  );
}
