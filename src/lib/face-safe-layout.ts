// Media and copy occupy disjoint rectangles. No detector or model guess is
// needed: all source pixels stay inside the media window, including motion.
export const FACE_SAFE_LAYOUT_VERSION="face-safe-v1";
export type Rect={x:number;y:number;width:number;height:number};
export const IMAGE_REGIONS={
 "1:1":{media:{x:0,y:240,width:1080,height:680},headline:{x:72,y:28,width:936,height:184},footer:{x:72,y:936,width:936,height:116}},
 "9:16":{media:{x:0,y:300,width:1080,height:1180},headline:{x:72,y:40,width:936,height:220},footer:{x:72,y:1528,width:936,height:116}},
} as const;
export const VIDEO_REGIONS={
 media:{x:0,y:0,width:1080,height:1360},
 hook:{x:72,y:1380,width:936,height:144},
 caption:{x:72,y:1536,width:936,height:164},
} as const;
export const MEDIA_BACKGROUND="#10121c";
export function overlaps(a:Rect,b:Rect){return a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;}
