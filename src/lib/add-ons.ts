// Paid extras on a run (Priority now; 4K and extra languages later).
// Provider-free, so the create card can show prices in the browser.

// Images a standard run makes at the same time, and a Priority run.
// Same compute either way: Priority only lets a run use more lanes at once.
// fal limits how many requests our account runs at once; extra requests wait
// in fal's own queue, so a busy moment slows runs down but never fails them.
export const STANDARD_IMAGE_LANES = 3;
export const PRIORITY_IMAGE_LANES = 6;

// Priority costs this much per image on top of the image price. Charging per
// image keeps a run's cost a whole multiple of its image count, so refunds for
// undelivered images stay exact (pipeline and the interrupted-run sweep).
export const PRIORITY_CREDITS_PER_IMAGE = 1;

// Stored on generations.priority (generated column) for reporting and ordering.
export const PRIORITY_SCORE = 100;

// What a run asked for, stored in generations.request_options.add_ons.
export type AddOns = {
  priority?: boolean;
  // Priority came with the workspace (no extra credits).
  priority_included?: boolean;
  // Reserved for phase 3.
  upscale_4k?: boolean;
  languages?: string[];
};

export type PriorityChoice = {
  priority: boolean;
  included: boolean;
  credits: number;
};

const NONE: PriorityChoice = { priority: false, included: false, credits: 0 };

// A run with no more images than the standard lanes already makes them all
// at once, so Priority would change nothing. It is neither offered nor charged.
export function priorityHelps(images: number): boolean {
  return Number.isSafeInteger(images) && images > STANDARD_IMAGE_LANES;
}

// Decides whether a run gets Priority and what it costs.
// included: the workspace has Priority as part of its plan (free).
// requested: the owner switched Priority on for this run (paid per image).
export function priorityFor(opts: {
  requested: boolean;
  included: boolean;
  images: number;
  video: boolean;
}): PriorityChoice {
  // Video clips are all sent to the model at once; there is no line to skip.
  if (opts.video || !priorityHelps(opts.images)) return NONE;
  if (opts.included) return { priority: true, included: true, credits: 0 };
  if (opts.requested) {
    return { priority: true, included: false, credits: opts.images * PRIORITY_CREDITS_PER_IMAGE };
  }
  return NONE;
}

export function parsePriorityField(value: unknown): boolean {
  return value === "on" || value === "true" || value === "1";
}

export function imageLanes(priority: boolean | undefined): number {
  return priority ? PRIORITY_IMAGE_LANES : STANDARD_IMAGE_LANES;
}

export function addOnsFor(choice: PriorityChoice): AddOns | null {
  if (!choice.priority) return null;
  return { priority: true, ...(choice.included ? { priority_included: true } : {}) };
}

export function priorityScore(options: unknown): number {
  const addOns = (options as { add_ons?: AddOns } | null)?.add_ons;
  return addOns?.priority === true ? PRIORITY_SCORE : 0;
}
