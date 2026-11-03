"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isLocale } from "@/i18n/config";

export type AppNavItem = { href: string; label: string };

const tab =
  "flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-center text-xs leading-tight transition hover:bg-surface hover:text-fg focus-visible:outline-2 focus-visible:outline-accent sm:flex-row sm:gap-2 sm:px-3 sm:text-sm";

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
    [...items].reverse().find((i) => i !== items[0] && (path === i.href || path.startsWith(i.href + "/")))
      ?.href ?? (path.startsWith(items[0].href) ? items[0].href : null);
  return items.map((item) => (
    <Link
      data-app-tab
      key={item.href}
      href={item.href}
      aria-current={item.href === current ? "page" : undefined}
      className={`${tab} ${item.href === current ? "bg-surface font-medium text-fg" : "text-muted"}`}
    >
      <NavIcon href={item.href}/>
      <span className="break-words">{item.label}</span>
    </Link>
  ));
}

function NavIcon({href}:{href:string}){
 return <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{href.endsWith("/ads")?<><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 18 6-6 4 4 3-4 5 6"/></>:href.endsWith("/publishing")?<><path d="m3 10 18-7-7 18-3-8-8-3Z"/><path d="m11 13 10-10"/></>:href.endsWith("/brand")?<><path d="M4 20c5 0 5-3 5-5l-3-1c-3 1-1 4-2 6Z"/><path d="m9 15 11-11-2-2L7 13"/></>:<><path d="m3 7 9-4 9 4v11l-9 4-9-4V7Z"/><path d="m3 7 9 4 9-4M12 11v11"/></>}</svg>;
}
