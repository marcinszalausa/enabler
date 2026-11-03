"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/client";

export type ProductSummary = {
  id: string;
  name: string | null;
  url: string;
  image_urls: string[] | null;
  created_at: string;
};

// A product in the list: its own photo from the store, name and site.
export function ProductCard({ product: p }: { product: ProductSummary }) {
  const photo = p.image_urls?.[0];
  const site = hostname(p.url);
  const { locale } = useI18n();
  return (
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
      <div className="p-4">
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
  );
}

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
