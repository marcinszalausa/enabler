import {createHash} from "node:crypto";
import {parsePublicHttpUrl} from "../public-fetch.ts";
import type {CatalogConnection,CatalogProduct} from "./normalize.ts";
import {canonicalProduct} from "./normalize.ts";
export function websiteOrigin(raw:unknown){
 if(typeof raw!=="string"||raw.length>2048)throw new Error("CATALOG_WEBSITE_INVALID");
 const url=parsePublicHttpUrl(/^https?:\/\//i.test(raw.trim())?raw.trim():"https://"+raw.trim());
 if(url.protocol!=="https:")throw new Error("CATALOG_HTTPS_REQUIRED");return url.origin;
}
export function sameStoreUrl(raw:string,origin:string,base=origin):string|null{
 try{const url=parsePublicHttpUrl(new URL(raw.replaceAll("&amp;","&"),base));if(url.protocol!=="https:"||url.origin!==origin)return null;url.hash="";return url.toString();}catch{return null;}
}
export function sitemapLinks(xml:string,origin:string){
 return [...xml.matchAll(/<loc(?:\s[^>]*)?>([\s\S]*?)<\/loc>/gi)].slice(0,5000).map(m=>sameStoreUrl(m[1].trim().replace(/^<!\[CDATA\[|\]\]>$/g,""),origin)).filter((s):s is string=>!!s);
}
export function pageLinks(html:string,origin:string){
 return [...html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi)].slice(0,2000).map(m=>sameStoreUrl(m[1],origin)).filter((s):s is string=>!!s);
}
export function catalogCandidates(urls:string[],origin:string){
 const unique=[...new Set(urls.map(u=>sameStoreUrl(u,origin)).filter((s):s is string=>!!s))].filter(u=>{
 const x=new URL(u);return x.pathname!=="/"&&!/\.(xml|jpe?g|png|webp|pdf|zip|js|css)$/i.test(x.pathname)&&!/^\/(cart|checkout|account|login|privacy|policies|blog|blogs|news)(\/|$)/i.test(x.pathname);
 });
 return unique.sort((a,b)=>Number(/\/(products?|product-page|shop|store|p)\//i.test(new URL(b).pathname))-Number(/\/(products?|product-page|shop|store|p)\//i.test(new URL(a).pathname))).slice(0,100);
}
type Rule={allow:boolean;path:string};
export function robotsRules(text:string):Rule[]{
 const groups:{agents:string[];rules:Rule[]}[]=[];let current={agents:[] as string[],rules:[] as Rule[]};
 for(const line of text.split(/\r?\n/)){
  const [raw,...values]=line.split("#")[0].split(":");const key=raw.trim().toLowerCase(),value=values.join(":").trim();
  if(key==="user-agent"){if(current.rules.length){groups.push(current);current={agents:[],rules:[]};}current.agents.push(value.toLowerCase());}
  else if(["allow","disallow"].includes(key)&&value&&current.agents.length)current.rules.push({allow:key==="allow",path:value});
 }
 groups.push(current);const specific=groups.filter(g=>g.agents.includes("gooidybot"));return (specific.length?specific:groups.filter(g=>g.agents.includes("*"))).flatMap(g=>g.rules);
}
export function robotsAllow(url:string,rules:Rule[]){
 const path=new URL(url).pathname+new URL(url).search;
 const matches=rules.filter(r=>{const regex=r.path.split("*").map(p=>p.replace(/[.+?^\x24{}()|[\]\\]/g,"\\$&")).join(".*");try{return new RegExp("^"+regex.replace(/\\\x24$/,"$")).test(path);}catch{return false;}});
 matches.sort((a,b)=>b.path.length-a.path.length||Number(b.allow)-Number(a.allow));return matches[0]?.allow??true;
}
export function websiteProduct(html:string,url:string,c:CatalogConnection,observedAt:string):CatalogProduct|null{
 const nodes:unknown[]=[];
 for(const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  if(nodes.length>1000)break;try{nodes.push(JSON.parse(match[1]));}catch{}
 }
 let visited=0;
 while(nodes.length&&visited++<1000){
  const node=nodes.shift();if(Array.isArray(node)){nodes.push(...node.slice(0,1000));continue;}if(!node||typeof node!=="object")continue;
  const p=node as Record<string,unknown>,types=Array.isArray(p["@type"])?p["@type"]:[p["@type"]];
  if(types.some(t=>typeof t==="string"&&(t==="Product"||t.endsWith("/Product")))){
   const raw=Array.isArray(p.image)?p.image:[p.image];
   const images=raw.map(x=>typeof x==="string"?x:x&&typeof x==="object"?(x as Record<string,unknown>).url:null).filter((x):x is string=>typeof x==="string").flatMap(x=>{try{const u=parsePublicHttpUrl(new URL(x,url));return u.protocol==="https:"?[u.toString()]:[];}catch{return [];}});
   if(typeof p.name!=="string"||!images.length)continue;
   return canonicalProduct({externalId:createHash("sha256").update(url).digest("hex"),url,name:p.name.slice(0,300),images:[...new Set(images)].slice(0,30),inventoryQuantity:null,updatedAt:observedAt},c);
  }
  for(const value of Object.values(p))if(value&&typeof value==="object")nodes.push(value);
 }
 return null;
}
