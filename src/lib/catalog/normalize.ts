import {createHash} from "node:crypto";
import {parsePublicHttpUrl} from "../public-fetch.ts";
export type CatalogProduct={externalId:string;url:string;name:string;images:string[];inventoryQuantity:number|null;updatedAt:string;imageRevision:string};
export type CatalogConnection={id:string;workspace_id:string;platform:string;store_origin:string;webhook_domain:string;enabled:boolean};
const object=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=="object"||Array.isArray(v))throw new Error("CATALOG_OBJECT_REQUIRED");return v as Record<string,unknown>;};
function text(v:unknown,max:number){if(typeof v!=="string"||!v.trim()||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))throw new Error("CATALOG_TEXT_INVALID");return v.trim();}
function url(v:unknown){const u=parsePublicHttpUrl(text(v,4096));if(u.protocol!=="https:")throw new Error("CATALOG_HTTPS_REQUIRED");return u.toString();}
function date(v:unknown){const s=text(v,80);if(!/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(s)||!Number.isFinite(Date.parse(s))||Date.parse(s)>Date.now()+300000)throw new Error("CATALOG_TIMESTAMP_INVALID");return new Date(s).toISOString();}
export function canonicalProduct(value:unknown,connection:CatalogConnection):CatalogProduct{
 const p=object(value);if(typeof p.externalId!=="string"&&(typeof p.externalId!=="number"||!Number.isSafeInteger(p.externalId)))throw new Error("CATALOG_EXTERNAL_ID_INVALID");const productUrl=url(p.url);if(new URL(productUrl).origin!==connection.store_origin)throw new Error("CATALOG_STORE_MISMATCH");
 if(!Array.isArray(p.images)||p.images.length>30)throw new Error("CATALOG_IMAGES_INVALID");
 const images=[...new Set(p.images.map(url))].sort();
 let quantity:number|null=null;if(p.inventoryQuantity!==null&&p.inventoryQuantity!==undefined){if(!Number.isSafeInteger(p.inventoryQuantity)||Number(p.inventoryQuantity)<0||Number(p.inventoryQuantity)>2147483647)throw new Error("CATALOG_INVENTORY_INVALID");quantity=Number(p.inventoryQuantity);}
 return {externalId:text(String(p.externalId??""),128),url:productUrl,name:text(p.name,300),images,inventoryQuantity:quantity,updatedAt:date(p.updatedAt),imageRevision:createHash("sha256").update(JSON.stringify(images)).digest("hex")};
}
export function catalogWebhook(body:unknown,c:CatalogConnection,topic:string):CatalogProduct[]{
 const p=object(body);
 if(c.platform==="shopify"){
  if(!["products/create","products/update"].includes(topic)||typeof p.handle!=="string"||!Array.isArray(p.images)||!Array.isArray(p.variants))throw new Error("CATALOG_SHOPIFY_TOPIC_OR_PRODUCT_INVALID");
  const variants=p.variants.map(object);let inventory:number|null=0;for(const v of variants){if(!v.inventory_management||!Number.isSafeInteger(v.inventory_quantity)){inventory=null;break;}inventory+=Math.max(0,Number(v.inventory_quantity));}
  return [canonicalProduct({externalId:p.id,url:c.store_origin+"/products/"+encodeURIComponent(p.handle),name:p.title,images:p.images.map(v=>object(v).src),inventoryQuantity:inventory,updatedAt:p.updated_at},c)];
 }
 if(c.platform==="woocommerce"){
  if(!["product.created","product.updated"].includes(topic)||!Array.isArray(p.images))throw new Error("CATALOG_WOO_PRODUCT_INVALID");
  return [canonicalProduct({externalId:p.id,url:p.permalink,name:p.name,images:p.images.map(v=>object(v).src),inventoryQuantity:p.stock_status==="outofstock"?0:p.stock_quantity,updatedAt:typeof p.date_modified_gmt==="string"?p.date_modified_gmt+"Z":null},c)];
 }
 if(!Array.isArray(p.products)||p.products.length<1||p.products.length>250)throw new Error("CATALOG_PRODUCTS_INVALID");
 const result=p.products.map(v=>canonicalProduct(v,c));if(new Set(result.map(v=>v.externalId)).size!==result.length)throw new Error("CATALOG_DUPLICATE_PRODUCT");return result;
}
// Canonical CSV contract. Quoted cells and embedded newlines are supported; arbitrary platform exports need an adapter.
export function catalogCsv(csv:string,c:CatalogConnection):CatalogProduct[]{
 if(Buffer.byteLength(csv)>1048576)throw new Error("CATALOG_CSV_TOO_LARGE");
 const rows:string[][]=[];let row:string[]=[],cell="",quoted=false,closed=false;
 for(let i=0;i<csv.length;i++){const ch=csv[i];if(quoted){if(ch==='"'){if(csv[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=ch;}
 else if(ch==='"'&&!cell&&!closed)quoted=true;
 else if(ch===","||ch==="\n"||ch==="\r"){row.push(cell);cell="";closed=false;if(ch!==","){if(ch==="\r"&&csv[i+1]==="\n")i++;if(row.some(v=>v!==""))rows.push(row);row=[];}}
 else {if(closed)throw new Error("CATALOG_CSV_QUOTES");cell+=ch;}if(rows.length>251||cell.length>32768)throw new Error("CATALOG_CSV_LIMIT");}
 if(quoted)throw new Error("CATALOG_CSV_QUOTES");row.push(cell);if(row.some(v=>v!==""))rows.push(row);
 const header=rows.shift()?.map(v=>v.replace(/^\uFEFF/,"").trim());const required=["external_id","url","name","images","inventory_quantity","updated_at"];
 if(!header||header.length!==6||new Set(header).size!==6||required.some(k=>!header.includes(k))||rows.length<1||rows.length>250)throw new Error("CATALOG_CSV_HEADERS");
 const products=rows.map(r=>{if(r.length!==header.length)throw new Error("CATALOG_CSV_COLUMNS");const p=Object.fromEntries(header.map((h,i)=>[h,r[i]]));return canonicalProduct({externalId:p.external_id,url:p.url,name:p.name,images:p.images?p.images.split("|"):[],inventoryQuantity:p.inventory_quantity===""?null:Number(p.inventory_quantity),updatedAt:p.updated_at},c);});
 if(new Set(products.map(p=>p.externalId)).size!==products.length)throw new Error("CATALOG_DUPLICATE_PRODUCT");return products;
}
