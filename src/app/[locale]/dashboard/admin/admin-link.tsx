import Link from "next/link";
import { isPlatformAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

// The account menu's Admin entry, only for Gooidy admins. The admin pages
// check access again on their own.
export async function AdminLink() {
  const { data } = await (await createClient()).auth.getClaims();
  if (!(await isPlatformAdmin(data?.claims?.sub))) return null;
  return (
    <Link href="/dashboard/admin" className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-accent hover:bg-surface">
      Admin dashboard
    </Link>
  );
}
