# Enabler

AI ad creation for small and medium businesses: paste a product or website URL, get ready-to-run image and video ads, publish to Meta.

Stack: Next.js 16 (App Router, Cache Components) · Supabase (Postgres, Auth, Storage) · fal.ai · Claude API · Vercel.

## Setup

1. **Install:** `npm install`
2. **Environment:** copy `.env.example` to `.env.local` and fill in the Supabase URL and keys (Supabase > Project Settings > API Keys).
3. **Database:** in Supabase > SQL Editor, paste and run `supabase/migrations/0001_init.sql`. It creates the tables, Row Level Security policies, the signup trigger that gives each new user a workspace, and the private `creatives` storage bucket. Then run the later files in order (`0002_generation.sql`, `0003_brand_kit.sql`, `0004_billing.sql`, ...), each once.
4. **Auth redirect URLs:** in Supabase > Authentication > URL Configuration, set Site URL to your production URL and add `http://localhost:3000/**` and `https://*.vercel.app/**` to Redirect URLs.
5. **Run:** `npm run dev` and open http://localhost:3000.

## Deploy (Vercel)

Import the repo in Vercel, add the variables from `.env.example` under Settings > Environment Variables, and deploy. Every push to `main` deploys to production; every pull request gets a preview URL.

## Billing (Stripe)

1. In Stripe, create a product per plan (Starter, Growth) with a monthly recurring price, and put the price ids in `STRIPE_PRICE_STARTER` and `STRIPE_PRICE_GROWTH`.
2. Add a webhook endpoint `https://<your-domain>/api/stripe/webhook` for `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted` and `invoice.paid`, and put its signing secret in `STRIPE_WEBHOOK_SECRET`.
3. Turn on the customer portal (Settings > Billing > Customer portal) so subscribers can switch plans, update cards and cancel.

Plan credits are defined in `src/lib/billing.ts`; each paid invoice tops the workspace up to its plan's monthly allowance.

## Layout

- `src/proxy.ts`: refreshes the Supabase session on each request and protects `/dashboard`
- `src/lib/supabase/`: browser, server and proxy Supabase clients
- `src/lib/auth.ts`: `getCurrentUser()` for server components
- `src/app/login`: magic-link sign-in
- `src/app/auth/callback`, `src/app/auth/signout`: auth routes
- `src/app/dashboard`: workspace dashboard
- `supabase/migrations/`: database schema
