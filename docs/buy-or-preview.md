# Buy or explore first

Pricing cards give Buy Starter / Buy Plus / Buy Growth the primary position, with Try for free as an optional secondary link. The pricing hero points to plan selection. The free allowance remains 100 credits once, shared across the account; selecting a plan never refills it or grants paid access.

The purchase path goes directly to /checkout?plan=..., without a product import or free-generation prerequisite. It validates the plan and shows its real monthly amount and benefits. It is not a working payment integration. The existing checkout API remains closed. The page makes payment unavailability explicit and never claims a purchase completed or activates entitlements.

Do not deploy the primary Buy journey as a working purchase option until Stripe checkout, verified webhook fulfillment, recurring credit accounting, customer cancellation, optional social-account entitlements and billing/operator configuration have been implemented and tested. Missing payment configuration is a launch blocker, not something hidden by renaming a button.

No money is charged, no credits are granted, no customer data is modified, and no provider requests are made by these UI changes.
