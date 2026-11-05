"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { buildStyleLibrary } from "@/lib/style-references";
import { buildAvatarLibrary } from "@/lib/avatars";

export type LibraryState = { message: string | null };

const report = ({ made, failed }: { made: number; failed: number }): LibraryState =>
  ({ message: failed ? `Made ${made} images; ${failed} failed and will be retried next time.` : `Made ${made} images.` });

// Draws the next batch of Gooidy's style library on the AI providers.
export async function buildLibraryAction(): Promise<LibraryState> {
  await requireAdmin();
  const result = await buildStyleLibrary();
  revalidatePath("/dashboard/admin");
  return report(result);
}

// Draws the next batch of Gooidy's AI avatar library.
export async function buildAvatarLibraryAction(): Promise<LibraryState> {
  await requireAdmin();
  const result = await buildAvatarLibrary();
  revalidatePath("/dashboard/admin");
  return report(result);
}
