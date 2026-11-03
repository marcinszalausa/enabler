export const LIBRARY_PAGE_SIZE=24;
export type LibraryFilter={kind:"all"|"image"|"video";favorites:boolean;page:number};
export function libraryFilter(input:Record<string,string|string[]|undefined>):LibraryFilter{
 const page=typeof input.page==="string"&&/^[1-9][0-9]{0,3}$/.test(input.page)?Number(input.page):1;
 return {kind:input.kind==="image"||input.kind==="video"?input.kind:"all",favorites:input.favorites==="1",page};
}
export function libraryPath(filter:LibraryFilter):string{
 const q=new URLSearchParams();
 if(filter.kind!=="all")q.set("kind",filter.kind);
 if(filter.favorites)q.set("favorites","1");
 if(filter.page>1)q.set("page",String(filter.page));
 return "/dashboard/ads"+(q.size?"?"+q:"");
}
export type LibraryAd={
 id:string;workspaceId:string;generationId:string;productId:string;productName:string;
 kind:"image"|"video";aspect:string;headline:string|null;caption:string|null;createdAt:string;favorite:boolean;
};
