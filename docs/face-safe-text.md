# Full-frame face-aware text
Photos and footage fill the frame. Local YuNet face detection at 640 and 320
pixels supplies bounding boxes; expanded margins protect forehead, hair and
chin. The planner picks disjoint headline, CTA and logo rectangles around every
protected face. Copy, gradients, shadows and brand chips are clipped to their
rectangles. Alternate wide/side/lower positions avoid a fixed top headline.

Unknown detection or a crowded frame uses a full-image fallback with no unsafe
overlay. No inset photo, separate text panels, bars or cut-away closing card.
This is detection, not recognition: no identities/embeddings are inferred,
photos are not sent to a face-analysis service, and only bounded process-local
geometry promises keyed by image hash are cached. Detectors can miss faces;
human review of creatives remains important. No claim of perfect detection.

Images normalize the exact output crop before analysis, then compose text over
that same raster. Public/private image URLs use face-aware-v2 to bypass cached
panels. A response header distinguishes ready local analysis from fallback for
deployment checks. Unknown analysis never uses a hardcoded overlay.

Video analyzes every frame at the same crop and frame rate as the export,
including all shots touched by the hook or closing interval. A stable per-shot
face set avoids jitter; captions split at shot boundaries. Hook, captions and
closing copy avoid those sets and one another. Incomplete/time-limited analysis
disables overlays for the affected shot. Analysis is bounded to 120 seconds per
edit; no partial scan is treated as complete. All source footage stays full-frame.
New renders use this layout; old baked MP4 files still require re-editing.

Bundled YuNet dynamic model (OpenCV Zoo 48b10fa505aeb51fbd127fc60a5c660040e823b7) is MIT licensed.
SHA256 ebafce4e3c118d6554634be5c27ab333b4c047a9a8c3faf1d7cf93101c22f0f0.
Runtime onnxruntime-web 1.31.1 is pinned with its lockfile.
Model and WASM assets are traced into rendering functions. No remote model
download, paid generation, credit, auth or database-schema change.

Tests exercise positions/groups/edges/crowding/failure; actual local inference
on a real portrait without network; full-frame corners and zero overlay alpha
in protected faces for Latin/Arabic/Hindi; actual video scan/edit with moving
real face footage; full existing regression and deployment checks.
