import {NO_OVERLAYS,type OverlayPlan} from "@/lib/face-safe-layout";
// The finished ad as a Satori tree: photo, headline, call to action, logo.
// Kept free of server imports so it can be rendered in isolation.

export const AD_SIZES = {
  "1:1": { width: 1080, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
} as const;
export type AdAspect = keyof typeof AD_SIZES;

// Copy as Satori draws it, or as an image of it for scripts it can't shape
// (see ad-text.ts). `pad` is the blank margin around the drawn text.
export type AdText =
  | string
  | { src: string; width: number; height: number; pad: number };

export type TextStyle = {
  fontSize: number;
  lineHeight: number;
  maxWidth: number;
  color: string;
  align: "start" | "center";
  shadow: boolean;
};

const PAD_X = 72;

export function adTextStyles(aspect: AdAspect, accentTextColor: string, placement?:OverlayPlan) {
  return {
    headline: {
      fontSize: placement?.headline?.fontSize??(aspect === "9:16" ? 72 : 60),
      lineHeight: 1.1,
      maxWidth: placement?.headline?.width??AD_SIZES[aspect].width - PAD_X * 2,
      color: "white",
      align: "start",
      shadow: true,
    },
    cta: {
      fontSize: 40,
      lineHeight: 1.2,
      maxWidth: placement?.cta?placement.cta.width-64:536,
      color: accentTextColor,
      align: "start",
      shadow: false,
    },
  } satisfies Record<string, TextStyle>;
}

// Renders copy inside a flex box: text as is, or the image of it with its
// padding pulled back so the text lines up like Satori's would.
export function Copy({ text }: { text: AdText }) {
  if (typeof text === "string") return text;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Satori renders plain img
    <img
      src={text.src}
      width={text.width}
      height={text.height}
      style={{ margin: -text.pad }}
      alt=""
    />
  );
}

export type AdLayoutProps = {
  // Null renders only transparent overlays, for video footage.
  photoUrl: string | null;
  aspect: AdAspect;
  headline: AdText;
  cta: AdText;
  // Right-to-left copy (Arabic): text and button sit on the right.
  rtl?: boolean;
  fontFamily: string;
  accentColor: string;
  accentTextColor: string;
  logoUrl: string | null;
  placement?: OverlayPlan;
};

export function AdLayout(p:AdLayoutProps){
 const size=AD_SIZES[p.aspect],plan=p.placement??NO_OVERLAYS,styles=adTextStyles(p.aspect,p.accentTextColor,plan);
 return <div style={{...size,display:"flex",position:"relative",fontFamily:p.fontFamily}}>
 {p.photoUrl&&
 // eslint-disable-next-line @next/next/no-img-element -- full-frame generated image, already normalized server-side
 <img src={p.photoUrl} width={size.width} height={size.height} style={{position:"absolute",left:0,top:0,...size,objectFit:"cover"}} alt=""/>}
 {plan.headline&&<div style={{position:"absolute",left:plan.headline.x,top:plan.headline.y,width:plan.headline.width,height:plan.headline.height,display:"flex",overflow:"hidden",alignItems:"center",justifyContent:p.rtl?"flex-end":"flex-start",flexWrap:"wrap",color:"white",fontSize:styles.headline.fontSize,fontWeight:700,lineHeight:1.1,letterSpacing:-1,textShadow:"0 2px 12px rgba(0,0,0,.8)",backgroundImage:"linear-gradient(to bottom,rgba(0,0,0,.3),rgba(0,0,0,0))"}}><Copy text={p.headline}/></div>}
 {plan.cta&&<div style={{position:"absolute",left:plan.cta.x,top:plan.cta.y,width:plan.cta.width,height:plan.cta.height,display:"flex",overflow:"hidden",alignItems:"center",justifyContent:p.rtl?"flex-end":"flex-start"}}>
 <div style={{display:"flex",maxWidth:plan.cta.width,maxHeight:plan.cta.height,overflow:"hidden",background:p.accentColor,color:p.accentTextColor,fontSize:40,fontWeight:700,lineHeight:1.2,padding:"20px 32px",borderRadius:999}}><Copy text={p.cta}/></div></div>}
 {plan.logo&&p.logoUrl&&<div style={{position:"absolute",left:plan.logo.x,top:plan.logo.y,width:plan.logo.width,height:plan.logo.height,display:"flex",overflow:"hidden",alignItems:"center",justifyContent:"center"}}>
 <div style={{display:"flex",overflow:"hidden",background:"rgba(255,255,255,.94)",borderRadius:18,padding:"12px 10px"}}>
 {/* eslint-disable-next-line @next/next/no-img-element -- bounded brand chip selected away from faces */}
 <img src={p.logoUrl} width={180} height={60} style={{objectFit:"contain"}} alt=""/></div></div>}
 </div>;
}
