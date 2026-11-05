import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { loadCustomer, requireAdmin } from "@/lib/admin";
import { USD_PER_CREDIT_ESTIMATE, netCredits, planLabel, planPrice, runKind, runQuality } from "@/lib/admin-stats";
import { platformName } from "@/lib/social/platforms";
import { BackLink } from "../../../ui";
import { GrantForm } from "./grant-form";
import { PlanChip, Section, Stat, Status, Table, cell, day, firstCell, num, usd, when } from "../../admin-ui";

export const metadata: Metadata = { title: "Customer · Admin · Gooidy", robots: { index: false, follow: false } };

export default function AdminCustomerPage({ params }: PageProps<"/[locale]/dashboard/admin/customers/[id]">) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
      <BackLink href="/dashboard/admin">All customers</BackLink>
      <Suspense fallback={<p className="mt-6 text-sm text-muted">Loading customer…</p>}>
        <Customer params={params} />
      </Suspense>
    </main>
  );
}

async function Customer({ params }: { params: PageProps<"/[locale]/dashboard/admin/customers/[id]">["params"] }) {
  const { id, locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdmin();
  const c = await loadCustomer(id);
  if (!c) notFound();
  const { workspace: w } = c;
  const used = netCredits(c.credits);
  const products = new Map(c.products.map((p) => [p.id, p.name || p.url]));
  const failed = c.generations.filter((g) => g.status === "failed").length;
  const published = c.posts.filter((p) => p.status === "published" || p.status === "partial").length;

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <h1 className="break-all text-2xl font-semibold tracking-tight sm:text-3xl">{c.owner?.email ?? "(deleted user)"}</h1>
        <PlanChip label={planLabel(w.plan)} paid={planPrice(w.plan) > 0} />
      </div>
      <p className="mt-2 text-sm text-muted">
        Workspace “{w.name}” · signed up {day(c.owner?.created_at ?? w.created_at)} · last sign-in {when(c.owner?.last_sign_in_at)}
        {c.owner && !c.owner.confirmed ? " · email not confirmed" : ""}
      </p>
      <p className="mt-1 font-mono text-xs text-muted">{w.id}</p>

      <dl className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Credits left" value={num(w.credits)} />
        <Stat label="Credits used" value={num(used)} note={`About ${usd(used * USD_PER_CREDIT_ESTIMATE)} AI cost (est.)`} />
        <Stat label="Ad runs" value={num(c.generations.length)} note={`${num(failed)} failed`} />
        <Stat label="Posts published" value={num(published)} note={`${num(c.accounts.length)} social accounts`} />
      </dl>

      <Section title="Grant credits" note="Adds credits to this customer's balance right away. They can use them like any other credits.">
        <GrantForm workspaceId={w.id} />
        {c.grants.length > 0 && (
          <div className="mt-5">
            <Table head={["Change", "Balance after", "By", "When"]}>
              {c.grants.map((g) => (
                <tr key={g.id}>
                  <td className={firstCell}>
                    <span className={`font-medium tabular-nums ${g.amount > 0 ? "text-ok" : "text-danger"}`}>{g.amount > 0 ? "+" : "−"}{num(Math.abs(g.amount))}</span>
                    {g.note && <p className="line-clamp-2 max-w-[22rem] text-xs text-muted">{g.note}</p>}
                  </td>
                  <td className={cell}>{num(g.balance_after)}</td>
                  <td className={cell}>{g.admin_email ?? "—"}</td>
                  <td className={cell}>{when(g.created_at)}</td>
                </tr>
              ))}
            </Table>
          </div>
        )}
      </Section>

      <Section title="Recent ad runs" note="Newest first, up to 200.">
        <Table wide head={["Product", "Run", "Status", "Credits", "Created"]} empty={!c.generations.length}>
          {c.generations.map((g) => (
            <tr key={g.id}>
              <td className={firstCell}>
                <span className="line-clamp-1 max-w-[16rem]">{(g.product_id && products.get(g.product_id)) || "—"}</span>
                {g.error && <p className="line-clamp-2 max-w-[22rem] text-xs text-danger">{g.error}</p>}
              </td>
              <td className={cell}>{runKind(g.type)} <span className="capitalize text-muted">· {runQuality(g.request_options)}</span></td>
              <td className={cell}><Status value={g.status} /></td>
              <td className={cell}>{g.status === "failed" ? <span className="text-muted">Refunded</span> : num(g.cost_credits)}</td>
              <td className={cell}>{when(g.created_at)}</td>
            </tr>
          ))}
        </Table>
      </Section>

      <div className="grid grid-cols-1 gap-x-6 lg:grid-cols-2">
        <Section title="Products">
          <Table head={["Product", "Added"]} empty={!c.products.length}>
            {c.products.map((p) => (
              <tr key={p.id}>
                <td className={firstCell}>
                  <p className="line-clamp-1 font-medium">{p.name || "Untitled"}</p>
                  <a href={p.url} target="_blank" rel="noopener noreferrer nofollow" className="line-clamp-1 break-all text-xs text-muted hover:text-accent">{p.url}</a>
                </td>
                <td className={cell}>{day(p.created_at)}</td>
              </tr>
            ))}
          </Table>
        </Section>
        <Section title="Social accounts">
          <Table head={["Account", "Connected"]} empty={!c.accounts.length}>
            {c.accounts.map((a) => (
              <tr key={a.id}>
                <td className={firstCell}>{platformName(a.platform)} <span className="text-muted">{a.username ? `@${a.username}` : a.display_name ?? ""}</span></td>
                <td className={cell}>{day(a.created_at)}</td>
              </tr>
            ))}
          </Table>
        </Section>
      </div>

      <Section title="Posts" note="Newest first, up to 100.">
        <Table wide head={["Caption", "Status", "Scheduled", "Created"]} empty={!c.posts.length}>
          {c.posts.map((p) => (
            <tr key={p.id}>
              <td className={firstCell}>
                <span className="line-clamp-1 max-w-[22rem]">{p.caption || "—"}</span>
                {p.error && <p className="line-clamp-2 max-w-[22rem] text-xs text-danger">{p.error}</p>}
              </td>
              <td className={cell}><Status value={p.status} /></td>
              <td className={cell}>{p.scheduled_for ? when(p.scheduled_for) : "Now"}</td>
              <td className={cell}>{day(p.created_at)}</td>
            </tr>
          ))}
        </Table>
      </Section>

      {c.members.length > 1 && (
        <Section title="Team members">
          <ul className="text-sm">
            {c.members.map((m) => <li key={m.user_id} className="py-1"><span className="font-mono text-xs">{m.user_id}</span> · <span className="capitalize">{m.role}</span></li>)}
          </ul>
        </Section>
      )}

      <p className="mt-6 text-xs text-muted">
        To change a plan, use the Supabase dashboard. <Link href="/dashboard/admin" className="text-accent">Back to all customers</Link>
      </p>
    </>
  );
}
