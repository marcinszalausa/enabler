// Transparent copy layers never paint into the protected footage window.
import {AD_SIZES,AdLayout,Copy,adTextStyles,type AdLayoutProps,type AdText,type TextStyle} from "@/lib/ad-layout";
import {VIDEO_REGIONS,MEDIA_BACKGROUND} from "@/lib/face-safe-layout";
const SIZE=AD_SIZES["9:16"];
export const VIDEO_TEXT_STYLES={
 hook:{...adTextStyles("9:16","white").headline,fontSize:56,maxWidth:VIDEO_REGIONS.hook.width},
 caption:{fontSize:52,lineHeight:1.2,maxWidth:VIDEO_REGIONS.caption.width-60,color:"white",align:"center",shadow:false},
} satisfies Record<string,TextStyle>;
export function HookLayer(p:{headline:AdText;fontFamily:string;rtl?:boolean}){
 const r=VIDEO_REGIONS.hook;
 return <div style={{...SIZE,display:"flex",position:"relative",fontFamily:p.fontFamily}}>
 <div style={{position:"absolute",left:r.x,top:r.y,width:r.width,height:r.height,display:"flex",overflow:"hidden",flexWrap:"wrap",alignItems:"center",justifyContent:p.rtl?"flex-end":"flex-start",color:"white",fontSize:VIDEO_TEXT_STYLES.hook.fontSize,fontWeight:700,lineHeight:1.1}}><Copy text={p.headline}/></div></div>;
}
export function CaptionLayer(p:{text:AdText;fontFamily:string}){
 const r=VIDEO_REGIONS.caption;
 return <div style={{...SIZE,display:"flex",position:"relative",fontFamily:p.fontFamily}}>
 <div style={{position:"absolute",left:r.x,top:r.y,width:r.width,height:r.height,display:"flex",overflow:"hidden",alignItems:"center",justifyContent:"center"}}>
 <div style={{display:"flex",maxWidth:r.width,maxHeight:r.height,overflow:"hidden",textAlign:"center",justifyContent:"center",color:"white",fontSize:VIDEO_TEXT_STYLES.caption.fontSize,fontWeight:700,lineHeight:1.2,padding:"14px 30px",borderRadius:20,background:"rgba(0,0,0,0.55)"}}><Copy text={p.text}/></div></div></div>;
}
export function EndCardLayer(p:Omit<AdLayoutProps,"photoUrl"|"aspect">){
 return <div style={{...SIZE,display:"flex",position:"relative",background:MEDIA_BACKGROUND}}><AdLayout {...p} photoUrl={null} aspect="9:16"/></div>;
}
