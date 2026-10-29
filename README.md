# Enabler

AI ad creation for small and medium businesses: paste a product or website URL, get ready-to-run image and video ads, publish to Meta.

Stack: Next.js 16 (App Router, Cache Components) · Supabase (Postgres, Auth, Storage) · fal.ai · Claude API · Vercel.

## Setup

1. **Install:** `npm install`
2. **Environment:** copy `.env.example` to `.env.local` and fill in the Supabase URL and keys (Supabase > Project Settings > API Keys).
3. **Database:** in Supabase > SQL Editor, paste and run `supabase/migrations/0001_init.sql`. It creates the tables, Row Level Security policies, the signup trigger that gives each new user a workspace, and the private `creatives` storage bucket. Then run the later files in order (`0002_generation.sql`, `0003_brand_kit.sql`, ...), each once. `0005_showcase.sql` adds the "Show on gooidy.com" switch; set `SHOWCASE_ADMIN_EMAILS` to the team emails allowed to use it. `0006_video_ads.sql` and `0007_video_shots.sql` add video ads: Kling 3 Pro films the shots, ElevenLabs v3 speaks the voiceover and Stable Audio 2.5 makes the music (all on fal), and the bundled ffmpeg edits them together with captions.
4. **Auth redirect URLs:** in Supabase > Authentication > URL Configuration, set Site URL to your production URL and add `http://localhost:3000/**` and `https://*.vercel.app/**` to Redirect URLs.
5. **Run:** `npm run dev` and open http://localhost:3000.

## Deploy (Vercel)

Import the repo in Vercel, add the variables from `.env.example` under Settings > Environment Variables, and deploy. Every push to `main` deploys to production; every pull request gets a preview URL.

## Layout

- `src/proxy.ts`: picks the visitor's language (cookie, then browser language), rewrites to `src/app/[locale]/...`, refreshes the Supabase session and protects `/dashboard`
- `src/i18n/`: site languages (`config.ts`), translations (`messages/`, English in `en.ts` is the source shape) and helpers. English pages have no prefix, other languages live at `/de/...`, `/ja/...`; `/dashboard` and `/login` keep one address and follow the `gooidy-locale` cookie. Legal pages stay in English
- `src/lib/supabase/`: browser, server and proxy Supabase clients
- `src/lib/auth.ts`: `getCurrentUser()` for server components
- `src/app/[locale]/login`: magic-link sign-in
- `src/app/auth/callback`, `src/app/auth/signout`: auth routes
- `src/app/[locale]/dashboard`: workspace dashboard
- `src/lib/languages.ts`: the languages ads are written and spoken in. `src/lib/ad-text.ts` gives the ad renderer what each script needs: Japanese, Korean and Chinese glyphs fetched from Google Fonts, and Hindi and Arabic drawn with Skia (`@napi-rs/canvas`, bundled Noto fonts), since Satori can't shape them
- `supabase/migrations/`: database schema
