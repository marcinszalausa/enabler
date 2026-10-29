import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getMessages, type Messages } from "@/i18n/messages";
import { BackLink, EmptyState } from "../ui";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getBrandKit } from "@/lib/brand-kit";
import { FONTS } from "@/lib/brand";
import { BrandForm } from "./brand-form";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/dashboard/brand">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: (await getMessages(locale)).meta.brandTitle };
}

export default async function BrandPage({
  params,
}: PageProps<"/[locale]/dashboard/brand">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getMessages(locale);
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <BackLink href="/dashboard">{t.app.dashboard}</BackLink>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">
        {t.app.brandKit}
      </h1>
      <p className="mt-1 text-sm text-muted">{t.app.kitIntro}</p>
      <Suspense
        fallback={<p className="mt-6 text-sm text-muted">{t.app.loading}</p>}
      >
        <Brand t={t} />
      </Suspense>
    </main>
  );
}

async function Brand({ t }: { t: Messages }) {
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
        fonts={(Object.keys(FONTS) as (keyof typeof FONTS)[]).map((key) => ({
          key,
          label: t.app.fonts[key],
        }))}
        logoUrl={logoUrl}
      />
      <div>
        <p className="text-sm font-medium">{t.app.preview}</p>
        {latest ? (
          // eslint-disable-next-line @next/next/no-img-element -- rendered on demand by our own route
          <img
            src={`/api/creatives/${latest.id}/image?v=${encodeURIComponent(
              `${kit.accent_color}${kit.font}${kit.logo_path ?? ""}`,
            )}`}
            alt={t.app.previewAlt}
            className="mt-2 aspect-square w-full rounded-2xl border border-line object-cover"
          />
        ) : (
          <div className="mt-2">
            <EmptyState title={t.app.noPreview}>
              {t.app.noPreviewBody}
            </EmptyState>
          </div>
        )}
      </div>
    </div>
  );
}
