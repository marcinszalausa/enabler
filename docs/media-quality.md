# Generated-media quality gates
This release strengthens new image and video runs. Existing saved creatives are unchanged.

## Acceptance
- Images must decode, meet a native-resolution/proportion floor (960 square or 720×1280 portrait, with 4% ratio tolerance), and not be almost uniform. This is a technical floor, not a claim of visual excellence.
- Every accepted photo requires a valid visual-review verdict. Checker errors retry review of the same candidate once, then stop. They do not approve an unchecked result or spend more image-generation attempts.
- Visible defects permit up to three image candidates total, with defect feedback and the existing higher-tier retry model. Review still uses the original product photo when available; a generated continuity frame is separately labeled and cannot silently replace the original.
- Finished video shots must decode, cover their planned duration and meet an HD/proportion floor. Beginning, middle and near-end frames from every shot are reviewed together before editing, storing a final MP4 or reporting completion. Up to 7 shots / 21 samples per ad. Sampling and API calls are bounded.
- Later-shot failures no longer silently replace all later images with the opening image.
- Copy prompts preserve genuine branding, pairs/sets and product details, avoid forced human models in product-only/pet scenes, and prohibit invented commercial claims.
- Measured narration must fit at no more than 1.2× tempo. Otherwise the edit fails instead of cutting off words. Background music ducks under narration. Existing full-frame, face-aware overlays and 1080×1920 fast-start export remain.
- Existing durable-output settlement returns credits for undelivered outputs. The concurrently merged credit prices and stored-run-price refunds are preserved. This quality change adds no further credit-price, role or schema changes.

## Cost and timing
The visual review of finished video frames adds Anthropic vision usage and processing time. A failed checker can cause a refundable failure instead of unchecked delivery. Image generation remains bounded to the prior three attempts; review outage retries do not regenerate media. The concurrently merged Sonnet 5.5 review model is retained for image and video review; copy/script writing remains on Opus. Existing generation model IDs remain in use, with a roughly one-megapixel text-only fallback image size; no unsupported newer model is substituted without benchmarking.

## Verification
Pure tests cover outage/invalid-verdict behavior, retry budgets, defect feedback, sample coverage and narration limits. Synthetic JPEG/MP4/audio fixtures cover corrupt/blank/short/low-resolution rejection and real FFmpeg export. Dependency-mocked integration runs verify actual pipeline behavior, original-reference retention, and rejection before final video storage/completion. Network calls, real generations, emails and publishing are forbidden in these tests.

## Limits and release evaluation
AI review is fallible, sampled frames cannot prove smoothness between samples, and caption timing is still estimated from narration length. No claim that Gooidy leads competitors is established by passing these tests. Keep a human-reviewed benchmark before changing production models or thresholds.

Benchmark 20–30 representative source products: apparel, pets, packaged products, shiny/transparent objects, furniture, varied skin tones, product-only scenes, and localized text. Use equal briefs and native output sizes. Blind-review product identity/color/material, anatomy, composition, face/text separation, readability, motion/continuity, narration/caption timing and export quality. Record approval rate, severe-defect rate, latency, provider cost and regeneration count. Reject product-fidelity or rights/claims failures regardless of aesthetic score. Compare approved-output cost, not just price per provider call. Use designated test workspaces, never customer balances or publishing targets.

The offline fixtures verify safeguards and export behavior, not the aesthetic improvement of newly generated provider outputs. A controlled provider-backed benchmark is still needed for that claim.
