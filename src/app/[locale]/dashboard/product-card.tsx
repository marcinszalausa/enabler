"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { DeleteDialog, TrashIcon } from "./delete-button";
import { MoreMenu } from "./more-menu";
import { ProductFavoriteButton } from "./product-favorite";

export type ProductSummary = {
  id: string;
  name: string | null;
  url: string;
  image_urls: string[] | null;
  created_at: string;
  favorite?: boolean;
};

// A product in the list: its own photo from the store, name and site.
export function ProductCard({ product: p }: { product: ProductSummary }) {
  const photo = p.image_urls?.[0];
  const site = hostname(p.url);
  const { locale, t } = useI18n();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="relative">
    <Link
      href={`/dashboard/products/${p.id}`}
      className="app-product-card group block overflow-hidden rounded-2xl border border-line bg-raised"
    >
      <div className="relative aspect-[4/5] bg-surface">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- the store's own photo, on any host
          <img
            src={photo}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-contain p-2"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-4xl font-semibold uppercase text-muted/50">
            {(p.name ?? site)[0]}
          </span>
        )}
      </div>
      <div className="p-4 pe-14">
        <p className="truncate font-medium transition group-hover:text-accent">
          {p.name ?? site}
        </p>
        <p className="mt-0.5 truncate text-sm text-muted">
          {site} ·{" "}
          {new Date(p.created_at).toLocaleDateString(locale, {
            month: "short",
            day: "numeric",
          })}
        </p>
      </div>
    </Link>
    {/* Outside the link, so these never open the product. */}
    <ProductFavoriteButton productId={p.id} favorite={p.favorite ?? false} className="absolute end-3 top-3" />
    <MoreMenu
      className="absolute bottom-3 end-2"
      items={[
        { label: t.remove.openProduct, onSelect: () => router.push(`/dashboard/products/${p.id}`) },
        { label: t.remove.deleteProduct, onSelect: () => setConfirm(true), danger: true, icon: <TrashIcon />, testId: "delete-product" },
      ]}
    />
    {confirm && <DeleteDialog target="product" id={p.id} onClose={() => setConfirm(false)} />}
    </div>
  );
}

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
