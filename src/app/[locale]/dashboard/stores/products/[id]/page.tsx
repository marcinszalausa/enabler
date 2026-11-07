import {Suspense} from "react";
import Link from "next/link";
import {notFound} from "next/navigation";
import {isLocale} from "@/i18n/config";
import {getCurrentUser} from "@/lib/auth";
import {createClient} from "@/lib/supabase/server";
import {photoReviewItem} from "@/lib/catalog/photo-access";
import {PhotoReview} from "./photo-review";
export const metadata={title:"Product photos | Gooidy",robots:{index:false,follow:false}};
export default function ProductPhotosPage({params}:PageProps<"/[locale]/dashboard/stores/products/[id]">){
 return <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10"><Link href="/dashboard/stores" className="inline-flex min-h-11 items-center text-sm text-accent">← Your stores</Link><h1 className="mt-5 text-3xl font-semibold tracking-tight">Product photos</h1><Suspense fallback={<p role="status" className="mt-8 text-muted">Loading your product…</p>}><ProductPhotos params={params}/></Suspense></main>;
}
const trainingLabels:Record<string,string>={queued:"Waiting for photo preparation",blocked:"Photos or setup need attention",dataset_ready:"Photos prepared · training has not started",submitting:"Training request being confirmed",submission_unknown:"Training request needs confirmation · do not resubmit",running:"Training in progress",succeeded:"Training finished · sample ads still need review",failed:"Training did not finish",cancel_pending:"Waiting for cancellation confirmation",canceled:"Training canceled"};
async function ProductPhotos({params}:{params:PageProps<"/[locale]/dashboard/stores/products/[id]">["params"]}){
 const {id,locale}=await params;if(!isLocale(locale))notFound();await getCurrentUser();const db=await createClient(),item=await photoReviewItem(db,id);
 if(!item)return <section className="edge mt-8 p-6"><h2 className="font-semibold">Open this product from a connected store</h2><p className="mt-2 text-sm text-muted">Photo checks are available to the workspace owner on Grow and Scale.</p><Link href="/dashboard/stores" className="mt-4 inline-flex min-h-11 items-center text-accent">Go to your stores →</Link></section>;
 const images=Array.isArray(item.images)?item.images.filter((url):url is string=>typeof url==="string").slice(0,30):[];
 const {data:jobs,error}=await db.from("catalog_training_jobs").select("id,status,image_count,image_revision,created_at").eq("item_id",item.id).order("created_at",{ascending:false}).limit(1);if(error)throw new Error("Could not load product preparation status");
 const job=jobs?.[0],current=job?.image_revision===item.image_revision;
 return <><div className="mt-6 flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">{item.name}</h2><p className="mt-2 text-sm text-muted">{images.length} imported photos{item.inventory_quantity===0?" · Out of stock":""}</p></div>{item.inventory_quantity!==0&&<Link href={"/dashboard?url="+encodeURIComponent(item.product_url)+"#add"} className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm">Create ads from this product →</Link>}</div>
 <PhotoReview itemId={item.id} images={images}/>
 <section className="mt-6 rounded-2xl border border-line p-6"><h2 className="text-lg font-semibold">Product-specific model</h2><p role="status" className="mt-2 text-sm text-muted">{job?(current?(trainingLabels[job.status]??"Check preparation status"):"Store photos changed since the last preparation. Check the latest photos above."):"No training has started for this product."}</p><p className="mt-3 text-sm text-muted">Training is not available to start here yet. The first model needs a reviewed photo set, a confirmed training budget, and sample ads checked for product accuracy before use.</p></section></>;
}
