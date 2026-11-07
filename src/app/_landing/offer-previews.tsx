"use client";
import {useState} from "react";
import Link from "next/link";
import Image from "./ad-image";
import {STUDIO_SOURCE,STUDIO_FEED} from "@/lib/studio-showcase";
import {growthTests} from "@/lib/growth-testing";
import {SCALE_SAMPLE_ROWS,sampleCampaignBrief} from "@/lib/offer-examples";

export function OfferPreviews(){return <div className="studio-benefit-grid" lang="en"><StoreWorkflowPreview/><ScalePlanPreview/></div>;}
function StoreWorkflowPreview(){
 const [step,setStep]=useState(0);
 return <article data-store-workflow-preview className="studio-benefit-card offer-card">
  <div className="offer-eyebrow"><span>Grow + Scale</span><span>Preview</span></div>
  <h3>Your store.<br/>Ad-ready.</h3><p>Connect once. Create more.</p>
  <div className="offer-steps" role="group" aria-label="Preview the store workflow">{["Connect","Choose","Create"].map((label,i)=><button key={label} type="button" aria-pressed={step===i} onClick={()=>setStep(i)}><span>{i+1}</span>{label}</button>)}</div>
  <div className="offer-stage" data-store-preview-step={step}>
   <div className="offer-product-photo"><Image src={step===2?STUDIO_FEED:STUDIO_SOURCE} alt={step===2?"Real finished Soft Mila cardigan ad":"Soft Mila Hug Cardigan product photo"} fill sizes="(min-width:768px) 200px, 38vw" loading="lazy"/></div>
   <div className="offer-stage-copy"><span className="offer-small">Soft Mila</span><h4>{["Connect your catalog.","Choose your product.","Meet your next ad."][step]}</h4><p>{["Your products, brought together.","Your photos. Your brand.","Ready for your review."][step]}</p>
    {step<2?<button type="button" onClick={()=>setStep(step+1)} className="offer-link">{step===0?"Choose a product":"See the ad"} <span aria-hidden>→</span></button>:<Link href="/start?plan=starter" prefetch={false} className="offer-link">Create yours <span aria-hidden>→</span></Link>}
   </div>
  </div>
 </article>;
}
function ScalePlanPreview(){
 const [view,setView]=useState<"move"|"brief">("move"),test=growthTests(SCALE_SAMPLE_ROWS)[0];
 function download(){const url=URL.createObjectURL(new Blob([sampleCampaignBrief()],{type:"text/plain;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="gooidy-sample-campaign-brief.txt";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <article data-scale-plan-preview className="studio-benefit-card offer-card">
  <div className="offer-eyebrow"><span>Scale</span><span>Sample preview</span></div>
  <h3>Your next move.<br/>Made clearer.</h3><p>Turn results into your next idea.</p>
  <div className="offer-steps" role="group" aria-label="Preview the Scale plan"><button type="button" aria-pressed={view==="move"} onClick={()=>setView("move")}>Next move</button><button type="button" aria-pressed={view==="brief"} onClick={()=>setView("brief")}>Campaign brief</button></div>
  <div className="offer-plan" data-scale-preview-view={view} aria-live="polite">
   {view==="move"?<><h4>Keep the message.<br/>Change the opening.</h4><p className="offer-quote">“{test?.source.caption}”</p><dl className="offer-next-move"><div><dt>Keep</dt><dd>Product + offer</dd></div><div><dt>Try</dt><dd>A fresh headline</dd></div></dl><button type="button" onClick={()=>setView("brief")} className="offer-link">View brief <span aria-hidden>→</span></button></>:<><h4>One clear plan.<br/>Ready for your next ad.</h4><ol className="offer-brief-lines"><li><span>01</span> Keep the product and offer</li><li><span>02</span> Test a new headline or opening</li><li><span>03</span> Compare on the same network</li></ol><button type="button" onClick={download} className="offer-link">Download sample brief <span aria-hidden>↓</span></button></>}
  </div>
 </article>;
}
