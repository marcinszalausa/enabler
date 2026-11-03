"use client";

import Image, {type ImageProps} from "next/image";
import {useState} from "react";
import {homepageAsset,type HomepageImage} from "@/lib/homepage-media";
import {publicAdPreview,publicAdRetry} from "@/lib/public-ad-image";

// Keep responsive Next images on the fast path. If optimization fails, load
// the small authorized preview directly, with one further bounded retry.
export default function AdImage(props:ImageProps){
 const asset=typeof props.src==="string"?homepageAsset(props.src):undefined;
 if(asset)return <SnapshotImage key={asset.src} {...props} asset={asset}/>;
 const src=typeof props.src==="string"?publicAdPreview(props.src):props.src;
 return <RecoveringImage key={typeof src==="string"?src:undefined} {...props} src={src}/>;
}
function RecoveringImage({src,onError,...props}:ImageProps){
 const [attempt,setAttempt]=useState(0);
 const canRecover=typeof src==="string"&&publicAdRetry(src,1)!==src;
 const retrying=canRecover&&attempt>0;
 return <Image {...props}
   src={retrying?publicAdRetry(src as string,attempt):src}
   unoptimized={retrying||props.unoptimized}
   preload={retrying?false:props.preload}
   onError={event=>{
    onError?.(event);
    if(canRecover&&attempt<2)setAttempt(attempt+1);
   }}/>;
}

function SnapshotImage({asset,onError,...props}:ImageProps&{asset:HomepageImage}){
 const [failed,setFailed]=useState(false);
 return <Image {...props} data-home-snapshot={asset.src} data-home-fallback={failed?"true":undefined}
  src={failed?asset.placeholder:asset.src} loader={({width})=>width<=480?asset.small:asset.src}
  unoptimized={failed} placeholder={asset.placeholder as `data:image/${string}`}
  loading={props.preload?undefined:"eager"} fetchPriority={props.preload?"high":"low"}
  style={{...props.style,objectFit:"contain"}}
  onError={event=>{onError?.(event);setFailed(true);}}/>;
}
