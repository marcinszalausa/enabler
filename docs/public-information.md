# Public product information

Adds a full-screen native-dialog mobile menu, a desktop feature menu, seven product explanation pages, an overview, resources, About and detailed pricing. Every navigation item leads to an implemented page or an existing section; there are no empty blog links, fabricated customer stories, ratings or discounts.

Copy leads with customer benefits. Feature descriptions explain current boundaries: separate image/video batches, image and caption editing, rendered video limits, social posting versus paid ad spend, and analytics availability. About describes the product without inventing an operator entity, address, staff or business history. No visible pre-launch notice is introduced.

Public plan prices remain $0, $29 and $79 USD. Credit allowances remain 100 one-time, 300 monthly and 1,000 monthly. Social account limits come from the application policy. The homepage and pricing page share one set of plan cards and prices. Image capacities explicitly depend on quality and assume the entire allowance is used for images. The calculator uses the same image/video cost functions as generation and rounds down to complete batches; it never spends credits. Paid buttons retain the billing-policy destination. Checkout remains disabled, and no payment, subscription or entitlement logic changes.

New content is English for the initial US market. Existing localized navigation and controls still work; untranslated page variants canonicalize to their English edition and only the English information pages enter the sitemap. Feature routes use static params and no provider or database calls. Links disable eager prefetch in menus to avoid loading many destinations on the first visit. No new media or heavy client library is added.

Browser validation covers real routes at mobile, desktop and RTL sizes; menu focus confinement, Escape, restored scrolling and link dismissal; three plan prices; image/video calculator boundaries; unknown-feature 404; sitemap and canonical metadata. It performs no generation, social posting or checkout.
