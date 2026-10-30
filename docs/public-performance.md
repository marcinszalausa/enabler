# Public page performance

The baseline mobile Lighthouse run (Chrome, Lighthouse 12.8.2, default mobile
simulation) measured FCP 1.19 s, LCP 3.10 s, TBT 89 ms, CLS 0, and 787,071
transferred bytes. The LCP element was the introductory paragraph; 79% of its
timing was render delay. Hidden carousel slides and oversized images appeared
in the image-delivery audit. An unused route chunk accounted for about 70 KiB.

Changes:
- Paint an optimized image before rotating into video.
- Mount only the current, previous, and next nearby image slots.
- Attach video sources only while visible, idle, and foregrounded; abort buffers
  when the video unmounts. Data saving and reduced motion require explicit play.
- Mount only the selected ad angle, not every overlapping variant.
- Add 160/192/320/480px optimized image widths and responsive store-photo sources.
- Use optional font display, preload only the common Latin subset, and defer
  monospace font preloading. Other Unicode subsets remain available as needed.
- Disable speculative prefetch of protected sign-in/dashboard links.
- Throttle pointer lighting to one update per animation frame, stop offscreen
  stage pointer work, and keep decorative touch-device lighting static.

No database migration, credentials, or provider calls are involved. Core account
and generation behavior is unchanged. Product-spacing regression checks remain.

Validation:
The controlled browser fixture compares the original and optimized PhoneFeed and
AngleExplorer against identical assets and layout. It reports request/byte counts
and verifies hidden media, explicit playback, offscreen cleanup, and a simulated
visibilitychange. These fixture results are not production Web Vitals.

The performance workflow measures the live public site three times and reports
median lab metrics. On main it waits for Vercel's commit deployment to succeed
before measuring. Reports are uploaded as artifacts. Real-user field metrics
depend on devices, networks, and traffic and are not established by this test.

Dashboard image grids additionally request a 640px WebP preview after the existing
authorization and showcase checks. Private cache headers remain private. Normal
image requests, downloads (including a simultaneous preview flag), and publishing
retain the original full-resolution PNG. Preview failures fall back to the
original response. Sharp 0.35.5 is promoted from Next's existing locked optional
dependency to an explicit exact dependency; no library version upgrade is needed.

The photographic fixture measured 2,771,257 PNG bytes versus 41,864 preview bytes.
This is a controlled sample, not a promise for every creative. Main-deployment
verification checks a live public preview and confirms downloads remain full-size
PNG attachments. An authenticated dashboard session is not available to the CI
runner, so private header preservation and export selection are covered by tests
while the existing route authorization is retained.
