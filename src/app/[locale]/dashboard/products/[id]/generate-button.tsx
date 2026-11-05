"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useGenerationAction } from "./use-generation-action";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import type { Quality } from "@/lib/quality";

export function GenerateButton({
  productId,
  campaignId,
  initialRequestId,
  cost,
  language,
  quality,
  credits,
  ideas,
  source,
  style,
  avatar,
  variations,
  ratio,
  focus,
  brandOff = false,
  chips,
}: {
  productId: string;
  campaignId?: string;
  initialRequestId: string;
  cost: number;
  language: string;
  quality: Quality;
  credits?: number;
  ideas?: number;
  // The picked starting photo; none means the product's first.
  source?: string;
  // A style reference to follow, by id.
  style?: string;
  // An AI avatar to feature, by id.
  avatar?: string;
  // The create card's chips: variations of one idea in one size.
  variations?: number;
  ratio?: string;
  focus?: string;
  brandOff?: boolean;
  // Shown right above the button.
  chips?: ReactNode;
}) {
  const { state, action, pending, requestId } = useGenerationAction(initialRequestId);
  const { t } = useI18n();

  return (
    <form action={action} className="flex w-full flex-col gap-2">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="productId" value={productId} />
      {campaignId && <input type="hidden" name="campaignId" value={campaignId}/>}
      <input type="hidden" name="language" value={language} />
      <input type="hidden" name="quality" value={quality} />
      {source && <input type="hidden" name="source" value={source} />}
      {style && <input type="hidden" name="style" value={style} />}
      {avatar && <input type="hidden" name="avatar" value={avatar} />}
      {ideas !== undefined && <input type="hidden" name="ideas" value={ideas} />}
      {variations !== undefined && <input type="hidden" name="variations" value={variations} />}
      {ratio && <input type="hidden" name="ratio" value={ratio} />}
      {focus && <input type="hidden" name="focus" value={focus} />}
      {brandOff && <input type="hidden" name="brand" value="off" />}
      {chips}
      <button
        type="submit"
        disabled={pending || (credits!==undefined&&credits<cost)}
        className="btn-primary min-h-12 w-full rounded-xl px-6 py-3 font-semibold lg:w-auto lg:min-w-80 lg:self-start"
      >
        {pending ? t.app.starting : fmt(t.app.withCost, { label: variations !== undefined ? t.create.generate : ideas === undefined ? t.trial.create : fmt(t.app.createImages, { count: ideas * 2 }), cost })}
      </button>
      {credits!==undefined&&credits<cost&&<p className="text-sm text-muted">{fmt(t.app.errors.noCredits,{cost})} <Link href="/dashboard/billing#packs" prefetch={false} className="inline-flex min-h-11 items-center font-medium text-accent underline-offset-4 hover:underline">{t.billing.buyCredits}</Link></p>}
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}


