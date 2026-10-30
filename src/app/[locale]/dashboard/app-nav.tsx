"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isLocale } from "@/i18n/config";

export type AppNavItem = { href: string; label: string };

const tab =
  "shrink-0 whitespace-nowrap rounded-lg px-3 py-2 transition hover:bg-surface hover:text-fg";

// The app's sections. On phones they sit in their own row under the bar and
// scroll sideways if a language makes them long, so the page never gets
// wider than the screen.
export function AppNav({ items }: { items: AppNavItem[] }) {
  // The pathname is only known per request; the plain links render first.
  return (
    <Suspense fallback={<Tabs items={items} path="" />}>
      <CurrentTabs items={items} />
    </Suspense>
  );
}

function CurrentTabs({ items }: { items: AppNavItem[] }) {
  // The app is served from /<language>/dashboard behind the scenes, and the
  // pathname can carry that language.
  const path = usePathname();
  const first = path.split("/")[1];
  return (
    <Tabs
      items={items}
      path={isLocale(first) ? path.slice(first.length + 1) : path}
    />
  );
}

function Tabs({ items, path }: { items: AppNavItem[]; path: string }) {
  // Product pages belong to Products, the first section.
  const current =
    [...items].reverse().find((i) => i !== items[0] && path.startsWith(i.href))
      ?.href ?? (path.startsWith(items[0].href) ? items[0].href : null);
  return items.map((item) => (
    <Link
      key={item.href}
      href={item.href}
      aria-current={item.href === current ? "page" : undefined}
      className={`${tab} ${item.href === current ? "bg-surface font-medium text-fg" : "text-muted"}`}
    >
      {item.label}
    </Link>
  ));
}
