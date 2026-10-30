// Exercise client rendering without sending emails or changing accounts.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH);
const browser = await chromium.launch({headless:true});
try {
  const page = await browser.newPage({locale:"en-US"});
  const errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.goto("https://gooidy.com/login",{waitUntil:"networkidle",timeout:60000});
  await page.locator('input[type="email"]').waitFor({state:"visible",timeout:30000});
  await page.locator('input[type="email"]').fill("smoke@example.invalid");
  assert.equal(await page.locator('input[type="email"]').inputValue(),"smoke@example.invalid");
  assert.equal(await page.locator('button[type="submit"]').isEnabled(),true);
  assert.deepEqual(errors,[],"No uncaught client errors on login");
  console.log("PASS login form hydrates, accepts email, and enables submit (not submitted)");
  await page.goto("https://gooidy.com/dashboard",{waitUntil:"networkidle",timeout:60000});
  assert.equal(new URL(page.url()).pathname,"/login");
  await page.locator('input[type="email"]').waitFor({state:"visible",timeout:30000});
  console.log("PASS signed-out browser returns from dashboard to functional login");
} finally { await browser.close(); }
