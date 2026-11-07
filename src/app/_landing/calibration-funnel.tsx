"use client";

import {useEffect, useId, useRef, useState} from "react";
import Link from "next/link";
import {useI18n} from "@/i18n/client";
import {localePath} from "@/i18n/config";
import {productLink} from "@/lib/onboarding";
import {PAID_PLANS} from "@/lib/paid-plans";
import {CONTACT_EMAIL} from "@/lib/contact";

// A recommendation is a signup preference, never an entitlement or a charge.
const OPTIONS = [
  {plan: "starter", range: "$0–$10k", label: "Getting started", body: "Build a consistent creative routine."},
  {plan: "plus", range: "$10k–$100k", label: "Growing", body: "Connect your catalog and compare results."},
  {plan: "growth", range: "$100k+", label: "Scaling", body: "Turn more results into your next campaign."},
] as const;

export function CalibrationFunnel() {
  const {locale, t} = useI18n();
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const reveal = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<(typeof OPTIONS)[number] | null>(null);
  const plan = PAID_PLANS.find(p => p.id === selected?.plan);

  useEffect(() => {
    if (selected) reveal.current?.focus();
  }, [selected]);
  useEffect(() => {
    if (!open) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {document.body.style.overflow = before;};
  }, [open]);

  function close() {
    dialog.current?.close();
    opener.current?.focus();
  }
  const link = productLink(url);
  const start = localePath(locale, "/start") + "?" + new URLSearchParams({url: link ?? "", ...(plan ? {plan: plan.id} : {})});
  const stores = localePath(locale, "/dashboard/stores") + "?" + new URLSearchParams({url: link ?? "", ...(plan ? {plan: plan.id} : {})});
  // Auth's existing safe-next flow returns the customer to native store setup.
  const connect = "/login?" + new URLSearchParams({next: stores});
  const review = "mailto:" + CONTACT_EMAIL + "?" + new URLSearchParams({
    subject: "Gooidy architectural review",
    body: "Hello, I would like to discuss custom onboarding.\nStore: " + (link ?? "") + "\nMonthly ad spend: $100k+\n\nMy requirements:\n",
  });

  return <div className="calibration" lang="en" data-calibration>
    <form action={localePath(locale, "/start")} method="get" className="calibration-form" onSubmit={event => {
      const normalized = productLink(url);
      if (!normalized) {
        event.preventDefault(); setError(true); input.current?.focus(); return;
      }
      // The normal GET form remains usable before hydration / without JS.
      if (!dialog.current?.showModal) return;
      event.preventDefault(); setError(false); setUrl(normalized);
      dialog.current.showModal();
    }}>
      <label htmlFor={id + "-url"} className="sr-only">Your store URL</label>
      <input ref={input} id={id + "-url"} name="url" required inputMode="url" maxLength={2048}
        autoCapitalize="none" autoCorrect="off" spellCheck={false} value={url}
        onChange={event => {setUrl(event.target.value); setError(false); setSelected(null);}}
        aria-invalid={error || undefined} aria-describedby={error ? id + "-error" : undefined}
        placeholder="Enter your store URL to calibrate engine" />
      <button ref={opener} type="submit">Initialize <span aria-hidden>→</span></button>
    </form>
    {error && <p id={id + "-error"} role="alert" className="mt-3 text-sm text-danger">{t.onboard.invalidUrl}</p>}
    <p className="calibration-note">No card needed to explore. You stay in control of publishing.</p>
    <dialog ref={dialog} aria-labelledby={id + "-title"} aria-describedby={id + "-description"}
      onToggle={event => setOpen(event.currentTarget.open)}
      className="calibration-dialog" onCancel={event => {event.preventDefault(); close();}}
      onClick={event => {if (event.target === event.currentTarget) {const r=event.currentTarget.getBoundingClientRect(); if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}}}
      onKeyDown={event => {
        if(event.key!=="Tab")return;
        const controls=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
        const first=controls[0],last=controls.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }}>
      <div className="flex items-center justify-between gap-4"><span className="calibration-eyebrow">Find your fit</span><button type="button" className="calibration-close" aria-label="Close calibration" onClick={close}>✕</button></div>
      <h2 id={id + "-title"}>What is your monthly ad spend?</h2>
      <p id={id + "-description"}>Choose a range to calibrate your recommendation. You can choose any plan.</p>
      <div className="calibration-options">{OPTIONS.map(option => <button key={option.plan} type="button" onClick={() => {setSelected(option); dialog.current?.close();}}>
        <span className="calibration-eyebrow">{option.label}</span><strong>{option.range}</strong><span className="text-xs text-muted">per month</span><span className="mt-5 text-sm">{option.body}</span><span className="mt-5 text-sm font-medium">{PAID_PLANS.find(p=>p.id===option.plan)!.name} <span aria-hidden>↗</span></span>
      </button>)}</div>
      <button type="button" className="calibration-skip" onClick={() => {setSelected(OPTIONS[0]); dialog.current?.close();}}>Not sure yet? Start with Launch →</button>
    </dialog>
    {plan && selected && <div ref={reveal} tabIndex={-1} className="calibration-result" data-recommended-plan={plan.id}>
      <div className="calibration-result-heading"><div><p className="calibration-eyebrow">Your recommendation</p><h2>{plan.name}</h2><p>{plan.outcome}</p></div><p className="calibration-price"><strong>${plan.price}</strong><span>USD / month</span></p></div>
      <ul>{plan.highlights.slice(0, 3).map(item => <li key={item}>✓ {item}</li>)}</ul>
      <div className="calibration-actions">
        {plan.id === "starter" ? <Link href={start} className="calibration-primary">Create your first ad →</Link> : <Link href={connect} className="calibration-primary">Connect store →</Link>}
        <Link href={localePath(locale, "/pricing")} className="calibration-secondary">Compare all plans</Link>
      </div>
      <p className="calibration-note">{plan.id === "starter" ? "Paste a product link to explore. Full catalog connections are included with Grow and Scale." : "Sign in to connect. Store access requires an active Grow or Scale plan."} No purchase starts automatically.</p>
      {plan.id !== "starter" && <Link href={start} className="calibration-secondary">Explore with a product link first →</Link>}
      {plan.id === "growth" && <div className="calibration-custom"><p className="calibration-eyebrow">Need custom onboarding?</p><p>Discuss your catalog, creative workflow and integration requirements with us.</p><ol><li>01 · Review your store and catalog</li><li>02 · Map your creative workflow</li><li>03 · Define integration requirements</li></ol><a href={review} className="calibration-primary">Request Architectural Review →</a><p className="calibration-note">Opens an email request. We’ll arrange a time with you.</p></div>}
      <button type="button" className="calibration-secondary" onClick={() => dialog.current?.showModal()}>Change ad-spend range</button>
    </div>}
  </div>;
}
