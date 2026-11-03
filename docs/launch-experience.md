# Launch experience checks
This change adds localized recovery screens for public pages and dashboard pages. The ads library uses the same recovery actions. Retry uses the installed Next.js retry callback, which refetches the failed segment; it does not submit a generation, payment or publishing action. Customer-facing recovery UI never renders exception messages or stack traces.

Product-link forms keep input when validation fails, associate the error with the input, and return focus for correction. Empty homepage submissions still lead to the guided start page; JavaScript-free forms still use the existing server validation.

Browser fixtures simulate server and client rendering failures, recovery after the fault clears, preview failure, invalid links, mobile/desktop layouts and Arabic direction. Fixture routes are created only inside disposable CI checkouts.

Before accepting paid customers, separately verify checkout and subscription lifecycle in Stripe test mode, email delivery, first successful campaign, downloading and publishing, cancellation, and support response ownership. This UI change does not certify those external services.
