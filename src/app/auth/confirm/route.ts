import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// The sign-in email links here with a token hash. Unlike /auth/callback's
// one-time code, it's checked on the server, so the link works in any
// browser: the Gmail app's, another phone's, not just the one that asked.
//
// Email template link:
// {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = (searchParams.get("type") ?? "email") as EmailOtpType;
  const next = nextPath(request);

  if (tokenHash) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=link", origin));
}

// `next` is the address the sign-in asked to return to (the template's
// RedirectTo): usually our /auth/callback?next=/somewhere. The template may
// not encode it, so take everything after "next=" as is, and only ever keep
// a path on this site.
function nextPath(request: NextRequest) {
  const fallback = "/dashboard";
  const search = request.nextUrl.search;
  const at = search.search(/[?&]next=/);
  if (at < 0) return fallback;
  const raw = search.slice(at + "&next=".length);

  let url: URL;
  try {
    const value = /^https?%3A/i.test(raw) ? decodeURIComponent(raw) : raw;
    url = new URL(value, request.nextUrl.origin);
  } catch {
    return fallback;
  }
  if (url.host !== request.nextUrl.host) return fallback;

  const path =
    url.pathname === "/auth/callback"
      ? (url.searchParams.get("next") ?? fallback)
      : url.pathname + url.search;
  const safe = path.startsWith("/") && !path.startsWith("//");
  return safe && path !== "/" ? path : fallback;
}
