// Text paints only inside selected rectangles that avoid all expanded face
// boxes. Unknown detection or a crowded frame produces a photo-only fallback.
export const FACE_SAFE_LAYOUT_VERSION="face-aware-v2";
export type Rect={x:number;y:number;width:number;height:number};
export type TextRegion=Rect&{fontSize:number};
export type OverlayPlan={headline:TextRegion|null;cta:Rect|null;logo:Rect|null};
export const NO_OVERLAYS:OverlayPlan={headline:null,cta:null,logo:null};
export function overlaps(a:Rect,b:Rect){return a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;}
export function protectFaces(faces:Rect[],width:number,height:number):Rect[]{
 return faces.filter(f=>[f.x,f.y,f.width,f.height].every(Number.isFinite)&&f.width>0&&f.height>0).map(f=>{
  const mx=Math.max(32,f.width*.3),my=Math.max(40,f.height*.4);
  const x=Math.max(0,Math.floor(f.x-mx)),y=Math.max(0,Math.floor(f.y-my));
  return {x,y,width:Math.max(0,Math.min(width,Math.ceil(f.x+f.width+mx))-x),height:Math.max(0,Math.min(height,Math.ceil(f.y+f.height+my))-y)};
 });
}
export function chooseOverlays(aspect:"1:1"|"9:16",faces:Rect[]|null,options:{headline?:boolean;cta?:string;logo?:boolean;rtl?:boolean}={},blocked:Rect[]=[]):OverlayPlan{
 if(faces===null)return {...NO_OVERLAYS};
 const width=1080,height=aspect==="9:16"?1920:1080,story=aspect==="9:16",pad=72,top=story?150:64,bottom=height-(story?240:64);
 const forbidden=[...protectFaces(faces,width,height),...blocked],used:Rect[]=[];
 const clear=(r:Rect)=>r.x>=pad&&r.y>=top&&r.x+r.width<=width-pad&&r.y+r.height<=bottom&&!forbidden.some(f=>overlaps(r,f))&&!used.some(f=>overlaps(r,f));
 const headH=story?224:188,sideH=story?300:260;
 const candidates:TextRegion[]=[];
 for(const config of [{height:headH,side:sideH,font:story?72:60,small:story?54:48},{height:story?184:144,side:story?248:208,font:story?64:52,small:story?48:42}]){
  const ys=[top,Math.round(height*.34),Math.round(height*.51),bottom-config.height-136,...forbidden.flatMap(f=>[Math.ceil(f.y+f.height+16),Math.floor(f.y-config.height-16)])];
  for(const y of [...new Set(ys)]){candidates.push({x:pad,y,width:936,height:config.height,fontSize:config.font});for(const x of options.rtl?[568,pad]:[pad,568])candidates.push({x,y,width:440,height:config.side,fontSize:config.small});}
 }
 const headline=options.headline===false?null:candidates.find(clear)??null;if(headline)used.push(headline);
 const ctaWidth=Math.min(600,Math.max(240,Array.from(options.cta??"").length*32+88)),ctaHeight=104;
 const controlsY=[bottom-ctaHeight,Math.round(height*.7),top+headH+32,Math.round(height*.48)];
 const controlX=options.rtl?[width-pad-ctaWidth,pad]:[pad,width-pad-ctaWidth];
 const cta=options.cta?controlsY.flatMap(y=>controlX.map(x=>({x,y,width:ctaWidth,height:ctaHeight}))).find(clear)??null:null;if(cta)used.push(cta);
 const logo=options.logo?controlsY.flatMap(y=>[width-pad-200,pad].map(x=>({x,y,width:200,height:100}))).find(clear)??null:null;
 return {headline,cta,logo};
}
export function chooseCaption(aspect:"1:1"|"9:16",faces:Rect[]|null,blocked:Rect[]=[]):Rect|null{
 if(faces===null)return null;
 const height=aspect==="9:16"?1920:1080,regions=protectFaces(faces,1080,height);
 for(const y of [height-440,height-660,Math.round(height*.48),320,160]){
  const r={x:72,y,width:840,height:164};
  if(y>=140&&y+r.height<=height-220&&!regions.some(f=>overlaps(r,f))&&!blocked.some(f=>overlaps(r,f)))return r;
 }
 return null;
}
