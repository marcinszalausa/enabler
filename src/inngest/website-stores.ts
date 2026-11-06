import {inngest} from "./client";
import {createAdminClient} from "@/lib/supabase/admin";
import {fetchPublicUrl} from "@/lib/public-fetch";
import {catalogCandidates,pageLinks,robotsAllow,robotsRules,sitemapLinks,websiteProduct} from "@/lib/catalog/website";
import {websiteStoresReady} from "@/lib/catalog/website-config";
import {canConnectStores,requireStorePlan} from "@/lib/catalog/access";
import {loadConnection,receiveCatalog} from "@/lib/catalog/store";
import type {CatalogConnection} from "@/lib/catalog/normalize";
import {createHash} from "node:crypto";
async function text(url:string,maxBytes=2000000){
 const result=await fetchPublicUrl(url,{maxBytes,timeoutMs:8000,accept:"text/html,application/xhtml+xml,application/xml,text/xml,text/plain"});
 return {status:result.status,url:result.url,text:result.body.toString("utf8")};
}
async function storeState(id:string,run:string){
 const {data,error}=await createAdminClient().from("website_stores").select("*").eq("id",id).eq("run_id",run).single();
 if(error||!data)throw new Error("CATALOG_STORE_CHANGED");await requireStorePlan(data.workspace_id);return data;
}
async function robots(origin:string){
 const response=await text(origin+"/robots.txt",65536);
 if(response.status===404)return [];
 if(response.status!==200)throw new Error("CATALOG_WEBSITE_UNAVAILABLE");
 return robotsRules(response.text);
}
async function discover(id:string,run:string){
 const db=createAdminClient(),store=await storeState(id,run);if(store.status!=="syncing"||store.discovered)return;
 let origin=store.origin,rules=await robots(origin);if(!robotsAllow(origin+"/",rules))throw new Error("CATALOG_WEBSITE_BLOCKED");
 const home=await text(origin);if(home.status!==200)throw new Error("CATALOG_WEBSITE_UNAVAILABLE");
 if(home.url.origin!==origin){origin=home.url.origin;rules=await robots(origin);if(!robotsAllow(origin+"/",rules))throw new Error("CATALOG_WEBSITE_BLOCKED");}
 const sources=[origin+"/sitemap.xml",origin+"/sitemap_index.xml"],candidates=pageLinks(home.text,origin);let fetched=0;
 while(sources.length&&fetched++<3){
  const url=sources.shift()!;if(!robotsAllow(url,rules))continue;
  const sitemap=await text(url).catch(()=>null);if(!sitemap||sitemap.status!==200||sitemap.url.origin!==origin)continue;
  const links=sitemapLinks(sitemap.text,origin);
  if(/<sitemapindex[\s>]/i.test(sitemap.text))sources.unshift(...links.sort((a,b)=>Number(/product/i.test(b))-Number(/product/i.test(a))).slice(0,2));
  else candidates.push(...links);
 }
 const urls=catalogCandidates(candidates,origin).filter(url=>robotsAllow(url,rules));if(!urls.length)throw new Error("CATALOG_NO_PUBLIC_PRODUCTS");
 const {error:connectionError}=await db.from("catalog_connections").update({store_origin:origin}).eq("id",store.connection_id).eq("enabled",true);if(connectionError)throw new Error("CATALOG_STORE_SAVE_FAILED");
 const {error}=await db.from("website_stores").update({origin,candidate_urls:urls,robots_rules:rules,discovered:true}).eq("id",id).eq("run_id",run).eq("status","syncing");if(error)throw new Error("CATALOG_STORE_SAVE_FAILED");
}
async function batch(id:string,run:string){
 const db=createAdminClient(),store=await storeState(id,run);if(store.status!=="syncing")return {done:true};
 const connection=await loadConnection(store.connection_id) as CatalogConnection;
 const urls=(store.candidate_urls as string[]).slice(store.cursor,store.cursor+5),products=[];
 for(const url of urls){
  if(!robotsAllow(url,store.robots_rules))continue;
  const response=await text(url).catch(()=>null);if(!response||response.status!==200||response.url.origin!==store.origin)continue;
  const product=websiteProduct(response.text,response.url.toString(),connection,store.sync_started_at);if(product)products.push(product);
 }
 if(products.length){
  const unique=[...new Map(products.map(p=>[p.externalId,p])).values()],body=Buffer.from(JSON.stringify(unique)),hash=createHash("sha256").update(body).digest("hex");
  const delivery=await receiveCatalog(connection,"website:"+run+":"+hash,body,unique);
  const {error}=await db.rpc("apply_catalog_delivery",{delivery});if(error)throw new Error("CATALOG_STORE_IMPORT_FAILED");
 }
 const cursor=store.cursor+urls.length,done=cursor>=store.candidate_urls.length;
 const {count,error:countError}=await db.from("catalog_items").select("id",{count:"exact",head:true}).eq("connection_id",store.connection_id);if(countError)throw new Error("CATALOG_STORE_READ_FAILED");
 const empty=done&&!count;
 const {error}=await db.from("website_stores").update({cursor,status:empty?"error":done?"connected":"syncing",synced_at:done?new Date().toISOString():null,error_code:empty?"CATALOG_NO_PUBLIC_PRODUCTS":null}).eq("id",id).eq("run_id",run).eq("status","syncing");
 if(error)throw new Error("CATALOG_STORE_SAVE_FAILED");return {done};
}
export const importWebsiteStore=inngest.createFunction({id:"website-store-import",triggers:{event:"catalog/website.requested"},retries:2,concurrency:[{limit:2},{limit:1,key:"event.data.storeId"}],onFailure:async({event})=>{
 const data=event.data.event.data;const {error}=await createAdminClient().from("website_stores").update({status:"error",error_code:"CATALOG_STORE_IMPORT_INTERRUPTED"}).eq("id",String(data.storeId)).eq("run_id",String(data.runId)).eq("status","syncing");if(error)throw new Error("CATALOG_STORE_SAVE_FAILED");
}},async({event,step})=>{
 if(!websiteStoresReady())return {disabled:true};
 const id=String(event.data.storeId??""),run=String(event.data.runId??"");if(!/^[a-f0-9-]{36}$/.test(id)||!/^[a-f0-9-]{36}$/.test(run))throw new Error("CATALOG_STORE_INVALID");
 await step.run("discover-products",()=>discover(id,run));
 for(let i=0;i<20;i++){const result=await step.run("import-"+i,()=>batch(id,run));if(result.done)return result;await step.sleep("polite-delay-"+i,"2s");}
 return {resumable:true};
});
export const recoverWebsiteStores=inngest.createFunction({id:"website-store-recovery",triggers:{cron:"*/5 * * * *"},retries:2,concurrency:{limit:1}},async({step})=>{
 if(!websiteStoresReady())return {disabled:true};
 const stores=await step.run("pending",async()=>{const {data,error}=await createAdminClient().from("website_stores").select("id,workspace_id,run_id").eq("status","syncing").order("sync_started_at").limit(25);if(error)throw new Error("CATALOG_STORE_READ_FAILED");const eligible=[];for(const s of data??[])if(await canConnectStores(s.workspace_id))eligible.push(s);return eligible;});
 if(stores.length)await step.sendEvent("resume",stores.map(s=>({id:"website-"+s.run_id+"-"+Math.floor(Date.now()/300000),name:"catalog/website.requested",data:{storeId:s.id,runId:s.run_id}})));
 return {queued:stores.length};
});
