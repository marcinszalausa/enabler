import type { NextRequest } from "next/server";
import { localCurrency } from "@/lib/fx";

// The visitor's currency and its rate per dollar, from the country Vercel
// locates them in (?country=PL overrides it, for testing).
export async function GET(request: NextRequest) {
  const country =
    request.nextUrl.searchParams.get("country") ??
    request.headers.get("x-vercel-ip-country");
  return Response.json(await localCurrency(country), {
    // Differs per visitor, so only their browser may keep it.
    headers: { "Cache-Control": "private, max-age=3600" },
  });
}
