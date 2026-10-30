// Public production smoke checks. No login, writes, paid AI calls, or publishing.
import assert from "node:assert/strict";
import { fetchPublicUrl } from "../src/lib/public-fetch.ts";

const origin = "https://gooidy.com";
let failures = 0;
async function check(name, run) {
  try { await run(); console.log("PASS", name); }
  catch (error) { failures++; console.error("FAIL", name, error instanceof Error ? error.message : "Unknown error"); }
}
async function page(path, expected = 200) {
  const response = await fetch(origin + path, {
    headers: { "user-agent": "GooidySmokeBot/1.0", "accept-language": "en" },
    redirect: "manual", signal: AbortSignal.timeout(30000),
  });
  assert.equal(response.status, expected, path + " status");
  return response;
}
await check("English landing page", async () => {
  const response = await page("/");
  assert.match(await response.text(), /gooidy/i);
});
await check("Login form loads", async () => {
  const response = await page("/login");
  assert.match(await response.text(), /type="email"/);
});
await check("Signed-out dashboard preserves return URL", async () => {
  const response = await page("/dashboard?smoke=1", 307);
  const target = new URL(response.headers.get("location"), origin);
  assert.equal(target.origin, origin);
  assert.equal(target.pathname, "/login");
  assert.equal(target.searchParams.get("next"), "/dashboard?smoke=1");
});
await check("Localized app URL redirects to canonical path", async () => {
  const response = await page("/pl/dashboard", 308);
  assert.equal(new URL(response.headers.get("location"), origin).pathname, "/dashboard");
});
await check("Polish landing page", async () => { await page("/pl"); });
await check("Unknown creative does not expose media", async () => {
  await page("/api/creatives/00000000-0000-4000-8000-000000000000/image", 404);
});
await check("Static image and video assets load", async () => {
  for (const path of ["/reels/softmila-cardigan.jpg", "/reels/softmila-cardigan.mp4"]) {
    const response = await fetch(origin + path, {method:"HEAD",signal:AbortSignal.timeout(30000)});
    assert.equal(response.status,200,path);
    assert.match(response.headers.get("content-type") ?? "",path.endsWith(".jpg") ? /image\/jpeg/ : /video\/mp4/);
  }
});
await check("Pinned downloader fetches public HTML with valid TLS", async () => {
  const response = await fetchPublicUrl(origin, {maxBytes:2_000_000,timeoutMs:30000});
  assert.equal(response.status,200);
  assert.match(response.body.toString("utf8"),/gooidy/i);
});
await check("Pinned downloader fetches image and video", async () => {
  for (const [path, type] of [["/reels/softmila-cardigan.jpg","image/jpeg"],["/reels/softmila-cardigan.mp4","video/mp4"]]) {
    const response = await fetchPublicUrl(origin + path,{maxBytes:4*1024*1024,timeoutMs:30000});
    assert.equal(response.status,200);
    assert.equal(response.contentType,type);
    assert.ok(response.body.length>10000);
  }
});
await check("Google Fonts CSS and CJK font remain compatible", async () => {
  const response=await fetchPublicUrl("https://fonts.googleapis.com/css2?family=Noto%20Sans%20JP:wght@700&text=%E6%97%A5%E6%9C%AC",{maxBytes:256*1024,timeoutMs:15000,accept:"text/css"});
  assert.equal(response.status,200);
  const fontUrl=response.body.toString("utf8").match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1];
  assert.ok(fontUrl,"Google CSS contains a font supported by Satori");
  const font=await fetchPublicUrl(fontUrl,{maxBytes:8*1024*1024,timeoutMs:15000});
  assert.equal(font.status,200);
  assert.ok(font.body.length>100);
});
console.log("Public smoke failures:",failures);
process.exitCode=failures?1:0;
