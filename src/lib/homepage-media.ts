import data from "./homepage-media.json";
import type {ShowcaseRun} from "./showcase";
export type HomepageImage={src:string;small:string;width:number;height:number;placeholder:string};
const images=data.images as Record<string,HomepageImage>;
const videos=data.videos as Record<string,{src:string;poster:string;bytes:number}>;
const photos=data.photos as Record<string,HomepageImage>;
const assets=[...Object.values(images),...Object.values(photos),...Object.values(data.posters)];
export function homepageAsset(src:string){return assets.find(asset=>asset.src===src);}
export function homepageImage(id:string){return images[id]?.src??"";}
export function homepageVideo(id:string){return videos[id];}
export function homepagePhoto(url:string){return photos[url]?.src;}
const order=data.selection;
export function curateHomepageRuns(runs:ShowcaseRun[]):ShowcaseRun[]{
 return runs.map(run=>({...run,ads:run.ads.filter(ad=>images[ad.id]||videos[ad.id]).sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id))}))
 .filter(run=>run.ads.length>0).sort((a,b)=>order.indexOf(a.ads[0].id)-order.indexOf(b.ads[0].id));
}
