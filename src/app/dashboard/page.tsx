import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard · Enabler" };

export default function DashboardPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <Suspense fallback={<p className="text-sm text-neutral-500">Loading…</p>}>
        <Dashboard />
      </Suspense>
    </main>
  );
}

async function Dashboard() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, plan, credits")
    .order("created_at")
    .limit(1)
    .maybeSingle();

  const { data: products } = workspace
    ? await supabase
        .from("products")
        .select("id, name, url, created_at")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <>
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {workspace?.name ?? "Your workspace"}
          </h1>
          <p className="text-sm text-neutral-500">
            {user.email} · {workspace?.plan ?? "free"} plan ·{" "}
            {workspace?.credits ?? 0} credits
          </p>
        </div>
        <form action="/auth/signout" method="post">
          <button className="text-sm underline underline-offset-4">
            Sign out
          </button>
        </form>
      </header>

      <section className="mt-10">
        <h2 className="text-lg font-medium">Products</h2>
        {products && products.length > 0 ? (
          <ul className="mt-4 divide-y divide-neutral-200 dark:divide-neutral-800">
            {products.map((p) => (
              <li key={p.id} className="py-3">
                <p className="font-medium">{p.name ?? p.url}</p>
                <p className="text-sm text-neutral-500">{p.url}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-md border border-dashed border-neutral-300 p-6 text-sm text-neutral-500 dark:border-neutral-700">
            No products yet. Paste a product URL to generate ads (coming in
            Milestone 1).
          </p>
        )}
      </section>
    </>
  );
}
