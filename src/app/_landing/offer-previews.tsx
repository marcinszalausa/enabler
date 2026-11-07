"use client";
import {useState} from "react";
import Link from "next/link";
import Image from "./ad-image";
import {STUDIO_SOURCE,STUDIO_FEED} from "@/lib/studio-showcase";
import {growthTests,MIN_TEST_IMPRESSIONS} from "@/lib/growth-testing";
import {SCALE_SAMPLE_ROWS,sampleCampaignBrief} from "@/lib/offer-examples";

export function OfferPreviews(){return <div className="studio-benefit-grid" lang="en"><StoreWorkflowPreview/><ScalePlanPreview/></div>;}
function StoreWorkflowPreview(){
 const [step,setStep]=useState(0);
 return <article data-store-workflow-preview className="studio-benefit-card offer-card">
  <div className="offer-eyebrow"><span>Grow + Scale</span><span>Interactive preview</span></div>
  <h3>Your store.<br/>Your starting point.</h3><p>Connect once. Choose a product. Make your ads.</p>
  <div className="offer-steps" role="group" aria-label="Preview the store workflow">{["Connect","Choose","Create"].map((label,i)=><button key={label} type="button" aria-pressed={step===i} onClick={()=>setStep(i)}><span>{i+1}</span>{label}</button>)}</div>
  <div className="offer-stage" data-store-preview-step={step}>
   <div className="offer-product-photo"><Image src={step===2?STUDIO_FEED:STUDIO_SOURCE} alt={step===2?"Real finished Soft Mila cardigan ad":"Soft Mila Hug Cardigan product photo"} fill sizes="(min-width:768px) 200px, 38vw" loading="lazy"/></div>
   <div className="offer-stage-copy"><span className="offer-small">Soft Mila · Example product</span><h4>{["Authorize your store","Pick your product","Make it your ad"][step]}</h4><p>{["Approve product access through your store’s connection screen.","Your product and photos are ready to choose in Gooidy.","Choose your message and quality. Review the credit cost before creating."][step]}</p>
    {step<2?<button type="button" onClick={()=>setStep(step+1)} className="offer-link">{step===0?"Preview product selection":"Preview the finished ad"} <span aria-hidden>→</span></button>:<Link href="/start?plan=starter" prefetch={false} className="offer-link">Try your own product <span aria-hidden>→</span></Link>}
   </div>
  </div>
  <p className="offer-footnote">Store connections require Grow or Scale. Available platforms appear in your dashboard.</p>
 </article>;
}
function ScalePlanPreview(){
 const [ready,setReady]=useState(true),tests=growthTests(ready?SCALE_SAMPLE_ROWS:[]),test=tests[0];
 function download(){const url=URL.createObjectURL(new Blob([sampleCampaignBrief()],{type:"text/plain;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="gooidy-sample-campaign-brief.txt";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <article data-scale-plan-preview className="studio-benefit-card offer-card">
  <div className="offer-eyebrow"><span>Scale</span><span>Illustrative sample</span></div>
  <h3>Know what<br/>to try next.</h3><p>A practical brief from your post results.</p>
  <div className="offer-steps" role="group" aria-label="Preview the Scale plan"><button type="button" aria-pressed={ready} onClick={()=>setReady(true)}>Example plan</button><button type="button" aria-pressed={!ready} onClick={()=>setReady(false)}>Not enough data</button></div>
  <div className="offer-plan" aria-live="polite">
   <span className="offer-small">Illustrative data · Not customer results</span>
   {test?<><h4>Try a new opening.</h4><p className="offer-quote">“{test.source.caption}”</p><dl className="offer-sample-rates"><div><dt>Sample click rate</dt><dd>{test.sourceRate.toFixed(1)}%</dd></div><div><dt>Sample comparison</dt><dd>{test.referenceRate.toFixed(1)}%</dd></div></dl><p><strong>Keep:</strong> the product and offer.<br/><strong>Change:</strong> one headline or opening scene.</p><button type="button" onClick={download} className="offer-link">Download sample brief <span aria-hidden>↓</span></button></>:<><h4>More data. Better next steps.</h4><p>A suggestion needs two posts on the same network, each with at least {MIN_TEST_IMPRESSIONS} impressions and usable click data.</p><p>Gooidy waits for enough data instead of inventing a recommendation.</p></>}
  </div>
  <p className="offer-footnote">Exploratory suggestions. You review, create and publish; no automatic budget changes.</p>
 </article>;
}
