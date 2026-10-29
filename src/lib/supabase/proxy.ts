import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "./env";

const PROTECTED_PREFIXES = ["/dashboard"];

// Refreshes the auth session on every request and keeps signed-out
// visitors away from protected pages. `rewrite` serves the page from another
// path (the page in the visitor's language) without changing the address.
export async function updateSession(request: NextRequest, rewrite?: URL) {
  const pass = () =>
    rewrite
      ? NextResponse.rewrite(rewrite, { request })
      : NextResponse.next({ request });
  let response = pass();

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = pass();
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims);
  const path = request.nextUrl.pathname;

  if (!isSignedIn && PROTECTED_PREFIXES.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Keep the query too, so a link pasted on the landing page survives sign-in.
    url.search = "";
    url.searchParams.set("next", path + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  if (isSignedIn && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
