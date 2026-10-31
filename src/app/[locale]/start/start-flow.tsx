"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { adKind, productLink, setupPath, type AdKind } from "@/lib/onboarding";
import { ASPECTS, ADS_PER_GENERATION, GENERATION_COST } from "@/lib/image-pricing";
import { DEFAULT_VIDEO_OPTIONS, VIDEOS_PER_GENERATION, videoRunCost } from "@/lib/video-options";
import { SetupSteps } from "@/app/_landing/setup-steps";
type Preview = {url:string;title:string;photo:string|null};
export function StartFlow(){
  const search=useSearchParams(),router=useRouter();
  const {t}=useI18n();
  const raw=search.get("url")??"";
  const initial=productLink(raw);
  const [url,setUrl]=useState(initial??raw);
  const [kind,setKind]=useState<AdKind>(adKind(search.get("kind")));
  const [step,setStep]=useState<1|2>(initial?2:1);
  const [error,setError]=useState(!!raw&&!initial);
  const [preview,setPreview]=useState<Preview|null>(null);
  const [loading,setLoading]=useState(false);
  const [previewError,setPreviewError]=useState(false);
  const heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{
    if(step!==2)return;
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),25000);
    let stopped=false;
    async function read(){
      setLoading(true);setPreview(null);setPreviewError(false);
      try{
        const response=await fetch("/api/onboarding/preview",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url}),signal:controller.signal});
        if(!response.ok)throw new Error("Preview unavailable");
        const value:Preview=await response.json();
        if(!stopped)setPreview(value);
      }catch{if(!stopped)setPreviewError(true);}
      finally{clearTimeout(timeout);if(!stopped)setLoading(false);}
    }
    void read();
    return ()=>{stopped=true;clearTimeout(timeout);controller.abort();};
  },[step,url]);
  const cost=kind==="image"?GENERATION_COST:videoRunCost(DEFAULT_VIDEO_OPTIONS.length);
  function updateAddress(nextUrl:string,nextKind:AdKind){
    const query=new URLSearchParams({url:nextUrl,kind:nextKind});
    window.history.replaceState(null,"",window.location.pathname+"?"+query);
  }
  return <div data-onboarding-step={step}>
    <SetupSteps t={t} current={step}/>
    <p className="text-sm font-medium text-accent">{t.home.finalSub}</p>
    <h1 ref={heading} tabIndex={-1} className="mt-3 text-3xl font-semibold tracking-tight outline-none sm:text-4xl">{step===1?t.onboard.title:t.onboard.confirm}</h1>
    {step===1?<form className="mt-8 space-y-4" onSubmit={event=>{
      event.preventDefault();const link=productLink(url);
      if(!link){setError(true);return;}
      setError(false);setUrl(link);updateAddress(link,kind);setStep(2);setTimeout(()=>heading.current?.focus(),0);
    }}>
      <label className="block text-sm font-medium" htmlFor="setup-url">{t.urlForm.label}</label>
      <input id="setup-url" name="url" inputMode="url" required maxLength={2048} value={url} onChange={e=>{setUrl(e.target.value);setError(false);}}
        placeholder={t.urlForm.placeholder} className="w-full rounded-xl border border-line-strong bg-raised px-4 py-3 text-base outline-none focus:border-accent focus:ring-4 focus:ring-accent/20"/>
      {error&&<p role="alert" className="text-sm text-danger">{t.onboard.invalidUrl}</p>}
      <button type="submit" className="btn-primary min-h-12 rounded-xl px-6 py-3 font-medium">{t.onboard.continue}</button>
    </form>:<>
      <div data-preview-state={loading?"loading":previewError?"error":preview?"ready":"idle"} className="mt-7 flex items-center gap-4 rounded-2xl border border-line bg-surface p-4">
        {preview?.photo&&
          // eslint-disable-next-line @next/next/no-img-element -- bounded image data returned by our preview endpoint
          <img src={preview.photo} alt="" className="h-28 w-24 shrink-0 rounded-xl bg-bg object-contain"/>}
        <div className="min-w-0">
          <p className="line-clamp-2 font-medium">{preview?.title??new URL(url).hostname}</p>
          <p className="mt-1 break-all text-xs text-muted">{url}</p>
          <p role="status" className="mt-2 text-xs leading-relaxed text-muted">{loading?t.app.reading:previewError?t.onboard.previewError:null}</p>
        </div>
      </div>
      <fieldset className="mt-7"><legend className="sr-only">{t.publish.ads}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["image","video"] as const).map(value=><label key={value}
            className={"flex cursor-pointer items-start gap-3 rounded-2xl border p-5 "+(kind===value?"border-accent bg-accent-soft":"border-line bg-raised")}>
            <input type="radio" name="kind" value={value} checked={kind===value} onChange={()=>{setKind(value);updateAddress(url,value);}} className="mt-1 h-4 w-4 accent-accent"/>
            <span className="min-w-0">
              <span className="block font-semibold">{fmt(value==="image"?t.app.imageAds:t.app.videoAds,{count:value==="image"?ADS_PER_GENERATION*ASPECTS.length:VIDEOS_PER_GENERATION})}</span>
              <span className="mt-2 block text-sm leading-relaxed text-muted">{value==="image"?t.useCases.steps[2].body:fmt(t.onboard.videoChoice,{count:VIDEOS_PER_GENERATION,seconds:DEFAULT_VIDEO_OPTIONS.length})}</span>
              <span className="mt-3 block text-sm font-medium">{fmt(t.app.credits,{count:value==="image"?GENERATION_COST:videoRunCost(DEFAULT_VIDEO_OPTIONS.length)})}</span>
              {value==="image"&&<span className="mt-2 block text-xs text-accent">{t.onboard.recommended}</span>}
            </span>
          </label>)}
        </div>
      </fieldset>
      <div className="mt-7 flex flex-wrap items-center gap-3">
        <button data-continue-account type="button" onClick={()=>router.push("/login?"+new URLSearchParams({next:setupPath(url,kind)}))}
          className="btn-primary min-h-12 rounded-xl px-6 py-3 font-medium">{t.onboard.accountContinue}</button>
        <button type="button" onClick={()=>{setStep(1);setTimeout(()=>heading.current?.focus(),0);}}
          className="min-h-12 rounded-xl border border-line px-5 py-3 text-sm font-medium">{t.onboard.back}</button>
      </div>
      <p className="mt-4 text-sm text-muted">{fmt(t.app.credits,{count:cost})} · {t.onboard.prepareNote}</p>
    </>}
  </div>;
}
