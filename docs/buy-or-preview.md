# Disabled purchase buttons and optional free preview

At the user's request, Buy Starter / Buy Plus / Buy Growth are visible, gray native disabled buttons. They have no href, event handler, form submission or payment side effect. A shared explanation identifies purchases as unavailable. Try for free remains a separate enabled link. The pricing hero points to plan selection.

The free allowance remains 100 credits once, shared across the account; selecting a plan never refills it or grants paid access. Customer balances and permissions do not change.

The unlinked /checkout?plan=... review route validates a selected plan and displays its monthly amount and benefits, but clearly reports online payment unavailability. It is noindex and cannot charge money. The checkout API remains closed.

Before enabling purchases, implement and test Stripe checkout, verified webhook fulfillment, recurring accounting, cancellation, new social-account entitlements and billing/operator configuration. Button copy is not payment integration. No actual purchase is offered in this release.

Browser checks verify native disabled state, absence of purchase links, no navigation from a programmatic disabled-button click, accessible status text, responsive layouts, the defensive purchase summary and all three optional free-preview handoffs. No real provider requests or customer changes are used in tests.
