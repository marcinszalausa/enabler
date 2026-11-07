import {Suspense} from "react";
import Link from "next/link";
import {notFound} from "next/navigation";
import {isLocale} from "@/i18n/config";
import {getCurrentUser} from "@/lib/auth";
import {createClient} from "@/lib/supabase/server";
import {photoReviewItem} from "@/lib/catalog/photo-access";
import {PhotoReview} from "./photo-review";
import {TrainingPanel} from "./training-panel";
import {trainingPhotos} from "@/lib/catalog/training-photos";
import {trainingSetup} from "@/lib/catalog/training-policy";
import {createAdminClient} from "@/lib/supabase/admin";
import {stockLabel} from "@/lib/catalog/inventory-policy";
import {trainingAllowed} from "@/lib/catalog/security";
import {PaidAdLinker} from "../../paid-account-controls";
export const metadata={title:"Product photos | Gooidy",robots:{index:false,follow:false}};
export default function ProductPhotosPage({params}:PageProps<"/[locale]/dashboard/stores/products/[id]">){
 return <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10"><Link href="/dashboard/stores" className="inline-flex min-h-11 items-center text-sm text-accent">← Your stores</Link><h1 className="mt-5 text-3xl font-semibold tracking-tight">Product photos</h1><Suspense fallback={<p role="status" className="mt-8 text-muted">Loading your product…</p>}><ProductPhotos params={params}/></Suspense></main>;
}
async function ProductPhotos({params}:{params:PageProps<"/[locale]/dashboard/stores/products/[id]">["params"]}){
 const {id,locale}=await params;if(!isLocale(locale))notFound();await getCurrentUser();const db=await createClient(),item=await photoReviewItem(db,id);
 if(!item)return <section className="edge mt-8 p-6"><h2 className="font-semibold">Open this product from a connected store</h2><p className="mt-2 text-sm text-muted">Photo checks are available to the workspace owner on Grow and Scale.</p><Link href="/dashboard/stores" className="mt-4 inline-flex min-h-11 items-center text-accent">Go to your stores →</Link></section>;
 const images=Array.isArray(item.images)?item.images.filter((url):url is string=>typeof url==="string").slice(0,30):[];
 const {data:jobs,error}=await db.from("catalog_training_jobs").select("id,status,image_count,image_revision,source_revision,review_status,error_code,budget_cents,created_at").eq("item_id",item.id).order("created_at",{ascending:false}).limit(1);if(error)throw new Error("Could not load product preparation status");
 const job=jobs?.[0],current=(job?.source_revision??job?.image_revision)===item.image_revision,photos=await trainingPhotos(item),admin=createAdminClient(),setup=trainingSetup();
 const {data:allowance,error:allowanceError}=await admin.from("catalog_training_limits").select("max_budget_cents,remaining_runs").eq("workspace_id",item.workspace_id).maybeSingle();if(allowanceError)throw new Error("Could not load training allowance");
 const {data:bindings,error:bindingError}=await admin.from("catalog_ad_bindings").select("status,catalog_stock_pauses(status,error_code)").eq("workspace_id",item.workspace_id).eq("item_id",item.id);if(bindingError)throw new Error("Could not load stock protection");
 const {data:sampleRows,error:sampleError}=job?await db.from("catalog_model_samples").select("scenario,status,storage_path").eq("job_id",job.id).eq("workspace_id",item.workspace_id).order("scenario"):{data:[],error:null};if(sampleError)throw new Error("Could not load sample photos");
 const samples=await Promise.all((sampleRows??[]).map(async s=>{let url:string|null=null;if(s.storage_path){const {data,error}=await admin.storage.from("catalog-model-review").createSignedUrl(s.storage_path,3600);if(error)throw new Error("Could not load sample photo");url=data?.signedUrl??null;}return {scenario:s.scenario,status:s.status,url};}));
 const {data:adAccounts,error:accountError}=await admin.from("catalog_ad_accounts").select("id,name,provider").eq("workspace_id",item.workspace_id).eq("enabled",true);if(accountError)throw new Error("Could not load ad accounts");
 return <><div className="mt-6 flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">{item.name}</h2><p className="mt-2 text-sm text-muted">{images.length} imported photos{item.inventory_quantity===0?" · Out of stock":""}</p></div>{item.inventory_quantity!==0&&<Link href={"/dashboard?url="+encodeURIComponent(item.product_url)+"#add"} className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm">Create ads from this product →</Link>}</div>
 <PhotoReview key={item.image_revision+photos.length} itemId={item.id} images={photos.map(p=>p.url)} includeUploads showPhotos={false}/>
 <TrainingPanel key={item.image_revision+photos.map(p=>p.key).join()} itemId={item.id} revision={item.image_revision} photos={photos.map(({key,url})=>({key,url}))} job={current?job??null:null} samples={current?samples:[]} configured={setup.configured} spendingEnabled={setup.spendingEnabled&&trainingAllowed(item.workspace_id,item.product_url)} budgetCents={allowance?.remaining_runs?allowance.max_budget_cents:null}/>
 {job&&!current&&<p role="status" className="mt-4 text-sm text-warn">Your store photos changed. Prepare and review a current photo selection before using a product model.</p>}
 <section className="edge mt-6 p-6"><h2 className="text-lg font-semibold">Stock protection</h2><p className="mt-2 text-sm font-medium">{stockLabel(item.inventory_quantity)}</p><p className="mt-2 text-sm text-muted">{bindings?.length?bindings.length+" linked paid ad(s) · "+bindings.filter(b=>b.status==="paused").length+" confirmed paused":"No paid ads are linked to this product. Automatic paid-ad pausing requires an authorized Meta or TikTok ad account and product-linked ads."}</p>{bindings?.some(b=>b.catalog_stock_pauses?.some(p=>p.status==="pending"))&&<p role="status" className="mt-3 text-sm text-warn">A pause is awaiting platform confirmation. Check your ad account until it is confirmed.</p>}<PaidAdLinker itemId={item.id} accounts={adAccounts??[]}/><p className="mt-3 text-xs text-muted">Restocking does not restart ads automatically.</p></section></>;
}
