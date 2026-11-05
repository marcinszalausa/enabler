import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { creditGrants, loadAdminData, requireAdmin } from "@/lib/admin";
import { providerBalances } from "@/lib/admin-balances";
import { USD_PER_CREDIT_ESTIMATE, customerRows, overview, planLabel, planPrice, searchCustomers } from "@/lib/admin-stats";
import { platformName } from "@/lib/social/platforms";
import { DayBars, PlanChip, Section, Stat, Table, cell, day, firstCell, num, usd } from "./admin-ui";

export const metadata: Metadata = { title: "Admin · Gooidy", robots: { index: false, follow: false } };

export default async function AdminPage({ params, searchParams }: PageProps<"/[locale]/dashboard/admin">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
      <Suspense fallback={<p className="text-sm text-muted">Loading admin dashboard…</p>}>
        <Admin searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Admin({ searchParams }: { searchParams: PageProps<"/[locale]/dashboard/admin">["searchParams"] }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 200) : "";
  const plan = typeof sp.plan === "string" ? sp.plan : "";
  const [data, grants] = await Promise.all([loadAdminData(), creditGrants(null)]);
  const granted = grants.reduce((s, g) => s + g.amount, 0);
  const o = overview(data);
  const all = customerRows(data);
  const rows = searchCustomers(all, q, plan);
  const shown = rows.slice(0, 200);

  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-wider text-accent">Admin</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Gooidy at a glance</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">Customers, usage and cost across every workspace. Only Gooidy admins can open this page.</p>

      <Section title="Your balances" note="Money left on the accounts that pay for Gooidy's AI and publishing, read live from each provider.">
        <Suspense fallback={<p className="text-sm text-muted">Checking balances…</p>}>
          <Balances />
        </Suspense>
        <dl className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Credits customers hold" value={num(o.creditsHeld)} note={`Up to ${usd(o.creditsHeld * USD_PER_CREDIT_ESTIMATE)} AI cost if all used`} />
          <Stat label="Credits granted by admins" value={num(granted)} note={`${num(grants.length)} changes logged`} />
        </dl>
      </Section>

      <dl className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Customers" value={num(o.customers)} note={`+${num(o.new7)} this week · +${num(o.new30)} in 30 days`} />
        <Stat label="Active in 30 days" value={num(o.active30)} note="Created at least one ad" />
        <Stat label="Paying customers" value={num(o.paying)} note={`${usd(o.monthlyPlanValue)}/mo at list price`} />
        <Stat label="Credits used, 30 days" value={num(o.credits30)} note={`${num(o.creditsAll)} all time`} />
        <Stat label="AI cost, 30 days (est.)" value={usd(o.realCost30 || o.estCost30)} note={o.realCost30 ? "From logged run costs" : `At ${usd(USD_PER_CREDIT_ESTIMATE)} per credit`} />
        <Stat label="Ad runs, 30 days" value={num(o.runs30)} note={`${num(o.failed30)} failed · ${num(o.running)} running now`} />
        <Stat label="Posts published" value={num(o.published)} note={`${num(o.published30)} in 30 days · ${num(o.failedPosts)} failed`} />
        <Stat label="Social accounts" value={num(o.accounts)} note={`${num(o.products)} products added`} />
      </dl>

      <Section title="Last 30 days">
        <div className="grid gap-8 md:grid-cols-2">
          <DayBars label="New customers" days={o.signupsByDay} />
          <DayBars label="Ad runs" days={o.runsByDay} />
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-x-6 lg:grid-cols-2">
        <Section title="Plans" note={`Monthly value uses list prices, before discounts and fees.${o.paying ? "" : " No customer is on a paid plan yet."}`}>
          <Table head={["Plan", "Customers", "Price", "Value / mo"]}>
            {o.plans.map((p) => (
              <tr key={p.id}>
                <td className={firstCell}><PlanChip label={p.label} paid={p.price > 0} /></td>
                <td className={cell}>{num(p.customers)}</td>
                <td className={cell}>{p.price ? usd(p.price) : "—"}</td>
                <td className={cell}>{usd(p.customers * p.price)}</td>
              </tr>
            ))}
          </Table>
        </Section>
        <Section title="Ad runs by type and quality" note="All time. Credits count finished runs only; failed runs are refunded.">
          <Table head={["Run", "Runs", "Failed", "Credits", "Cost (est.)"]} empty={!o.mix.length}>
            {o.mix.map((m) => (
              <tr key={m.kind + m.quality}>
                <td className={firstCell}>{m.kind} <span className="capitalize text-muted">· {m.quality}</span></td>
                <td className={cell}>{num(m.runs)}</td>
                <td className={cell}>{m.failed ? `${num(m.failed)} (${Math.round((m.failed / m.runs) * 100)}%)` : "0"}</td>
                <td className={cell}>{num(m.credits)}</td>
                <td className={cell}>{usd(m.credits * USD_PER_CREDIT_ESTIMATE)}</td>
              </tr>
            ))}
          </Table>
        </Section>
      </div>

      {o.platforms.length > 0 && (
        <Section title="Connected social accounts">
          <ul className="flex flex-wrap gap-2">
            {o.platforms.map((p) => (
              <li key={p.platform} className="rounded-full border border-line bg-surface px-3 py-1 text-sm">
                {platformName(p.platform)} <span className="font-semibold tabular-nums">{num(p.count)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Customers" note={`${num(rows.length)} of ${num(all.length)} shown${rows.length > shown.length ? ", first 200" : ""}. Newest first.`}>
        <form className="flex flex-col gap-2 sm:flex-row" role="search">
          <label className="sr-only" htmlFor="admin-q">Search customers</label>
          <input id="admin-q" name="q" defaultValue={q} type="search" placeholder="Search by email, workspace or id" className="min-h-11 flex-1 rounded-xl border border-line bg-bg px-3 text-sm outline-none focus:border-accent" />
          <label className="sr-only" htmlFor="admin-plan">Plan</label>
          <select id="admin-plan" name="plan" defaultValue={plan} className="min-h-11 rounded-xl border border-line bg-bg px-3 text-sm">
            <option value="">All plans</option>
            <option value="paid">Paying</option>
            {o.plans.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <button type="submit" className="btn-primary min-h-11 rounded-xl px-4 text-sm font-medium">Search</button>
        </form>
        <div className="mt-4">
          <Table wide head={["Customer", "Plan", "Credits left", "Credits used", "Runs", "Posts", "Accounts", "Signed up", "Last sign-in"]} empty={!shown.length}>
            {shown.map((r) => (
              <tr key={r.workspaceId} className="hover:bg-surface/60">
                <td className={firstCell}>
                  <Link href={`/dashboard/admin/customers/${r.workspaceId}`} className="font-medium text-fg hover:text-accent">{r.email}</Link>
                  <p className="text-xs text-muted">{r.products} {r.products === 1 ? "product" : "products"}{r.failedRuns ? ` · ${r.failedRuns} failed runs` : ""}</p>
                </td>
                <td className={cell}><PlanChip label={planLabel(r.plan)} paid={planPrice(r.plan) > 0} /></td>
                <td className={cell}>{num(r.creditsLeft)}</td>
                <td className={cell}>{num(r.creditsUsed)}</td>
                <td className={cell}>{num(r.runs)}</td>
                <td className={cell}>{num(r.posts)}</td>
                <td className={cell}>{num(r.accounts)}</td>
                <td className={cell}>{day(r.signedUp)}</td>
                <td className={cell}>{day(r.lastSignIn)}</td>
              </tr>
            ))}
          </Table>
        </div>
      </Section>
    </>
  );
}

const balanceTone = { ok: "text-fg", off: "text-muted", error: "text-danger", manual: "text-muted" } as const;

async function Balances() {
  const balances = await providerBalances();
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {balances.map((b) => (
        <li key={b.name} className="flex flex-col rounded-2xl border border-line bg-raised p-4">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-medium">{b.name}</p>
            <a href={b.link} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-accent hover:underline">Billing ↗</a>
          </div>
          <p className="text-xs text-muted">{b.use}</p>
          <p className={`mt-2 text-2xl font-semibold tabular-nums tracking-tight ${balanceTone[b.state]}`}>
            {b.value ?? (b.state === "off" ? "Not connected" : b.state === "manual" ? "See billing page" : "Unavailable")}
          </p>
          {b.detail && <p className={`mt-1 text-xs ${b.state === "error" ? "text-danger" : "text-muted"}`}>{b.detail}</p>}
        </li>
      ))}
    </ul>
  );
}
