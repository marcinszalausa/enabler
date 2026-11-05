import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminData, AdminUser, CreditTotal } from "@/lib/admin-stats";

// Gooidy staff are listed in private.platform_admins (added by hand in the
// Supabase SQL editor). The check runs on the server with the service key,
// for a user id that Supabase Auth has verified. Any error means "no".
export const isPlatformAdmin = cache(async (userId: string | null | undefined) => {
  if (!userId) return false;
  try {
    const { data, error } = await createAdminClient().rpc("is_platform_admin", { uid: userId });
    return !error && data === true;
  } catch {
    return false;
  }
});

// Admin pages call this first. Non-admins get a plain 404, so the page
// doesn't reveal that it exists.
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!(await isPlatformAdmin(user.id))) notFound();
  return user;
}

const LIMIT = 20_000;

async function allUsers(): Promise<AdminUser[]> {
  const db = createAdminClient();
  const users: AdminUser[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users.map((u) => ({ id: u.id, email: u.email ?? "", created_at: u.created_at, last_sign_in_at: u.last_sign_in_at ?? null })));
    if (data.users.length < 1000) break;
  }
  return users;
}

function credits(rows: unknown): CreditTotal[] {
  return ((rows as CreditTotal[] | null) ?? []).map((r) => ({ workspace_id: r.workspace_id, charged: Number(r.charged), refunded: Number(r.refunded) }));
}

// Everything the overview needs, read once with the service key. Call only
// after requireAdmin().
export async function loadAdminData(): Promise<AdminData> {
  const db = createAdminClient();
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [users, workspaces, generations, posts, accounts, products, all, last30] = await Promise.all([
    allUsers(),
    db.from("workspaces").select("id,name,owner_id,plan,credits,created_at").limit(LIMIT),
    db.from("generations").select("id,workspace_id,product_id,type,status,cost_credits,cost_usd,request_options,created_at").order("created_at", { ascending: false }).limit(LIMIT),
    db.from("posts").select("id,workspace_id,status,created_at").limit(LIMIT),
    db.from("social_accounts").select("id,workspace_id,platform").limit(LIMIT),
    db.from("products").select("id,workspace_id").limit(LIMIT),
    db.rpc("admin_credit_totals", { since: null }),
    db.rpc("admin_credit_totals", { since: since30 }),
  ]);
  for (const r of [workspaces, generations, posts, accounts, products, all, last30]) if (r.error) throw r.error;
  return {
    users,
    workspaces: workspaces.data ?? [],
    generations: generations.data ?? [],
    posts: posts.data ?? [],
    accounts: accounts.data ?? [],
    products: products.data ?? [],
    credits: credits(all.data),
    credits30: credits(last30.data),
  };
}

// One customer's workspace in detail.
export async function loadCustomer(workspaceId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) return null;
  const db = createAdminClient();
  const { data: workspace, error } = await db.from("workspaces").select("id,name,owner_id,plan,credits,created_at").eq("id", workspaceId).maybeSingle();
  if (error) throw error;
  if (!workspace) return null;
  const [owner, members, products, generations, posts, accounts, total] = await Promise.all([
    db.auth.admin.getUserById(workspace.owner_id).catch(() => ({ data: { user: null } })),
    db.from("workspace_members").select("user_id,role,created_at").eq("workspace_id", workspaceId),
    db.from("products").select("id,name,url,created_at").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(200),
    db.from("generations").select("id,workspace_id,product_id,type,status,cost_credits,cost_usd,request_options,created_at,model,error").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(200),
    db.from("posts").select("id,status,caption,account_ids,scheduled_for,created_at,error").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(100),
    db.from("social_accounts").select("id,platform,username,display_name,created_at").eq("workspace_id", workspaceId),
    db.rpc("admin_credit_totals", { since: null }),
  ]);
  for (const r of [members, products, generations, posts, accounts, total]) if (r.error) throw r.error;
  const grants = await creditGrants(workspaceId);
  const user = owner.data?.user;
  return {
    workspace,
    owner: user ? { id: user.id, email: user.email ?? "", created_at: user.created_at, last_sign_in_at: user.last_sign_in_at ?? null, confirmed: Boolean(user.email_confirmed_at) } : null,
    members: members.data ?? [],
    products: products.data ?? [],
    generations: generations.data ?? [],
    posts: posts.data ?? [],
    accounts: accounts.data ?? [],
    credits: credits(total.data).find((c) => c.workspace_id === workspaceId),
    grants,
  };
}

export type CreditGrant = { id: string; workspace_id: string; admin_email: string | null; amount: number; note: string; balance_after: number; created_at: string };

// Credits admins added or removed by hand. Empty until the grants SQL has run.
export async function creditGrants(workspaceId: string | null): Promise<CreditGrant[]> {
  const { data, error } = await createAdminClient().rpc("admin_credit_grant_history", { ws: workspaceId });
  return error ? [] : ((data as CreditGrant[] | null) ?? []);
}
