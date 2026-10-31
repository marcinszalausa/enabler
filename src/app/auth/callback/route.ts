import { safeNextPath } from "@/lib/onboarding";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Supabase sends the magic-link click here with a one-time code.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const safeNext = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(safeNext, origin));
    }
  }

  const failed = new URL("/login", origin);
  failed.searchParams.set("error", "link");
  failed.searchParams.set("next", safeNext);
  return NextResponse.redirect(failed);
}
