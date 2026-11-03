// A tab-local navigation hint, never authorization or permission to publish.
export type AdChoice={workspaceId:string;productId:string;generationId:string;creativeId:string;savedAt:number};
export const AD_CHOICE_KEY="gooidy:ad-choice:v1";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Store=Pick<Storage,"getItem"|"setItem"|"removeItem">;
export function parseAdChoice(raw:string|null,workspaceId?:string,now=Date.now()):AdChoice|null{
 try{
  const value=JSON.parse(raw??"null");
  if(!value||typeof value!=="object"||["workspaceId","productId","generationId","creativeId"].some(k=>typeof value[k]!=="string"||!uuid.test(value[k]))
   ||typeof value.savedAt!=="number"||!Number.isFinite(value.savedAt)||value.savedAt>now||now-value.savedAt>24*60*60*1000
   ||(workspaceId!==undefined&&value.workspaceId!==workspaceId))return null;
  return {workspaceId:value.workspaceId,productId:value.productId,generationId:value.generationId,creativeId:value.creativeId,savedAt:value.savedAt};
 }catch{return null;}
}
export function readAdChoice(storage:Store,workspaceId:string):AdChoice|null{try{return parseAdChoice(storage.getItem(AD_CHOICE_KEY),workspaceId);}catch{return null;}}
export function rememberAdChoice(storage:Store,choice:Omit<AdChoice,"savedAt">):void{
 try{const value={...choice,savedAt:Date.now()};if(parseAdChoice(JSON.stringify(value),choice.workspaceId))storage.setItem(AD_CHOICE_KEY,JSON.stringify(value));}catch{}
}
export function clearAdChoice(storage:Store,generationId:string,creativeId:string):void{
 try{const value=parseAdChoice(storage.getItem(AD_CHOICE_KEY));if(value?.generationId===generationId&&value.creativeId===creativeId)storage.removeItem(AD_CHOICE_KEY);}catch{}
}
export function adChoicePath(choice:AdChoice):string{
 return "/dashboard/products/"+encodeURIComponent(choice.productId)+"?"+new URLSearchParams({favorite:choice.creativeId})+"#ad-"+encodeURIComponent(choice.generationId);
}
