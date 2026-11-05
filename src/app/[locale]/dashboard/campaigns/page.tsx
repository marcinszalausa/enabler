import { Suspense } from "react";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canEditWorkspace } from "@/lib/workspace-access";
import { isLocale } from "@/i18n/config";
import { seasonIdeas } from "@/lib/customer-workflow";
import { CampaignForm } from "./campaign-form";
import { BackLink } from "../ui";
export const metadata = { title: "Campaigns · Gooidy" };
export default async function CampaignsPage({params}: PageProps<"/[locale]/dashboard/campaigns">) {
  if (!isLocale((await params).locale)) notFound();
  return <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10"><BackLink href="/dashboard">Products</BackLink><h1 className="mt-6 text-3xl font-semibold">Campaigns</h1><p className="mt-2 text-sm text-muted">One message. Matching ads. Ready to review and post.</p><Suspense fallback={<p className="mt-6 text-sm text-muted">Loading campaigns…</p>}><Campaigns/></Suspense></main>;
}
async function Campaigns() {
  await getCurrentUser();
  const db=await createClient();
  const {data:ws}=await db.from("workspaces").select("id").order("created_at").limit(1).single();
  if (!ws) return null;
  const [{data:products,error:productError},{data:campaigns,error},canEdit]=await Promise.all([
    db.from("products").select("id,name,url").eq("workspace_id",ws.id).order("created_at",{ascending:false}).limit(100),
    db.from("campaigns").select("id,name,product_id,goal,created_at").eq("workspace_id",ws.id).order("created_at",{ascending:false}).limit(50),
    canEditWorkspace(db,ws.id),
  ]);
  if(error||productError) throw error??productError;
  return <>{canEdit&&(products??[]).length>0?<CampaignForm id={randomUUID()} products={products??[]} ideas={seasonIdeas(new Date())}/>:<p className="edge mt-6 p-5">{canEdit?<Link href="/dashboard" className="text-accent underline">Add a product to start your first campaign.</Link>:"Your team’s saved campaigns appear below."}</p>}
    <section className="mt-10"><h2 className="text-xl font-semibold">Saved campaigns</h2>{campaigns?.length?<ul className="mt-4 grid gap-4 sm:grid-cols-2">{campaigns.map(c=><li key={c.id}><Link href={`/dashboard/products/${c.product_id}?campaign=${c.id}`} className="edge block h-full p-5 hover:border-accent"><p className="font-semibold">{c.name}</p><p className="mt-2 text-sm text-muted">{products?.find(p=>p.id===c.product_id)?.name??"Product campaign"}</p><p className="mt-3 text-sm text-accent">Open campaign →</p></Link></li>)}</ul>:<p className="mt-3 text-sm text-muted">Save your first plan above. Planning uses no credits.</p>}</section></>;
}
