// Shared validation for a server-reserved, single-output revision snapshot.
export type CreativeRevision={version:1;source_id:string;kind:"image"|"video";aspect:"1:1"|"9:16";direction:string;storage_path:string;headline:string;primary_text:string;cta:string;angle:string};
export const REVISION_UUID=/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
export function parseCreativeRevision(value:unknown):CreativeRevision|null{
 if(!value||typeof value!=="object"||Array.isArray(value))return null;
 const v=value as Record<string,unknown>;
 if(v.version!==1||typeof v.source_id!=="string"||!REVISION_UUID.test(v.source_id)||!["image","video"].includes(String(v.kind))||!["1:1","9:16"].includes(String(v.aspect))||v.kind==="video"&&v.aspect!=="9:16")return null;
 for(const [key,max]of [["direction",240],["storage_path",1024],["headline",200],["primary_text",2000],["cta",100],["angle",40]] as const)if(typeof v[key]!=="string"||(v[key] as string).length>max)return null;
 if(!(v.direction as string).trim()||!(v.storage_path as string).trim())return null;
 return {version:1,source_id:v.source_id,kind:v.kind as CreativeRevision["kind"],aspect:v.aspect as CreativeRevision["aspect"],direction:(v.direction as string).trim(),storage_path:v.storage_path as string,headline:v.headline as string,primary_text:v.primary_text as string,cta:v.cta as string,angle:v.angle as string};
}
export function revisionFromOptions(options:unknown){return parseCreativeRevision((options as {revision?:unknown}|null|undefined)?.revision);}
export function revisionCampaign(revision:CreativeRevision){return {id:revision.source_id,name:"Single-ad revision",goal:"introduce" as const,message:(revision.headline||revision.primary_text||"Show the real product’s supported benefits").slice(0,240),offer:"",scene:revision.direction};}
