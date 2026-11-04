"use client";
import { useActionState, useState } from "react";
import { createCampaign } from "./actions";
import { CAMPAIGN_GOALS, type seasonIdeas } from "@/lib/customer-workflow";
import {CREATIVE_PRESETS} from "@/lib/creative-presets";
const field = "min-h-11 w-full rounded-lg border border-line-strong bg-raised px-3 py-2 font-normal";
export function CampaignForm({ id, products, ideas }: { id: string; products: {id:string;name:string|null;url:string}[]; ideas: ReturnType<typeof seasonIdeas> }) {
  const [state,action,pending] = useActionState(createCampaign,{error:null});
  const [goal,setGoal] = useState<keyof typeof CAMPAIGN_GOALS>("introduce");
  const [name,setName] = useState("");
  const [message,setMessage] = useState("");
  const [scene,setScene] = useState("");
  const [preset,setPreset] = useState("");
  return <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_18rem]">
    <form action={action} className="edge grid gap-5 p-5 sm:p-6">
      <input type="hidden" name="id" value={id}/>
      <h2 className="text-xl font-semibold">Your next campaign</h2>
      <p className="text-sm text-muted">Choose a product and a message. Create matching images and videos, then review and schedule your favorites.</p>
      <fieldset><legend className="text-sm font-medium">Start with a creative direction (optional)</legend><p className="mt-1 text-xs text-muted">These are editable starting points, not fixed layouts. Saving is free; creating media uses the price shown in the next step.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{CREATIVE_PRESETS.map(p=><button key={p.slug} type="button" aria-pressed={preset===p.slug} onClick={()=>{setPreset(p.slug);setGoal(p.goal);setName(p.name);setMessage(p.message);setScene(p.scene);}} className="rounded-xl border border-line p-3 text-start aria-pressed:border-accent aria-pressed:bg-accent-soft"><span className="font-medium">{p.name}</span><span aria-hidden className="mt-2 flex gap-1">{p.preview.map((step,i)=><span key={step} className="min-w-0 flex-1 break-words rounded bg-surface p-2 text-xs">{i+1}. {step}</span>)}</span></button>)}</div></fieldset>
      <label className="grid gap-1 text-sm font-medium">1. Choose a product<select name="productId" required className={field}>{products.map(p=><option key={p.id} value={p.id}>{p.name??p.url}</option>)}</select></label>
      <fieldset><legend className="mb-2 text-sm font-medium">2. What’s the goal?</legend><div className="grid gap-2 sm:grid-cols-3">{Object.entries(CAMPAIGN_GOALS).map(([key,label],i)=><label key={key} className="flex cursor-pointer flex-col gap-2 rounded-xl border border-line p-3 text-sm has-checked:border-accent has-checked:bg-accent-soft"><span aria-hidden className="text-2xl">{["◉","↗","◇"][i]}</span><input className="sr-only" type="radio" name="goal" value={key} checked={goal===key} onChange={()=>setGoal(key as typeof goal)}/>{label}</label>)}</div></fieldset>
      <label className="grid gap-1 text-sm font-medium">Campaign name<input name="name" required maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="Example: A softer start to the day" className={field}/></label>
      <label className="grid gap-1 text-sm font-medium">3. What should customers remember?<textarea name="message" required maxLength={240} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Example: Comfortable clothing for slow mornings at home" rows={3} className={field}/></label>
      {goal==="offer"?<label className="grid gap-1 text-sm font-medium">Your offer and conditions<textarea name="offer" required maxLength={240} placeholder="Example: 10% off this collection through Sunday. Excludes sale items." className={field}/></label>:<input type="hidden" name="offer" value=""/>}
      <details><summary className="min-h-11 cursor-pointer text-sm text-muted">Choose a setting (optional)</summary><label className="grid gap-1 text-sm">Scene direction<input name="scene" value={scene} onChange={e=>setScene(e.target.value)} maxLength={240} placeholder="Example: Bright living room, soft daylight, uncluttered background" className={field}/></label></details>
      <p className="text-xs text-muted">Saving a plan is free. You choose images or videos and see the credit cost before creating anything. Nothing is posted by saving a plan.</p>
      <button disabled={pending} className="btn-primary min-h-11 rounded-xl px-4 py-3 font-medium">{pending?"Saving…":"Save plan and choose ads"}</button>
      {state.error&&<p role="alert" className="text-sm text-danger">{state.error}</p>}
    </form>
    <aside className="edge self-start rounded-2xl p-5"><h2 className="font-semibold">Ideas for your next campaign</h2><p className="mt-2 text-sm text-muted">Pick an idea, then make it yours. No discount or delivery promise is added.</p><div className="mt-4 grid gap-3">{ideas.map(idea=><button type="button" key={idea.name} onClick={()=>{setGoal("introduce");setName(idea.name);setMessage(idea.message);}} className="rounded-xl border border-line p-3 text-start transition hover:border-accent"><span className="block text-xs text-muted">{idea.date}</span><span className="mt-1 block font-medium">{idea.name} →</span></button>)}<button type="button" onClick={()=>{setGoal("introduce");setName("Meet your new favorite");setMessage("Introduce the product through its clearest verified benefit and a simple everyday use case.");}} className="rounded-xl border border-line p-3 text-start text-sm">Everyday product spotlight →</button></div></aside>
  </div>;
}

