"use client";

import {useEffect,useId,useRef,useState} from "react";
import Link from "next/link";
import Image from "./ad-image";
import {Logo} from "./chrome";
import {LanguageSwitcher} from "./language-switcher";
import {useI18n} from "@/i18n/client";
import {localePath} from "@/i18n/config";
import {productLink} from "@/lib/onboarding";
import {STUDIO_ADS,STUDIO_FEED,STUDIO_SOURCE,STUDIO_STORY,type StudioAd} from "@/lib/studio-showcase";
import {useMediaActivity} from "./use-media-activity";
import {studioCopy,type StudioCopy} from "./studio-copy";

function Arrow({back=false}:{back?:boolean}){
 return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden style={back?{transform:"rotate(180deg)"}:undefined}><path d="M5 12h14m-5-5 5 5-5 5"/></svg>;
}

export function StudioNav(){
 const {locale,t}=useI18n(),c=studioCopy(locale,t),menu=useRef<HTMLDetailsElement>(null);
 const links=[["#examples",t.nav.examples],["#how",t.nav.how],["#pricing",t.nav.pricing]];
 useEffect(()=>{
  const outside=(event:PointerEvent)=>{if(menu.current?.open&&!menu.current.contains(event.target as Node))menu.current.open=false;};
  document.addEventListener("pointerdown",outside);
  return()=>document.removeEventListener("pointerdown",outside);
 },[]);
 return <header className="studio-header">
  <a href="#main-content" className="skip-link">{t.nav.skip}</a>
  <nav className="studio-nav" aria-label={t.nav.home}>
   <Logo/>
   <div className="studio-nav-links">{links.map(([href,label])=><a key={href} href={href}>{label}</a>)}</div>
   <div className="studio-nav-actions">
    <div className="studio-language"><LanguageSwitcher compact/></div>
    <Link href="/login" className="studio-sign-in" prefetch={false}>{t.nav.signIn}</Link>
    <Link href={localePath(locale,"/start")} className="studio-button small" prefetch={false}>{t.nav.getStarted}</Link>
    <details ref={menu} className="studio-mobile-menu" onKeyDown={event=>{if(event.key==="Escape"){event.currentTarget.open=false;event.currentTarget.querySelector("summary")?.focus();}}}>
     <summary aria-label={t.nav.menu}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><path d="M4 8h16M4 16h16"/></svg></summary>
     <div onClick={event=>{if((event.target as HTMLElement).closest("a")&&menu.current)menu.current.open=false;}}>
      {links.map(([href,label])=><a key={href} href={href}>{label}<Arrow/></a>)}
      <Link href="/login" prefetch={false}>{t.nav.signIn}<Arrow/></Link>
      <Link href={localePath(locale,"/help")} prefetch={false}>{locale==="en"?"Help center":t.nav.faq}<Arrow/></Link>
     </div>
    </details>
   </div>
  </nav>
  <span className="sr-only">{c.eyebrow}</span>
 </header>;
}

export function StudioStart({copy,id:providedId}:{copy:StudioCopy;id?:string}){
 const {locale,t}=useI18n(),generatedId=useId(),id=providedId??generatedId;
 const [error,setError]=useState(false);
 return <div className="studio-start" id={providedId}>
  <form action={localePath(locale,"/start")} method="get" onSubmit={event=>{
   const input=event.currentTarget.querySelector<HTMLInputElement>("input");
   const value=input?.value.trim();if(!value)return;
   const normalized=productLink(value);
   if(!normalized){event.preventDefault();setError(true);input?.focus();}
   else if(input)input.value=normalized;
  }}>
   <span className="studio-link-icon" aria-hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="m10 13 4-4m-6.5 6.5-1 1a3.5 3.5 0 0 1-5-5l4-4a3.5 3.5 0 0 1 5 0m3 1 1-1a3.5 3.5 0 0 1 5 5l-4 4a3.5 3.5 0 0 1-5 0" transform="translate(1 1)"/></svg></span>
   <label htmlFor={id+"-input"} className="sr-only">{copy.label}</label>
   <input id={id+"-input"} name="url" inputMode="url" placeholder={copy.placeholder} maxLength={2048} autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-invalid={error||undefined} aria-describedby={error?id+"-error":undefined} onChange={()=>setError(false)}/>
   <button type="submit" className="studio-button">{copy.create}<Arrow/></button>
  </form>
  {error?<p id={id+"-error"} className="studio-form-error" role="alert">{t.onboard.invalidUrl}</p>:<p className="studio-start-hint">{copy.hint}</p>}
 </div>;
}

export function StudioCreative({ad,priority=false}:{ad:StudioAd;priority?:boolean}){
 const root=useRef<HTMLElement>(null),video=useRef<HTMLVideoElement>(null);
 const activity=useMediaActivity(root);
 const [manual,setManual]=useState(false),[paused,setPaused]=useState(false),[ready,setReady]=useState(false),[muted,setMuted]=useState(true),[playing,setPlaying]=useState(false);
 const {locale,t}=useI18n();
 const load=!!ad.video&&(manual||(activity.nearby&&activity.idle&&!activity.restricted));
 const play=load&&activity.inView&&!paused&&(manual||!activity.restricted);
 useEffect(()=>{
  const el=video.current;if(!el)return;
  if(play)void el.play().catch(()=>{});else el.pause();
 },[play,load]);
 function toggle(){
  const el=video.current;if(!el||!ad.video)return;
  if(!el.paused){setPaused(true);el.pause();}
  else {setManual(true);setPaused(false);if(el.getAttribute("src")!==ad.video)el.src=ad.video;void el.play().catch(()=>{});}
 }
 return <figure ref={root} className="studio-creative" data-product-key={ad.product} data-studio-ad={ad.id}>
  <div className="studio-creative-media">
   <Image src={ad.image} alt={ad.alt} fill sizes="(min-width: 1440px) 252px, (min-width: 768px) 22vw, 62vw" preload={priority} loading={priority?undefined:"lazy"}/>
   {ad.video&&<video ref={video} src={load?ad.video:undefined} loop muted={muted} playsInline preload="none" aria-label={ad.alt} onLoadedData={()=>setReady(true)} onPlaying={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onError={()=>{setReady(false);setPlaying(false);}} style={{opacity:ready?1:0}}/>}
  </div>
  <figcaption>
   <div><span>{locale==="en"?ad.label:ad.video?t.home.videoKicker:t.publish.ads}</span><small>{ad.video?(locale==="en"?"Video ad":t.home.videoKicker):(locale==="en"?"Image ad":t.publish.ads)}</small></div>
   {ad.video&&<div className="studio-video-controls">
    <button type="button" onClick={toggle} aria-label={playing?"Pause video ad":"Play video ad"} aria-pressed={playing} lang="en">
     <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>{playing?<path d="M7 5h3v14H7zm7 0h3v14h-3z"/>:<path d="m8 5 11 7-11 7Z"/>}</svg>
    </button>
    <button type="button" aria-label={muted?t.feed.soundOn:t.feed.soundOff} aria-pressed={!muted} onClick={()=>{
     const el=video.current;const next=!muted;setMuted(next);setManual(true);setPaused(false);
     if(el&&ad.video){el.muted=next;if(el.getAttribute("src")!==ad.video)el.src=ad.video;void el.play().catch(()=>{});}
    }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><path d="M11 5 6 9H3v6h3l5 4Z"/>{muted?<path d="m16 9 5 6m0-6-5 6"/>:<path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>}</svg></button>
   </div>}
  </figcaption>
 </figure>;
}

export function StudioRail({label}:{label:string}){
 const track=useRef<HTMLDivElement>(null);
 const [edges,setEdges]=useState({start:true,end:false});
 useEffect(()=>{
  const el=track.current;if(!el)return;
  const update=()=>setEdges({start:el.scrollLeft<=2,end:el.scrollLeft+el.clientWidth>=el.scrollWidth-2});
  const observer=new ResizeObserver(update);observer.observe(el);el.addEventListener("scroll",update,{passive:true});update();
  return()=>{observer.disconnect();el.removeEventListener("scroll",update);};
 },[]);
 function move(direction:number){const el=track.current;if(el)el.scrollBy({left:direction*(el.querySelector("figure")?.getBoundingClientRect().width??260)+direction*18,behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"});}
 return <div className="studio-rail" id="examples">
  <div ref={track} className="studio-rail-track" role="region" aria-label={label} tabIndex={0} data-product-group="studio-hero">{STUDIO_ADS.map((ad,i)=><StudioCreative key={ad.id} ad={ad} priority={i<3}/>)}</div>
  <div className="studio-rail-caption"><p><span className="studio-live-dot" aria-hidden/>{label}</p><div><button type="button" aria-label="Previous ad examples" disabled={edges.start} onClick={()=>move(-1)}><Arrow back/></button><button type="button" aria-label="Next ad examples" disabled={edges.end} onClick={()=>move(1)}><Arrow/></button></div></div>
 </div>;
}

export function StudioTransformation({copy}:{copy:StudioCopy}){
 const [format,setFormat]=useState<"feed"|"story">("feed");
 return <div className="studio-transformation" data-transformation-format={format}>
  <div className="studio-transformation-canvas">
   <figure className="studio-source-photo"><div><Image src={STUDIO_SOURCE} alt={copy.original} fill sizes="(min-width:768px) 190px, 30vw" loading="lazy"/></div><figcaption>{copy.original}</figcaption></figure>
   <svg className="studio-magic-arrow" viewBox="0 0 110 80" fill="none" aria-hidden><path d="M4 58C25 8 72 5 100 30m-19-2 21 4-3-21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
   <figure className={"studio-transformed-ad "+format}><div><Image key={format} src={format==="feed"?STUDIO_FEED:STUDIO_STORY} alt={copy.result} fill sizes="(min-width:768px) 310px, 55vw" loading="lazy"/></div><figcaption><span className="studio-sparkle" aria-hidden>✦</span>{copy.result}</figcaption></figure>
  </div>
  <div className="studio-format-switch" role="group" aria-label="Ad format">{(["feed","story"] as const).map(value=><button key={value} type="button" aria-pressed={format===value} onClick={()=>setFormat(value)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>{value==="feed"?<rect x="5" y="5" width="14" height="14" rx="3"/>:<rect x="7" y="3" width="10" height="18" rx="3"/>}</svg>{value==="feed"?copy.feed:copy.story}</button>)}</div>
 </div>;
}

export function StudioPlanner(){
 const {locale}=useI18n(),[day,setDay]=useState(0);
 const selected=[STUDIO_ADS[1],STUDIO_ADS[3],STUDIO_ADS[0]][day];
 const labels=[0,1,2,3,4,5,6].map(i=>new Intl.DateTimeFormat(locale,{weekday:"short",timeZone:"UTC"}).format(new Date(Date.UTC(2026,0,5+i))));
 const activeDays=[0,2,4];
 return <div className="studio-planner" data-studio-planner>
  <div className="studio-planner-heading"><span>{locale==="en"?"Your week":new Intl.DateTimeFormat(locale,{month:"long",timeZone:"UTC"}).format(new Date(Date.UTC(2026,0,5)))}</span><span className="studio-preview-label">{locale==="en"?"Example schedule":"Demo"}</span></div>
  <div className="studio-calendar" role="group" aria-label={locale==="en"?"Preview a scheduled post":"Preview"}>{labels.map((label,i)=>{
   const slot=activeDays.indexOf(i),ad=slot>=0?[STUDIO_ADS[1],STUDIO_ADS[3],STUDIO_ADS[0]][slot]:null;
   return ad?<button key={i} type="button" aria-pressed={day===slot} aria-label={label+" · "+ad.alt} onClick={()=>setDay(slot)}><span>{label}</span><span className="studio-day-thumb"><Image src={ad.image} alt="" fill sizes="64px" loading="lazy"/></span><i aria-hidden/></button>:<div key={i}><span>{label}</span><span className="studio-empty-day">·</span></div>;
  })}</div>
  <div className="studio-post-preview" aria-live="polite"><div className="studio-planned-image"><Image key={selected.id} src={selected.image} alt={selected.alt} fill sizes="100px" loading="lazy"/></div><div><span className="studio-preview-status"><span aria-hidden>✓</span> {locale==="en"?"Ready to schedule":"Preview"}</span><strong>{selected.alt}</strong><span className="studio-preview-platform">Instagram · Facebook · TikTok</span></div></div>
  <div className="studio-planner-bottom"><span aria-hidden>↗</span><p>{locale==="en"?"Your content. Your timing.":"Instagram · Facebook · TikTok"}</p></div>
 </div>;
}

export function StudioMotion(){
 useEffect(()=>{
  if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  const root=document.querySelector<HTMLElement>("[data-studio-home]");if(!root)return;
  const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){(entry.target as HTMLElement).dataset.visible="true";observer.unobserve(entry.target);}},{threshold:.08});
  root.querySelectorAll("[data-studio-reveal]").forEach(element=>observer.observe(element));
  root.dataset.studioMotion="true";
  return()=>{observer.disconnect();delete root.dataset.studioMotion;};
 },[]);
 return null;
}
