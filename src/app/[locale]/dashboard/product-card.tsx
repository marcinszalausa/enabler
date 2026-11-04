"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/client";
import { DeleteButton } from "./delete-button";
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
  const { locale } = useI18n();
  return (
    <div className="relative">
    <Link
      href={`/dashboard/products/${p.id}`}
      className="spot lift group block overflow-hidden rounded-2xl border border-line bg-raised"
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
      <div className="p-4 pe-24">
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
    {/* Outside the link, so it never opens the product. */}
    <div className="absolute bottom-3 end-2 flex items-center">
      <ProductFavoriteButton productId={p.id} favorite={p.favorite ?? false} />
      <DeleteButton
        target="product"
        id={p.id}
        iconOnly
        className="flex h-11 w-11 items-center justify-center rounded-xl text-muted transition hover:bg-danger-bg hover:text-danger"
      />
    </div>
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
