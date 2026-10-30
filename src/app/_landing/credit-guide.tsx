"use client";

import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { LENGTHS, creditsPerVideo, videoRunCost, VIDEOS_PER_GENERATION, type LengthKey } from "@/lib/video-options";

// Costs come from the same definitions used to reserve generation credits.
export function CreditGuide({ imageCost, imagesPerRun }: { imageCost: number; imagesPerRun: number }) {
  const { t } = useI18n();
  return (
    <div data-credit-guide className="mt-10 overflow-hidden rounded-2xl border border-line bg-raised">
      <div className="border-b border-line p-5 sm:p-7">
        <h3 className="text-xl font-semibold tracking-tight">{t.home.creditTitle}</h3>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{t.home.creditIntro}</p>
      </div>
      <div className="grid md:grid-cols-2">
        <div className="border-b border-line p-5 sm:p-7 md:border-b-0 md:border-e">
          <p className="text-sm font-medium text-muted">{fmt(t.app.imageAds, { count: imagesPerRun })}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{fmt(t.app.credits, { count: imageCost })}</p>
          <p className="mt-3 text-sm leading-relaxed text-muted">{t.useCases.steps[2].body}</p>
          <p className="mt-5 rounded-xl bg-surface p-4 text-sm leading-relaxed">{t.home.refundNote}</p>
        </div>
        <div className="p-5 sm:p-7">
          <p className="text-sm font-medium">{fmt(t.app.videoAds, { count: VIDEOS_PER_GENERATION })}</p>
          <table className="mt-3 w-full text-start text-sm">
            <caption className="sr-only">{t.home.creditTitle}</caption>
            <thead className="text-muted">
              <tr className="border-b border-line"><th scope="col" className="py-3 pe-3 text-start font-normal">{t.app.length}</th><th scope="col" className="py-3 pe-3 text-start font-normal">{t.app.videoAd}</th><th scope="col" className="py-3 text-end font-normal">{fmt(t.app.videoAds, { count: VIDEOS_PER_GENERATION })}</th></tr>
            </thead>
            <tbody>{(Object.keys(LENGTHS) as LengthKey[]).map(length => (
              <tr key={length} className="border-b border-line last:border-0">
                <th scope="row" className="py-3 pe-3 text-start font-medium">{fmt(t.app.reel, { seconds: length })}</th>
                <td className="py-3 pe-3 text-muted">{fmt(t.app.credits, { count: creditsPerVideo(length) })}</td>
                <td className="py-3 text-end font-medium">{fmt(t.app.credits, { count: videoRunCost(length) })}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
      <p className="border-t border-line bg-surface px-5 py-4 text-sm leading-relaxed text-muted sm:px-7">{t.home.adSpend}</p>
    </div>
  );
}
