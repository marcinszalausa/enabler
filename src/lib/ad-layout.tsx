import {IMAGE_REGIONS,MEDIA_BACKGROUND} from "@/lib/face-safe-layout";
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

export function adTextStyles(aspect: AdAspect, accentTextColor: string) {
  return {
    headline: {
      fontSize: aspect === "9:16" ? 72 : 60,
      lineHeight: 1.1,
      maxWidth: AD_SIZES[aspect].width - PAD_X * 2,
      color: "white",
      align: "start",
      shadow: false,
    },
    cta: {
      fontSize: 44,
      lineHeight: 1.2,
      maxWidth: 640,
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
  // Null renders an opaque closing card; no footage shows through the copy.
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
};

export function AdLayout(p: AdLayoutProps) {
 const size=AD_SIZES[p.aspect],regions=IMAGE_REGIONS[p.aspect],story=p.aspect==="9:16";
 const headline=p.photoUrl?regions.headline:{x:72,y:story?540:200,width:936,height:story?420:300};
 const footer=p.photoUrl?regions.footer:{x:72,y:story?1120:660,width:936,height:116};
 const styles=adTextStyles(p.aspect,p.accentTextColor);
 return <div style={{...size,display:"flex",position:"relative",fontFamily:p.fontFamily,background:MEDIA_BACKGROUND}}>
  {p.photoUrl&&<div style={{position:"absolute",left:regions.media.x,top:regions.media.y,width:regions.media.width,height:regions.media.height,display:"flex",overflow:"hidden",alignItems:"center",justifyContent:"center"}}>
   {/* eslint-disable-next-line @next/next/no-img-element -- Satori embeds the complete photo inside a protected window */}
   <img src={p.photoUrl} width={regions.media.width} height={regions.media.height} style={{objectFit:"contain"}} alt=""/>
  </div>}
  <div style={{position:"absolute",left:headline.x,top:headline.y,width:headline.width,height:headline.height,display:"flex",overflow:"hidden",flexWrap:"wrap",alignItems:"center",justifyContent:p.rtl?"flex-end":"flex-start",color:"white",fontSize:styles.headline.fontSize,fontWeight:700,lineHeight:styles.headline.lineHeight,letterSpacing:-1}}>
   <Copy text={p.headline}/>
  </div>
  <div style={{position:"absolute",left:footer.x,top:footer.y,width:footer.width,height:footer.height,display:"flex",overflow:"hidden",flexDirection:p.rtl?"row-reverse":"row",alignItems:"center",justifyContent:"space-between",gap:20}}>
   <div style={{display:"flex",maxWidth:640,maxHeight:108,overflow:"hidden",background:p.accentColor,color:p.accentTextColor,fontSize:44,fontWeight:700,lineHeight:1.2,padding:"22px 44px",borderRadius:999}}>
    <Copy text={p.cta}/>
   </div>
   {p.logoUrl&&<div style={{display:"flex",alignItems:"center",maxWidth:320,maxHeight:104,overflow:"hidden",background:"white",borderRadius:24,padding:"16px 24px"}}>
    {/* eslint-disable-next-line @next/next/no-img-element -- bounded brand mark in its own footer */}
    <img src={p.logoUrl} height={72} style={{maxWidth:272,objectFit:"contain"}} alt=""/>
   </div>}
  </div>
 </div>;
}
