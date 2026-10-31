# Text outside faces
The image compositor now puts the complete generated photo into a protected
media window with object-fit contain. Headline, CTA and logo have independent,
clipped text regions outside it. The same source pixel therefore cannot belong
to both a photo and a copy layer. No face detector or provider guess is needed.
Square and portrait output dimensions are unchanged. Photos are not cropped.

Video footage is scaled to fit entirely within a 1080x1360 window and padded
to 1080x1920. Hooks and timed captions are placed only below that window, above
the bottom 220px used by social player controls. Caption/audio timing remains
unchanged. The closing card is fully opaque and cuts in without an alpha fade,
so footage cannot show through its lettering during a transition.

Source prompts ask for complete visible faces and no baked text. This is
additional guidance, not the mechanism enforcing the compositor's separation.
Copy regions clip oversized text rather than allowing it to enter media.

Existing image ads are composed at request time and pick up the new layout
without generating new photos or spending credits. Versioned preview and
showcase URLs bypass older image/optimizer caches, with matching Next local
image patterns. Original image downloads also use the new compositor.
Video text is baked into saved MP4s: only newly rendered videos use this layout;
previously exported videos must be re-edited from source clips, voice and music.
This change does not replace or charge for existing video assets, regenerate
ads, post anything, or change credits, auth, database schema or user content.

Tests check geometry plus actual Satori/Skia output pixels for Latin, Arabic,
Hindi and oversized strings. Both video text layers are fully transparent over
the footage rectangle, and the closing card is opaque. A real FFmpeg edit with
a moving face marker is sampled across shots, hook/subtitles and the end card
to verify source visibility, no overlay text in footage, frame size and the
opaque closing transition. No model/provider calls or paid generation in tests.
