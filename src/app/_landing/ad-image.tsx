"use client";

import Image, {type ImageProps} from "next/image";
import {useState} from "react";
import {publicAdPreview,publicAdRetry} from "@/lib/public-ad-image";

// Keep responsive Next images on the fast path. If optimization fails, load
// the small authorized preview directly, with one further bounded retry.
export default function AdImage(props:ImageProps){
 const src=typeof props.src==="string"?publicAdPreview(props.src):props.src;
 return <RecoveringImage key={typeof src==="string"?src:src.src} {...props} src={src}/>;
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
