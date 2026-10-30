# Public URL fetching

## Policy and transport
All application-controlled downloads of product HTML/Shopify JSON, logos, AI
media and remote font data use fetchPublicUrl. Signed Zernio storage uploads use
the same destination policy with PUT and no redirects. No cookies, authorization
headers or caller-supplied headers are forwarded to these targets.

URL syntax checks permit HTTP(S), default ports only, and no URL credentials,
control characters or backslashes. Obvious internal names and private/special
IP literals are rejected, including alternate IPv4 spellings canonicalized by
the WHATWG URL parser. IPv6 is limited to global unicast and excludes special
protocol/documentation/transition blocks. This deliberately conservative policy
can reject unusual public destinations.

Before each request, every DNS answer must be an allowed public address. The
chosen address (IPv4 preferred) is pinned through Node's socket lookup, with a
specific family and fresh agent. The original hostname remains in Host and TLS
SNI; certificate verification stays enabled. The connected peer address must
match the selected address. The transport does not resolve the hostname again,
so DNS rebinding between validation and connection cannot select another IP.

Redirects are manual, limited to five, and re-run URL/DNS checks on every hop.
HTTPS cannot downgrade to HTTP. Uploads do not follow redirects. Requests have
one overall deadline covering DNS, headers, redirects and body reads. A redirect
does not reset the clock. Node DNS work already submitted to the OS may finish
after timeout, but its result cannot start a request after the deadline.

Both wire bytes and decompressed bytes are bounded during streaming. gzip,
deflate and Brotli are supported; unknown or stacked encodings are rejected.
Declared oversized bodies are rejected before buffering; absent or dishonest
Content-Length still cannot bypass the stream limit.

## Consumers and limits
- HTML and Shopify JSON: 2,000,000 bytes, 15-second download deadline.
- Logos: existing 2,000,000-byte limit, 10 seconds, PNG/JPEG types.
- Generated images: 8 MiB, 30 seconds.
- Generated video/audio: 64 MiB per asset, 60 seconds.
- Font CSS: 256 KiB; font files: 8 MiB; 10 seconds per download.
- Zernio signed uploads: maximum 128 MiB outgoing, 64 KiB response, 30 seconds.

The scraper resolves relative metadata against the final redirected URL.
Extracted image/logo URLs are syntax- and DNS-checked before storing them.
URLs passed to fal/Claude are checked again at handoff, including product
metadata edited outside ingestion. Those providers control their own fetching;
our pinned transport cannot control a provider's later DNS resolution. Their
authenticated SDK/API connections remain outside this generic downloader.

Error messages from the downloader do not include raw URLs, signed query
strings or resolver details. The helper uses Node's HTTP(S) transport rather
than Next.js fetch and therefore does not participate in Next fetch caching.
It requires the existing Node server runtime; an Edge-runtime move needs review.
Production egress must support direct HTTP(S) sockets. Environments requiring an
explicit forward proxy need a proxy-aware implementation preserving destination
validation; do not silently replace this transport with unpinned fetch.

## Verification and rollout
No database migration or new dependency is required. Tests exercise special IP
ranges, ambiguous URLs, private/mixed DNS answers, per-hop validation, rebinding,
limits, decompression bombs, deadlines and non-replayed PUTs. Real transport tests
use temporary local HTTP/TLS servers to verify socket pinning, Host/SNI and
rejection of an untrusted certificate; the policy layer never admits loopback.
Generated test keys are ephemeral and are not committed.

The workspace sandbox cannot open listening sockets; pure policy/stream tests
can run locally, while both real socket tests run in GitHub Actions. CI also
runs TypeScript, lint and existing tests; Vercel builds the preview. Live
scraping/provider downloads are not exercised by the local unit suite. This
patch enforces per-response bounds, not an aggregate memory budget for an entire
concurrent generation job. A deployment smoke test should cover a representative
product page, logo and generated media before broad rollout.
