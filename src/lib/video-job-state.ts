import type { createAdminClient } from "@/lib/supabase/admin";
type Db = ReturnType<typeof createAdminClient>;
export type VideoJobLease = { id: string; status: string; updated_at: string };

// The timestamp is an ownership token, not just a display time. A poller that
// read an older snapshot cannot fail a newer worker or overwrite a done job.
export async function transitionVideoJob<T extends VideoJobLease>(
  db: Db, job: T, fields: Partial<T>,
): Promise<boolean> {
  if (["done", "failed"].includes(job.status)) return false;
  const updated_at = new Date(Math.max(Date.now(), Date.parse(job.updated_at) + 1)).toISOString();
  const { data, error } = await db.from("video_jobs")
    .update({ ...fields, updated_at })
    .eq("id", job.id).eq("status", job.status).eq("updated_at", job.updated_at)
    .select("id");
  if (error) throw error;
  if (!data?.length) return false;
  Object.assign(job, fields, { updated_at });
  return true;
}
