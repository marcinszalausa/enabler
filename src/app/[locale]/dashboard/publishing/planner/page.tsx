import {Suspense} from "react";
import Link from "next/link";
import {notFound} from "next/navigation";
import {isLocale} from "@/i18n/config";
import {getCurrentUser} from "@/lib/auth";
import {createClient} from "@/lib/supabase/server";
import {canEditWorkspace} from "@/lib/workspace-access";
import {planTools} from "@/lib/plan-value";
import {WeekPlanner} from "./week-planner";
import {BackLink} from "../../ui";
export const metadata={title:"Weekly planner · Gooidy"};
export default async function Page({params}:PageProps<"/[locale]/dashboard/publishing/planner">){if(!isLocale((await params).locale))notFound();return <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10"><BackLink href="/dashboard/publishing">Publishing</BackLink><h1 className="mt-6 text-3xl font-semibold">Plan your next week of posts</h1><p className="mt-2 text-sm text-muted">Choose saved ads, preview your posting routine and take calendar reminders with you.</p><Suspense fallback={<p className="mt-6 text-muted">Loading planner…</p>}><Planner/></Suspense></main>;}
async function Planner(){
 await getCurrentUser();const db=await createClient();const {data:ws,error}=await db.from("workspaces").select("id,plan").order("created_at").limit(1).single();if(error||!ws)throw error??new Error("Workspace unavailable.");
 if(!planTools(ws.plan).weekPlanner)return <section className="edge mt-6 p-6"><h2 className="text-xl font-semibold">Build a posting routine with Launch</h2><p className="mt-3 text-sm text-muted">Launch and Scale add a planner for up to seven ads with available posting times and calendar reminders. Your manual scheduling and existing publishing tools remain available.</p><div className="mt-4 flex flex-wrap gap-4"><Link href="/pricing#plan-starter" className="inline-flex min-h-11 items-center text-accent">See Launch benefits →</Link><Link href="/dashboard/publishing" className="inline-flex min-h-11 items-center">Continue to Publishing</Link></div></section>;
 if(!(await canEditWorkspace(db,ws.id)))return <p className="edge mt-6 p-5">Ask a workspace editor to build the posting plan.</p>;
 const {data:ads,error:adError}=await db.from("creatives").select("id,headline,generations!inner(status,products(name))").eq("workspace_id",ws.id).eq("generations.status","succeeded").order("created_at",{ascending:false}).limit(100);if(adError)throw adError;
 if(!ads?.length)return <p className="edge mt-6 p-5">Create and review an ad first, then use it in your posting plan. <Link href="/dashboard" className="text-accent underline">Open Products</Link></p>;
 return <><p className="mt-4 text-sm text-muted">Uses your <Link href="/dashboard/publishing" className="text-accent underline">saved posting times and time zone</Link>. No generation credits are used.</p><WeekPlanner ads={ads.map(a=>({id:a.id,headline:(a.headline??"Product ad").slice(0,80),product:((a.generations as unknown as {products:{name:string|null}|null})?.products?.name??"Product").slice(0,80)}))}/></>;
}
