# Enabler

AI ad creation for small and medium businesses: paste a product or website URL, get ready-to-run image and video ads, publish to Meta.

Stack: Next.js 16 (App Router, Cache Components) · Supabase (Postgres, Auth, Storage) · fal.ai · Claude API · Vercel.

## Setup

1. **Install:** `npm install`
2. **Environment:** copy `.env.example` to `.env.local` and fill in the Supabase URL and keys (Supabase > Project Settings > API Keys).
3. **Database:** in Supabase > SQL Editor, paste and run `supabase/migrations/0001_init.sql`. It creates the tables, Row Level Security policies, the signup trigger that gives each new user a workspace, and the private `creatives` storage bucket. Then run the later files in order (`0002_generation.sql`, `0003_brand_kit.sql`, ...), each once. `0005_showcase.sql` adds the "Show on gooidy.com" switch; set `SHOWCASE_ADMIN_EMAILS` to the team emails allowed to use it. `0006_video_ads.sql` and `0007_video_shots.sql` add video ads: Kling 3 Pro films the shots, ElevenLabs v3 speaks the voiceover and Stable Audio 2.5 makes the music (all on fal), and the bundled ffmpeg edits them together with captions. `0008_billing.sql` adds Stripe billing and credit packs.
4. **Auth redirect URLs:** in Supabase > Authentication > URL Configuration, set Site URL to your production URL and add `http://localhost:3000/**` and `https://*.vercel.app/**` to Redirect URLs.
5. **Run:** `npm run dev` and open http://localhost:3000.

## Deploy (Vercel)

Import the repo in Vercel, add the variables from `.env.example` under Settings > Environment Variables, and deploy. Every push to `main` deploys to production; every pull request gets a preview URL.

## Billing (Stripe)

Prices are set in US dollars only. Stripe's Adaptive Pricing shows each buyer the price in their own currency (PLN, EUR, JPY...) and pays out in dollars; the buyer pays the 2–4% conversion fee. Don't add other currencies to the prices: a price with a currency option for, say, EUR stops Adaptive Pricing from converting to EUR.

1. **Plans, webhook and portal:** `STRIPE_SECRET_KEY=sk_test_... npm run stripe:setup -- https://<your-domain>`. It creates a product and monthly price per plan (Starter, Plus, Growth), the webhook endpoint `/api/stripe/webhook` and the customer portal, and prints the environment variables to add. It is safe to run again.
2. **Adaptive Pricing:** turn it on in Stripe > Settings > Payments > Adaptive Pricing.
3. **Payment methods:** turn on the ones you want in Stripe > Settings > Payments > Payment methods. Checkout offers each buyer the ones that fit their country. Monthly plans paid in another currency can use cards, Apple Pay, Google Pay and Link; one-time credit packs can also use local methods such as BLIK, Przelewy24, iDEAL, Bancontact, PayPal, Klarna, Pix, Alipay and WeChat Pay.
4. **Tax (optional):** set up Stripe Tax and set `STRIPE_AUTOMATIC_TAX=on` to add VAT or sales tax at checkout and collect business tax ids.

Plan credits are in `src/lib/billing.ts` and prices in `src/lib/pricing.ts`; each paid invoice tops the workspace up to its plan's monthly allowance, and each paid credit pack adds its credits once. To test another country in Checkout, give the Stripe customer an email such as `test+location_PL@example.com`.

## Layout

- `src/proxy.ts`: picks the visitor's language (saved choice, then a non-English browser language, then their country via Vercel's `x-vercel-ip-country`), rewrites to `src/app/[locale]/...`, refreshes the Supabase session and protects `/dashboard`
- `src/i18n/`: site languages (`config.ts`), translations (`messages/`, English in `en.ts` is the source shape) and helpers. English pages have no prefix, other languages live at `/de/...`, `/ja/...`; `/dashboard` and `/login` keep one address and follow the `gooidy-locale` cookie. Legal pages stay in English
- `src/lib/supabase/`: browser, server and proxy Supabase clients
- `src/lib/auth.ts`: `getCurrentUser()` for server components
- `src/app/[locale]/login`: magic-link sign-in
- `src/app/auth/callback`, `src/app/auth/signout`: auth routes
- `src/app/[locale]/dashboard`: workspace dashboard
- `src/lib/languages.ts`: the languages ads are written and spoken in. `src/lib/ad-text.ts` gives the ad renderer what each script needs: Japanese, Korean and Chinese glyphs fetched from Google Fonts, and Hindi and Arabic drawn with Skia (`@napi-rs/canvas`, bundled Noto fonts), since Satori can't shape them
- `supabase/migrations/`: database schema
