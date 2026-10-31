import type { Messages } from "@/i18n/messages";
export function SetupSteps({ t, current }: { t: Messages; current: 1 | 2 | 3 }) {
  return <ol className="mb-8 grid grid-cols-3 gap-2 text-xs sm:text-sm">
    {[t.footer.product, t.publish.ads, t.footer.account].map((label, i) =>
      <li key={label} aria-current={i + 1 === current ? "step" : undefined}
        className={"flex flex-col items-start gap-1 rounded-xl border px-2 py-3 sm:flex-row sm:items-center sm:gap-2 sm:px-3 " + (i + 1 === current ? "border-accent bg-accent-soft font-medium text-accent" : "border-line text-muted")}>
        <span aria-hidden>{i + 1 < current ? "✓" : i + 1}</span><span>{label}</span>
      </li>)}
  </ol>;
}
