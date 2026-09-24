# Writer Cup V9 post-event update

## Install
Extract Writer-Cup-V9-Post-Cup.zip. Upload ALL extracted files and the api folder into the existing benwriter/writer-cup-2026 repository root, replacing matching files. Keep api/round-report.js inside api. Do not upload the ZIP itself. Existing config.js, data.js and assets remain required and are already in the repository.

Vercel should deploy the commit automatically. Wait for Ready, then close and reopen or refresh the app. Open More > CUP ARCHIVE · WRAP-UP · PHOTOS.

Supabase changes and the completed 2026 archive have already been applied and verified. No SQL or reset is needed. Do not reset the tournament.

## Included
- Explicit pick-up for individual Stableford holes 7–18: PU, zero points, no invented gross score. Correctable like any score once scoring is unlocked. No scramble pick-up option.
- Live hole numbers and expandable six-hole scores/results. Singles displays points and clearly states aggregate totals decide the match.
- Separate immutable archive containing the final scores, Manual Course, indexes, handicaps, profiles, notes and side competitions.
- Print/Save as PDF and JSON download for the archived round.
- PIN-protected editable report generator, saved draft, copy and text download. A fact-based template uses archived results, profiles, notes and photo captions. Add actual weather and stories yourself. This is not an AI service and does not send emails.
- Public photo album with PIN-protected uploading and deleting, captions and enlarged view. Resized JPEG images; maximum 100 photos per archived Cup. Keep originals separately.

## Verification
75 automated checks pass: 44 core checks, 25 save/weather/page checks and 6 archive/report tests. Backend rollback tests verified pick-ups, correction, PIN rejection, completed-round lock, archive immutability, draft storage and photo insert/delete. Test transaction was rolled back.
All 60 original score entries still match the archived scores and the tournament remains complete. Berkeley Jail 3–1; Dylan NTP; no Longest Drive winner.
Direct public draft reads and photo/archive writes are denied. Existing PIN-based RPC architecture is retained.

The cloud browser could not access the local preview, so visual checks on a deployed phone/Mac and the real-PIN end-to-end flow remain outstanding. After deployment, check More > archive, open the Live breakdowns, unlock the captain's desk, generate/save a draft and upload a photo you intend to keep. Do not reopen the completed round merely to test pick-ups.

## Limits and follow-up
The isolated iPhone bottom navigation jump has not been reproduced or fixed in this update. Existing 2026 zero-point gross scores are preserved; we cannot infer which were pick-ups. Archives cannot be overwritten by the archive button. An official correction made after archiving will need a deliberate archive revision separately.
Next-year event creation/reset is not included. Preserve this completed tournament and its existing PIN when setting up a future event; archived captain controls currently validate against the original tournament PIN.
