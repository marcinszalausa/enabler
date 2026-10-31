// Transparent, clipped copy regions chosen against every face in a shot.
import {AD_SIZES,AdLayout,Copy,adTextStyles,type AdLayoutProps,type AdText,type TextStyle} from "@/lib/ad-layout";
import type {Rect,TextRegion} from "@/lib/face-safe-layout";
const SIZE=AD_SIZES["9:16"];
export const VIDEO_TEXT_STYLES={
 hook:{...adTextStyles("9:16","white").headline,fontSize:72,maxWidth:936},
 caption:{fontSize:52,lineHeight:1.2,maxWidth:780,color:"white",align:"center",shadow:false},
} satisfies Record<string,TextStyle>;
export function HookLayer(p:{headline:AdText;fontFamily:string;rtl?:boolean;region:TextRegion|null}){
 const r=p.region;
 return <div style={{...SIZE,display:"flex",position:"relative",fontFamily:p.fontFamily}}>{r&&<div style={{position:"absolute",left:r.x,top:r.y,width:r.width,height:r.height,display:"flex",overflow:"hidden",alignItems:"center",justifyContent:p.rtl?"flex-end":"flex-start",flexWrap:"wrap",color:"white",fontSize:r.fontSize,fontWeight:700,lineHeight:1.1,textShadow:"0 2px 12px rgba(0,0,0,.8)",backgroundImage:"linear-gradient(to bottom,rgba(0,0,0,.3),rgba(0,0,0,0))"}}><Copy text={p.headline}/></div>}</div>;
}
export function CaptionLayer(p:{text:AdText;fontFamily:string;region:Rect|null}){
 const r=p.region;
 return <div style={{...SIZE,display:"flex",position:"relative",fontFamily:p.fontFamily}}>{r&&<div style={{position:"absolute",left:r.x,top:r.y,width:r.width,height:r.height,display:"flex",overflow:"hidden",alignItems:"center",justifyContent:"center"}}>
 <div style={{display:"flex",maxWidth:r.width,maxHeight:r.height,overflow:"hidden",textAlign:"center",justifyContent:"center",color:"white",fontSize:52,fontWeight:700,lineHeight:1.2,padding:"14px 30px",borderRadius:20,background:"rgba(0,0,0,.55)"}}><Copy text={p.text}/></div></div>}</div>;
}
export function EndCardLayer(p:Omit<AdLayoutProps,"photoUrl"|"aspect">){return <AdLayout {...p} photoUrl={null} aspect="9:16"/>;}
