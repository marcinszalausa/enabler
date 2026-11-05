"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { buildStyleLibrary } from "@/lib/style-references";

export type LibraryState = { message: string | null };

// Draws the next batch of Gooidy's style library on the AI providers.
export async function buildLibraryAction(): Promise<LibraryState> {
  await requireAdmin();
  const { made, failed } = await buildStyleLibrary();
  revalidatePath("/dashboard/admin");
  return { message: failed ? `Made ${made} images; ${failed} failed and will be retried next time.` : `Made ${made} images.` };
}
