import {Suspense} from "react";
import Link from "next/link";
import {notFound} from "next/navigation";
import {isLocale} from "@/i18n/config";
import {getCurrentUser} from "@/lib/auth";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {shopifyConfigured} from "@/lib/shopify/security";
import {ConnectStoreCard,StoreConnectionCard} from "./stores-view";
import {StoreRefresh} from "./refresh";
export const metadata={title:"Your stores | Gooidy"};
export default async function StoresPage({params,searchParams}:PageProps<"/[locale]/dashboard/stores">){
 const {locale}=await params;if(!isLocale(locale))notFound();
 return <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10"><h1 className="text-3xl font-semibold tracking-tight">Your stores</h1><p className="mt-2 max-w-2xl text-muted">Connect your store once. Choose your products here whenever you want to create ads.</p><Suspense fallback={<p role="status" className="mt-8 text-muted">Loading your stores…</p>}><Stores searchParams={searchParams}/></Suspense></main>;
}
const notices:Record<string,string>={connected:"Store authorized. Your products are syncing.",syncing:"Your products are syncing. You can leave this page and come back.",disconnected:"Your store is disconnected. Your existing Gooidy ads are kept.",canceled:"Connection canceled. You can try again whenever you’re ready.",connect_error:"We couldn’t connect your store. Check the store address and try again.",action_error:"We couldn’t complete that action. Please try again.",unavailable:"Shopify connection is temporarily unavailable.",reconnect:"Please reconnect your store to restore access."};
async function Stores({searchParams}:{searchParams:PageProps<"/[locale]/dashboard/stores">["searchParams"]}){
 await getCurrentUser();const client=await createClient(),params=await searchParams;
 const {data:ws,error:wsError}=await client.from("workspaces").select("id").order("created_at").limit(1).maybeSingle();if(wsError)throw new Error("Could not load workspace");if(!ws)return <p className="mt-8">Create a workspace before connecting a store.</p>;
 const {data:owner}=await client.rpc("is_workspace_member",{ws:ws.id,min_role:"owner"});
 const {data:stores,error}=await createAdminClient().from("shopify_stores").select("id,shop,name,status,connection_id,synced_at").eq("workspace_id",ws.id).order("installed_at",{ascending:false});if(error)throw new Error("Could not load stores");
 const ready=shopifyConfigured(),notice=typeof params.notice==="string"?notices[params.notice]:null;
 return <><StoreRefresh active={!!stores?.some(s=>s.status==="syncing")}/>{notice&&<p role="status" className="mt-6 rounded-xl border border-line bg-surface p-4 text-sm">{notice}</p>}
 <ol aria-label="How connecting works" className="mt-8 grid gap-3 sm:grid-cols-3">{[["1","Connect your store","Approve access securely in Shopify."],["2","Choose a product","Your product photos arrive automatically."],["3","Create your ads","Review everything before publishing."]].map(([n,title,body])=><li key={n} className="rounded-2xl border border-line p-5"><span aria-hidden="true" className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent">{n}</span><h2 className="mt-3 font-medium">{title}</h2><p className="mt-1 text-sm text-muted">{body}</p></li>)}</ol>
 <ConnectStoreCard workspaceId={ws.id} owner={owner===true} ready={ready}/>
 <div className="mt-8 space-y-6">{stores?.map(store=><StoreConnectionCard key={store.id} store={store} workspaceId={ws.id} owner={owner===true} ready={ready}>{store.status!=="disconnected"&&<Suspense fallback={null}><Catalog connectionId={store.connection_id} query={typeof params.q==="string"?params.q.slice(0,80):""} page={typeof params.page==="string"&&/^\d{1,4}$/.test(params.page)?Math.max(1,Math.min(1000,Number(params.page))):1}/></Suspense>}</StoreConnectionCard>)}</div></>;
}
async function Catalog({connectionId,query,page}:{connectionId:string;query:string;page:number}){
 const db=await createClient();let request=db.from("catalog_items").select("id,name,product_url,images,inventory_quantity",{count:"exact"}).eq("connection_id",connectionId);if(query)request=request.ilike("name","%"+query.replaceAll("\\","\\\\").replaceAll("%","\\%").replaceAll("_","\\_")+"%");const {data:items,count,error}=await request.order("name").order("id").range((page-1)*12,page*12-1);if(error)throw new Error("Could not load catalog");
 if(!items?.length&&!query&&page===1)return null;
 return <div className="mt-6 border-t border-line pt-5"><p className="text-sm font-medium">{count} products · Choose one to create ads</p><form action="/dashboard/stores" method="get" className="mt-4 flex flex-wrap gap-2"><label className="sr-only" htmlFor={"search-"+connectionId}>Find a product</label><input id={"search-"+connectionId} name="q" defaultValue={query} maxLength={80} placeholder="Find a product" className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-bg px-3"/><button className="min-h-11 rounded-xl border border-line px-4 text-sm">Search</button>{query&&<Link href="/dashboard/stores" className="inline-flex min-h-11 items-center px-3 text-sm text-accent">Clear</Link>}</form>{!items?.length&&<p className="mt-4 text-sm text-muted">No matching products. Try another name.</p>}<ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{items?.map(item=><li key={item.id} className="overflow-hidden rounded-xl border border-line">{typeof item.images?.[0]==="string"&&(
 // eslint-disable-next-line @next/next/no-img-element -- merchant catalog hosts vary; native lazy images avoid an unrestricted optimizer.
 <img src={item.images[0]} alt={item.name} loading="lazy" width="240" height="240" className="aspect-square w-full bg-surface object-contain"/>
 )}<div className="p-3"><h3 className="line-clamp-2 text-sm font-medium">{item.name}</h3>{item.inventory_quantity===0?<p className="mt-2 text-xs text-muted">Out of stock</p>:<Link href={"/dashboard?url="+encodeURIComponent(item.product_url)+"#add"} className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-accent">Create ads →</Link>}</div></li>)}</ul>{(page>1||(count??0)>page*12)&&<nav aria-label="Catalog pages" className="mt-4 flex gap-4">{page>1&&<Link className="inline-flex min-h-11 items-center text-sm text-accent" href={"/dashboard/stores?"+new URLSearchParams({q:query,page:String(page-1)})}>← Previous</Link>}{(count??0)>page*12&&<Link className="inline-flex min-h-11 items-center text-sm text-accent" href={"/dashboard/stores?"+new URLSearchParams({q:query,page:String(page+1)})}>Next products →</Link>}</nav>}</div>;
}
