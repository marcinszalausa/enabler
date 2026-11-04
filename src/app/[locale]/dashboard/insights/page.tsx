import {GrowthReport} from "./growth-report";
import {planTools,type ReportRow} from "@/lib/plan-value";
import {Suspense} from "react";
import Link from "next/link";
import {notFound} from "next/navigation";
import {getCurrentUser} from "@/lib/auth";
import {createClient} from "@/lib/supabase/server";
import {getPostAnalytics} from "@/lib/social/analytics";
import {clickRate} from "@/lib/customer-workflow";
import {platformName} from "@/lib/social/platforms";
import {isLocale} from "@/i18n/config";
import {BackLink} from "../ui";
export const metadata={title:"Post results · Gooidy"};
export default async function InsightsPage({params,searchParams}:PageProps<"/[locale]/dashboard/insights">){
 const {locale}=await params;if(!isLocale(locale))notFound();
 return <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10"><BackLink href="/dashboard/publishing">Publishing</BackLink><h1 className="mt-6 text-3xl font-semibold">See what gets noticed</h1><p className="mt-2 max-w-2xl text-sm text-muted">Review your recent social posts, then make another version of the ads people respond to.</p><Suspense fallback={<p className="mt-6 text-sm text-muted">Loading results…</p>}><Results searchParams={searchParams} locale={locale}/></Suspense></main>;
}
async function Results({searchParams,locale}:{searchParams:PageProps<"/[locale]/dashboard/insights">["searchParams"];locale:string}){
 await getCurrentUser();const db=await createClient();
 const {data:ws}=await db.from("workspaces").select("id,plan").order("created_at").limit(1).single();if(!ws)return null;
 const {data:posts,error}=await db.from("posts").select("id,zernio_post_id,creative_id,caption,created_at,results,creatives(generation_id,generations(product_id))").eq("workspace_id",ws.id).in("status",["published","partial"]).order("created_at",{ascending:false}).limit(planTools(ws.plan).resultsLimit);
 if(error)throw error;
 const load=(await searchParams).load==="1";
 const results:{post:NonNullable<typeof posts>[number];result:Awaited<ReturnType<typeof getPostAnalytics>>|null}[]=[];
 if(load)for(let i=0;i<(posts??[]).length;i+=6){results.push(...await Promise.all((posts??[]).slice(i,i+6).map(async post=>({post,result:post.zernio_post_id?await getPostAnalytics(post.zernio_post_id):null}))));}
 const reportRows:ReportRow[]=results.map(({post,result})=>({id:post.id,caption:post.caption??"",date:new Date(post.created_at).toISOString().slice(0,10),network:Array.isArray(post.results)?[...new Set(post.results.flatMap((r:unknown)=>r&&typeof r==="object"&&"platform" in r&&typeof r.platform==="string"?[platformName(r.platform)]:[]))].sort().join(" + "):"",state:result?.state??"unavailable",impressions:result?.metrics?.impressions??null,clicks:result?.metrics?.clicks??null,views:result?.metrics?.views??null}));
 const display=(value:number|null|undefined)=>value===null||value===undefined?"Unavailable":value.toLocaleString(locale);
 return <><section className="edge mt-6 p-5"><h2 className="font-semibold">Latest {planTools(ws.plan).resultsLimit} published posts</h2><p className="mt-2 text-sm text-muted">Network metrics can be delayed or unavailable and depend on your connected accounts and analytics access. Unavailable does not mean zero. These are social post metrics; store sales and revenue are not connected.</p>{posts?.length?<Link prefetch={false} href="/dashboard/insights?load=1" className="btn-primary mt-4 inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-medium">{load?"Refresh network results":"Load network results"}</Link>:<Link href="/dashboard/campaigns" className="mt-4 inline-flex min-h-11 items-center text-sm text-accent">Create and post your first campaign →</Link>}</section>
 <GrowthReport limit={planTools(ws.plan).resultsLimit} enabled={planTools(ws.plan).resultsComparison} rows={reportRows}/>
 {results.length>0&&<ul className="mt-6 grid gap-4">{results.map(({post,result})=>{const creative=post.creatives as unknown as {generation_id:string;generations:{product_id:string}|null}|null;const ctr=clickRate(result?.metrics??null);const networks=Array.isArray(post.results)?[...new Set(post.results.flatMap((r:unknown)=>r&&typeof r==="object"&&"platform" in r&&typeof r.platform==="string"?[platformName(r.platform)]:[]))]:[];return <li key={post.id} className="edge p-5"><p className="text-xs font-medium text-accent">{networks.length>0?networks.join(" · "):"Social post"}{networks.length>1?" · combined results":""}</p><p className="mt-2 line-clamp-3 text-sm">{post.caption}</p><p className="mt-2 text-xs text-muted">Posted {new Date(post.created_at).toLocaleDateString(locale)}{result?.updated&&" · Network updated "+new Date(result.updated).toLocaleString(locale)}</p>{result?.state==="ready"?<><dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Impressions",display(result.metrics?.impressions)],["Clicks",display(result.metrics?.clicks)],["Video views",display(result.metrics?.views)],["Click rate",ctr===null?"Unavailable":ctr.toFixed(2)+"%"]].map(([label,value])=><div key={label} className="rounded-xl bg-surface p-3"><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 text-lg font-semibold">{value}</dd></div>)}</dl><p className="mt-3 text-xs text-muted">Click rate = reported clicks ÷ impressions. Networks define clicks and views differently; compare similar posts on the same network and over similar periods.</p><p className="mt-3 text-sm">{result.metrics?.impressions!==null&&(result.metrics?.impressions??0)>=500&&(result.metrics?.clicks??0)>0?"Next test: keep the product and main benefit, and try a different opening scene. Compare the next version on the same network.":"Give this post time to reach people before judging it. Then test one change at a time, such as the headline or opening scene."}</p></>:<p role="status" className="mt-4 text-sm text-muted">{result?.state==="addon"?"Analytics access is not enabled for this connection. Posting still works; no add-on has been purchased.":result?.state==="pending"?"The network is still preparing these results. Check again later.":"No reliable metrics are available for this post yet."}</p>}{creative?.generations?.product_id&&<Link href={`/dashboard/products/${creative.generations.product_id}#ad-${creative.generation_id}`} className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-accent">Open this ad batch →</Link>}</li>;})}</ul>}
 </>;
}
