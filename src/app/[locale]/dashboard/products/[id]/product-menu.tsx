"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { DeleteDialog, TrashIcon } from "../../delete-button";
import { MoreMenu } from "../../more-menu";

// The "⋯" next to the product name: the things people need now and then.
export function ProductMenu({ productId, hasBrief, canEdit }: { productId: string; hasBrief: boolean; canEdit: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const items = [
    ...(canEdit ? [{ label: t.app.planCampaign, onSelect: () => router.push("/dashboard/campaigns") }] : []),
    ...(hasBrief ? [{ label: t.app.brief, onSelect: () => openBrief() }] : []),
    ...(canEdit ? [{ label: t.remove.deleteProduct, onSelect: () => setConfirm(true), danger: true, icon: <TrashIcon />, testId: "delete-product" }] : []),
  ];
  if (!items.length) return null;
  return (
    <>
      <MoreMenu
        placement="down"
        className="relative shrink-0"
        buttonClassName="flex h-11 w-11 items-center justify-center rounded-xl border border-line text-muted transition hover:border-line-strong hover:text-fg"
        items={items}
      />
      {confirm && <DeleteDialog target="product" id={productId} onClose={() => setConfirm(false)} />}
    </>
  );
}

function openBrief() {
  const brief = document.getElementById("brand-brief") as HTMLDetailsElement | null;
  if (!brief) return;
  brief.open = true;
  brief.scrollIntoView({ behavior: "smooth", block: "start" });
}
