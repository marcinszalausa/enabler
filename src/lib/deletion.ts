import type { SupabaseClient } from "@supabase/supabase-js";

// Why a delete did not happen, or "ok". Shown to the customer as a message.
export type DeleteOutcome = "ok" | "busy" | "showcased" | "missing" | "error";

export type DeleteDeps = {
  // The signed-in customer's client: proves the rows are theirs (RLS).
  client: SupabaseClient;
  // Service role: performs the delete once access is proven.
  admin: SupabaseClient;
  canEdit: (client: SupabaseClient, workspaceId: string) => Promise<boolean>;
  // Cancels a not-yet-published post at the social publisher.
  cancelPost: (zernioPostId: string) => Promise<void>;
};

type RunState = { status: string; showcased_at: string | null };

// A run that is still being made, or is on the public site, keeps its ads.
export function blockedBy(runs: RunState[]): DeleteOutcome | null {
  if (runs.some((r) => r.status === "queued" || r.status === "running")) return "busy";
  if (runs.some((r) => r.showcased_at)) return "showcased";
  return null;
}

// Every stored file of a run sits under <workspace>/<run>/.
export function runFolder(workspaceId: string, generationId: string) {
  return `${workspaceId}/${generationId}`;
}

// Deletes one ad. Usage, credit and billing history (the run and its ledger)
// stay; posts already live on social networks stay; queued posts are cancelled.
export async function deleteAd(deps: DeleteDeps, creativeId: string): Promise<DeleteOutcome> {
  const { data: ad, error } = await deps.client
    .from("creatives")
    .select("id, workspace_id, storage_path, generations!inner(status, showcased_at, product_id)")
    .eq("id", creativeId)
    .maybeSingle();
  if (error) return "error";
  if (!ad) return "missing";
  if (!(await deps.canEdit(deps.client, ad.workspace_id))) return "missing";
  const run = ad.generations as unknown as RunState;
  const blocked = blockedBy([run]);
  if (blocked) return blocked;

  if (!(await cancelQueuedPosts(deps, ad.workspace_id, [ad.id]))) return "error";
  const removed = await deps.admin
    .from("creatives")
    .delete()
    .eq("id", ad.id)
    .eq("workspace_id", ad.workspace_id);
  if (removed.error) return "error";
  await removeFiles(deps.admin, [ad.storage_path].filter(owned(ad.workspace_id)));
  return "ok";
}

// Deletes a product with all its ads and campaign plans. Its runs stay as
// usage and credit history, no longer linked to the product.
export async function deleteProduct(deps: DeleteDeps, productId: string): Promise<DeleteOutcome> {
  const { data: product, error } = await deps.client
    .from("products")
    .select("id, workspace_id")
    .eq("id", productId)
    .maybeSingle();
  if (error) return "error";
  if (!product) return "missing";
  const ws = product.workspace_id as string;
  if (!(await deps.canEdit(deps.client, ws))) return "missing";

  const { data: runs, error: runsError } = await deps.admin
    .from("generations")
    .select("id, status, showcased_at, creatives(id, storage_path)")
    .eq("product_id", product.id)
    .eq("workspace_id", ws);
  if (runsError) return "error";
  const list = (runs ?? []) as (RunState & { id: string; creatives: { id: string; storage_path: string }[] })[];
  const blocked = blockedBy(list);
  if (blocked) return blocked;

  const ads = list.flatMap((r) => r.creatives);
  if (!(await cancelQueuedPosts(deps, ws, ads.map((a) => a.id)))) return "error";
  if (ads.length) {
    const removed = await deps.admin
      .from("creatives")
      .delete()
      .in("generation_id", list.map((r) => r.id))
      .eq("workspace_id", ws);
    if (removed.error) return "error";
  }
  const gone = await deps.admin.from("products").delete().eq("id", product.id).eq("workspace_id", ws);
  if (gone.error) return "error";

  const files = new Set(ads.map((a) => a.storage_path).filter(owned(ws)));
  for (const r of list) for (const path of await listFolder(deps.admin, runFolder(ws, r.id))) files.add(path);
  // Photos uploaded for this product (their rows went with the product).
  for (const path of await listFolder(deps.admin, `${ws}/uploads/${product.id}`)) files.add(path);
  await removeFiles(deps.admin, [...files]);
  return "ok";
}

const owned = (ws: string) => (path: string | null | undefined): path is string =>
  typeof path === "string" && path.startsWith(ws + "/");

async function cancelQueuedPosts(deps: DeleteDeps, ws: string, creativeIds: string[]) {
  if (!creativeIds.length) return true;
  const { data: posts, error } = await deps.admin
    .from("posts")
    .select("id, zernio_post_id")
    .eq("workspace_id", ws)
    .eq("status", "scheduled")
    .in("creative_id", creativeIds);
  if (error) return false;
  for (const post of posts ?? []) {
    try {
      if (post.zernio_post_id) await deps.cancelPost(post.zernio_post_id);
    } catch (err) {
      console.error("cancel before delete failed", post.id, err);
      return false;
    }
    const update = await deps.admin
      .from("posts")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", post.id)
      .eq("workspace_id", ws);
    if (update.error) return false;
  }
  return true;
}

// Every file under a folder, including sub-folders (video shots, sound).
async function listFolder(admin: SupabaseClient, folder: string, depth = 0): Promise<string[]> {
  const { data, error } = await admin.storage.from("creatives").list(folder, { limit: 1000 });
  if (error || !data) return [];
  const paths: string[] = [];
  for (const entry of data) {
    const path = `${folder}/${entry.name}`;
    // Folders come back without an id.
    if (entry.id === null) {
      if (depth < 3) paths.push(...(await listFolder(admin, path, depth + 1)));
    } else paths.push(path);
  }
  return paths;
}

// The rows are already gone, so a failed file removal only leaves an
// unreachable file behind. Logged, never shown to the customer as a failure.
async function removeFiles(admin: SupabaseClient, paths: string[]) {
  for (let i = 0; i < paths.length; i += 500) {
    const { error } = await admin.storage.from("creatives").remove(paths.slice(i, i + 500));
    if (error) console.error("storage cleanup failed", error.message);
  }
}
