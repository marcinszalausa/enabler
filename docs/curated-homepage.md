# Homepage media
The homepage uses reviewed existing public ads listed in src/lib/homepage-media.json. It intersects this list with getShowcase, so removing a run from the showcase removes its homepage display. Other public pages and dashboard batches retain their existing behavior.

Files in public/showcase have content hashes, 480/960 WebP variants, inline previews, and immutable caching. The video has a real poster and fast-start metadata. Images preserve the complete frame.

To refresh, update the reviewed IDs in scripts/export-homepage-media.mjs and run it in an environment with the application dependencies and network access. It downloads already-public media without generating ads or spending credits. Review all resulting photos and video frames, commit the files and manifest together, and run the homepage browser checks. Remove unused snapshots when withdrawing assets; existing cached URLs may remain accessible until cache expiry.
