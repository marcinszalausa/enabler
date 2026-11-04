"use client";
import {Nav,Footer} from "@/app/_landing/chrome";
import {RecoveryPanel} from "@/app/_landing/recovery-panel";
export default function PublicError({retry}:{retry:()=>void}){
 return <div className="landing flex flex-1 flex-col bg-bg text-fg"><Nav/><main id="main-content" tabIndex={-1} className="flex flex-1 items-center px-4 py-16 sm:py-24"><RecoveryPanel retry={retry}/></main><Footer/></div>;
}
