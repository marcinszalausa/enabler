"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isLocale } from "@/i18n/config";

export type AppNavItem = { href: string; label: string };

const tab =
  "flex min-h-11 min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-sm leading-tight transition hover:bg-surface hover:text-fg focus-visible:outline-2 focus-visible:outline-accent in-data-collapsed:justify-center in-data-collapsed:px-0";

// The app's sections, listed down the sidebar (the drawer on phones).
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
    [...items].reverse().find((i) => i !== items[0] && (path === i.href || path.startsWith(i.href + "/")))
      ?.href ?? (path.startsWith(items[0].href) ? items[0].href : null);
  return items.map((item) => (
    <Link
      data-app-tab
      key={item.href}
      href={item.href}
      aria-current={item.href === current ? "page" : undefined}
      title={item.label}
      className={`${tab} ${item.href === current ? "bg-accent-soft font-medium text-accent" : "text-muted"}`}
    >
      <NavIcon href={item.href}/>
      <span className="break-words in-data-collapsed:sr-only">{item.label}</span>
    </Link>
  ));
}

function NavIcon({href}:{href:string}){
 return <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{href.endsWith("/ads")?<><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 18 6-6 4 4 3-4 5 6"/></>:href.endsWith("/publishing")?<><path d="m3 10 18-7-7 18-3-8-8-3Z"/><path d="m11 13 10-10"/></>:href.endsWith("/campaigns")?<><path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></>:href.endsWith("/brand")?<><path d="M4 20c5 0 5-3 5-5l-3-1c-3 1-1 4-2 6Z"/><path d="m9 15 11-11-2-2L7 13"/></>:<><path d="m3 7 9-4 9 4v11l-9 4-9-4V7Z"/><path d="m3 7 9 4 9-4M12 11v11"/></>}</svg>;
}
