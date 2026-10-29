import { Suspense } from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getBrandKit } from "@/lib/brand-kit";
import { FONTS } from "@/lib/brand";
import { BrandForm } from "./brand-form";

export const metadata = { title: "Brand kit · Gooidy" };

export default function BrandPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <Link
        href="/dashboard"
        className="text-sm text-neutral-500 underline underline-offset-4"
      >
        ← Dashboard
      </Link>
      <h1 className="mt-6 text-2xl font-semibold">Brand kit</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Your logo, button color and headline font appear on every ad, including
        ones you already made.
      </p>
      <Suspense
        fallback={<p className="mt-6 text-sm text-neutral-500">Loading…</p>}
      >
        <Brand />
      </Suspense>
    </main>
  );
}

async function Brand() {
  await getCurrentUser();
  const supabase = await createClient();

  const { data: ws } = await supabase
    .from("workspaces")
    .select("id")
    .order("created_at")
    .limit(1)
    .single();
  if (!ws) return null;

  const [kit, { data: latest }] = await Promise.all([
    getBrandKit(supabase, ws.id),
    supabase
      .from("creatives")
      .select("id")
      .eq("workspace_id", ws.id)
      .eq("aspect", "1:1")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const logoUrl = kit.logo_path
    ? ((
        await supabase.storage
          .from("creatives")
          .createSignedUrl(kit.logo_path, 600)
      ).data?.signedUrl ?? null)
    : null;

  return (
    <div className="mt-8 grid gap-10 md:grid-cols-2">
      <BrandForm
        // Remount after a save so the form shows the stored values.
        key={`${kit.accent_color}-${kit.font}-${kit.logo_path}`}
        accentColor={kit.accent_color}
        font={kit.font}
        fonts={Object.entries(FONTS).map(([key, f]) => ({
          key,
          label: f.label,
        }))}
        logoUrl={logoUrl}
      />
      <div>
        <p className="text-sm font-medium">Preview</p>
        {latest ? (
          // eslint-disable-next-line @next/next/no-img-element -- rendered on demand by our own route
          <img
            src={`/api/creatives/${latest.id}/image?v=${encodeURIComponent(
              `${kit.accent_color}${kit.font}${kit.logo_path ?? ""}`,
            )}`}
            alt="Your latest ad with this brand kit"
            className="mt-2 aspect-square w-full rounded-md border border-neutral-200 object-cover dark:border-neutral-800"
          />
        ) : (
          <p className="mt-2 rounded-md border border-dashed border-neutral-300 p-6 text-sm text-neutral-500 dark:border-neutral-700">
            Generate ads for a product to see a preview here.
          </p>
        )}
      </div>
    </div>
  );
}
