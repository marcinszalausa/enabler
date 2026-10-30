// Ephemeral browser fixture; removed before any deployment.
import assert from "node:assert/strict";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { setTimeout as pause } from "node:timers/promises";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH);
const folder = "src/app/[locale]/public-ui-preview";
let server, browser, log = "";
try {
  await mkdir(folder, { recursive: true });
  await writeFile(folder + "/page.tsx", "import { Nav, Footer, SectionHeading } from \"@/app/_landing/chrome\";\nimport { BeforeAfter } from \"@/app/_landing/before-after\";\nimport { CreditGuide } from \"@/app/_landing/credit-guide\";\nimport { getMessages } from \"@/i18n/messages\";\nimport { isLocale } from \"@/i18n/config\";\nexport default async function PublicUiPreview({params}:PageProps<\"/[locale]/public-ui-preview\">){\nconst {locale}=await params;if(!isLocale(locale))return null;const t=await getMessages(locale);return <div className=\"landing bg-bg text-fg\"><Nav/><main id=\"main-content\" tabIndex={-1}>\n<section id=\"how\" className=\"mx-auto max-w-6xl px-4 py-12\"><SectionHeading title={t.home.titleLine1} sub={t.home.intro}/></section>\n<BeforeAfter photo=\"/reels/softmila-cardigan.jpg\" name=\"Example cardigan\" url=\"https://softmila.com/products/modest-wrap-cardigan\" ads={[{image:\"/reels/softmila-still.jpg\",alt:\"Example generated ad\"}]}/>\n<section id=\"pricing\" className=\"mx-auto max-w-6xl px-4 py-12\"><SectionHeading title={t.home.pricingTitle} sub={t.home.pricingSub}/><CreditGuide imageCost={10} imagesPerRun={10}/></section>\n<section id=\"faq\" className=\"px-4 py-12\"><SectionHeading title={t.home.faqTitle}/></section></main><Footer/></div>}");
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", "3100"], {
    env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture" },
    detached: true, stdio: ["ignore", "pipe", "pipe"],
  });
  const capture = chunk => { log = (log + chunk).slice(-12000); };
  server.stdout.on("data", capture); server.stderr.on("data", capture);
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch("http://localhost:3100/public-ui-preview", { signal: AbortSignal.timeout(2000) })).ok) { ready = true; break; } } catch {}
    await pause(1000);
  }
  assert.ok(ready);
  browser = await chromium.launch({ headless: true });
  for (const [width, locale, theme] of [[320,"en","light"],[390,"en","dark"],[768,"de","light"],[390,"ar","light"],[1440,"en","light"]]) {
    const page = await browser.newPage({ viewport: { width, height: 950 }, reducedMotion: "reduce", locale: "en-US" });
    const errors = []; page.on("pageerror", e => errors.push(e.message));
    const prefix = locale === "en" ? "" : "/" + locale;
    await page.goto("http://localhost:3100" + prefix + "/public-ui-preview", { waitUntil: "networkidle", timeout: 90000 });
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme; document.querySelectorAll(".reveal").forEach(el => el.classList.add("in")); }, theme);
    await page.addStyleTag({ content: ".reveal{opacity:1!important;transform:none!important}" });
    await page.keyboard.press("Tab");
    assert.equal(await page.locator(".skip-link").evaluate(el => el === document.activeElement), true);
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("#main-content").evaluate(el => el === document.activeElement), true);
    if (width < 1024) {
      const menu = page.locator(".mobile-nav"), summary = menu.locator("summary");
      await summary.click(); assert.equal(await menu.getAttribute("open"), "");
      await page.keyboard.press("Escape"); assert.equal(await menu.getAttribute("open"), null);
      assert.equal(await summary.evaluate(el => el === document.activeElement), true);
      await summary.click();
      await menu.locator('a[href$="#how"]').click();
      assert.equal(await menu.getAttribute("open"), null);
      for (const el of [summary,page.locator('button[title]').first(),page.locator('select').first()]) {
        assert.ok((await el.boundingBox()).height >= 44, "Comfortable mobile target");
      }
    }
    const comparison = page.locator('[data-single-product-display="before-after"]').locator("..").locator("..");
    const buttons = comparison.locator("button");
    for (let i = 0; i < await buttons.count(); i++) {
      await buttons.nth(i).click();
      assert.equal(await comparison.locator("img").count(), 1, "One product variant visible at a time");
      assert.equal(await buttons.nth(i).getAttribute("aria-pressed"), "true");
      assert.ok((await buttons.nth(i).boundingBox()).height >= 44);
    }
    const guide = page.locator("[data-credit-guide]");
    assert.equal(await guide.locator("tbody tr").count(), 5);
    const costs = await guide.locator("tbody tr td:last-child").allTextContents();
    assert.deepEqual(costs.map(x => Number(x.match(/\d+/)[0])), [40,60,90,120,180], "Video run costs match application choices");
    assert.equal(await page.locator('footer a[href="mailto:hello@gooidy.com"]').count(), 1);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "No horizontal overflow: " + width + " " + locale);
    assert.deepEqual(errors, []);
    if ((width === 390 && locale === "en") || width === 1440) {
      await guide.scrollIntoViewIfNeeded();
      const buffer = await page.screenshot({ type: "jpeg", quality: 75 });
      const data = buffer.toString("base64"), name = theme + "-" + width;
      for (let i = 0; i < data.length; i += 4000) console.log("PUBLIC_UI_IMAGE", name, i / 4000, data.slice(i, i + 4000));
    }
    console.log("PASS public UI", width, locale, theme);
    await page.close();
  }
} catch (error) { console.error(log); throw error; }
finally {
  if (browser) await browser.close();
  if (server) { try { process.kill(-server.pid, "SIGTERM"); } catch {} }
  await rm(folder, { recursive: true, force: true });
}
