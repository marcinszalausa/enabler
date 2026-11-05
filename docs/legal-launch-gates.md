# US paid launch: unresolved legal gates
Owner instruction: keep the legal operator and business mailing address unspecified until the entity is established. Initial paid market: US; businesses and individuals. Therefore these documents are expressly pre-launch drafts. They are not final paid terms or a legal-compliance certification.

## What this release does
- Publishes an original Gooidy-specific policy set, with a policy directory and privacy-request email links.
- Describes actual social publishing, face-placement analysis, cookies, and manual privacy handling.
- Removes an unverified universal 30-day deletion promise and guaranteed output ownership.
- Shows USD and the unavailable checkout status on pricing; paid cards lead to billing information.
- Adds an unconditional, non-paying POST /api/billing/checkout response (503 CHECKOUT_NOT_AVAILABLE). It does not read payment credentials, contact Stripe, or create a session. No environment variable enables it.
- Does not collect agreement to unfinished paid terms. No new account, billing or consent database records are created by this release.

## Required before replacing the checkout lock
1. Form the entity and publish its exact legal name, appropriate business/contact mailing address, contact method and any required registrations. Match the Stripe merchant identity.
2. Have US/Texas counsel review consumer subscriptions, applicable state renewal rules and privacy obligations; thresholds/exemptions must be assessed, not assumed from small-business status.
3. Finalize price/tax disclosures, recurring interval, trial rules, credit expiry/rollover, unused credits, upgrade/downgrade, refunds and cancellation. Implement the same behavior in billing.
4. Finalize policy text and effective date; archive the exact accepted content/version.
5. Implement server-verified, append-only terms acceptance for authenticated users: user ID from verified auth, document version/hash, server timestamp and acceptance source. Do not trust editable user metadata as proof or authorization. Require fresh acceptance for material changes where appropriate.
6. Obtain separate clear authorization for recurring charges at checkout. An unchecked affirmative control and conspicuous price/renewal/cancellation disclosures should be tested; no preselected marketing consent. Privacy notice acknowledgment is not blanket consent to every processing purpose.
7. Provide and test cancellation before offering recurring subscriptions. Confirm receipts, refunds, disputes and failed-payment behavior in Stripe test mode. US billing-address eligibility is one control, not a substitute for geographic/legal assessment.
8. Complete the privacy operations runbook, provider DPAs and transfer assessment, actual retention schedule and support ownership. Test export/deletion only on designated fixtures; no customer data destruction for testing.
9. Complete selected-provider commercial license, music, face/voice and model-training/retention review. Consider a customer DPA when processing personal data for business customers. No executed DPA is represented here.
10. Perform a production cookie/network inventory including provider dashboard settings; classify any new tracking and implement required preferences/signals before activating it.

## EU, EEA and UK (owner chose global coverage, November 4, 2026)
- The privacy policy now has a GDPR section: legal bases, rights, one-month response, complaints, transfers and retention.
- Before paid EU/UK service: appoint and list an EU (Art. 27) and UK representative, publish the controller's name and address, confirm each provider's DPF certification or SCCs, have counsel review the section, and translate final consumer terms for main markets.

Do not add copied arbitration or class-action waivers from another service without tailored legal advice. No LLC formation or copyright clearance is implied by these drafts.

## Research references (reviewed November 3, 2026)
Zeely coverage reference, not copied contract text:
- https://zeely.ai/terms-of-service/
- https://zeely.ai/subscription-and-refund-policyzeely/
- https://zeely.ai/privacy-policy/
- https://zeely.ai/cookie-policy-for-zeely-website/
Primary guidance:
- https://docs.stripe.com/get-started/checklist/website
- https://www.ftc.gov/business-guidance/blog/2016/09/negative-options-make-them-positive
- https://www.texasattorneygeneral.gov/consumer-protection/file-consumer-complaint/consumer-privacy-rights
- https://copyright.gov/newsnet/2025/1060.html
