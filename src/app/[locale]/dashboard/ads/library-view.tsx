import Link from "next/link";
import type {Messages} from "@/i18n/messages";
import {fmt} from "@/i18n/format";
import {libraryPath,type LibraryAd,type LibraryFilter} from "@/lib/ad-library";
import {LibraryGrid} from "./library-grid";
export function LibraryView({t,ads,filter,hasNext}:{t:Messages;ads:LibraryAd[];filter:LibraryFilter;hasNext:boolean}){
 return <><div className="mt-6 flex flex-wrap gap-2" data-library-filters>
  {(["all","image","video"] as const).map(kind=><Link key={kind} href={libraryPath({...filter,kind,page:1})} aria-current={filter.kind===kind?"page":undefined} className={"inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-medium "+(filter.kind===kind?"border-accent bg-accent-soft text-accent":"border-line")}>{kind==="all"?t.library.all:kind==="image"?t.library.images:t.library.videos}</Link>)}
  <Link href={libraryPath({...filter,favorites:!filter.favorites,page:1})} aria-current={filter.favorites?"page":undefined} className={"inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-medium "+(filter.favorites?"border-accent bg-accent-soft text-accent":"border-line")}>{t.library.favorites}</Link>
 </div>
 {ads.length?<LibraryGrid ads={ads}/>:<section className="mt-6 rounded-2xl border border-dashed border-line-strong bg-surface p-8 text-center"><h2 className="text-lg font-semibold">{filter.favorites?t.library.emptyFavorites:t.library.empty}</h2><p className="mx-auto mt-2 max-w-md text-sm text-muted">{filter.favorites?t.library.favoritesHelp:t.journey.addHint}</p><Link href={filter.favorites||filter.kind!=="all"||filter.page>1?"/dashboard/ads":"/dashboard"} className="btn-primary mt-5 inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-medium">{filter.favorites||filter.kind!=="all"||filter.page>1?t.library.all:t.app.addProduct}</Link></section>}
 <nav aria-label={t.library.pages} className="mt-6 flex items-center justify-between gap-3">
  {filter.page>1?<Link href={libraryPath({...filter,page:filter.page-1})} className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm">{t.library.previous}</Link>:<span/>}
  <span className="text-sm text-muted">{fmt(t.library.page,{number:filter.page})}</span>
  {hasNext?<Link href={libraryPath({...filter,page:filter.page+1})} className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm">{t.library.next}</Link>:<span/>}
 </nav></>;
}
