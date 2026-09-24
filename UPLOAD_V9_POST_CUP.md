# Writer Cup V9 post-event update

## Install
Extract Writer-Cup-V9-AI-Recap.zip. Upload ALL extracted files and the api folder into the existing benwriter/writer-cup-2026 repository root, replacing matching files. Keep api/round-report.js inside api. Do not upload the ZIP itself. Existing config.js, data.js and assets remain required and are already in the repository.

Vercel should deploy the commit automatically. Wait for Ready, then close and reopen or refresh the app. Open More > CUP ARCHIVE · WRAP-UP · PHOTOS.

Supabase changes and the completed 2026 archive have already been applied and verified. No SQL or reset is needed. Do not reset the tournament.

## Included
- Explicit pick-up for individual Stableford holes 7–18: PU, zero points, no invented gross score. Correctable like any score once scoring is unlocked. No scramble pick-up option.
- Live hole numbers and expandable six-hole scores/results. Singles displays points and clearly states aggregate totals decide the match.
- Separate immutable archive containing the final scores, Manual Course, indexes, handicaps, profiles, notes and side competitions.
- Print/Save as PDF and JSON download for the archived round.
- PIN-protected editable report generator, saved draft, copy and text download. AI rewrites your rough stories and weather into a short, humorous recap using the verified result and honours. Biographies, full statistics, raw notes and photo-caption lists are excluded. No email is sent automatically.
- Public photo album with PIN-protected uploading and deleting, captions and enlarged view. Resized JPEG images; maximum 100 photos per archived Cup. Keep originals separately.

## Verification
77 automated checks pass: 44 core checks, 25 save/weather/page checks and 8 archive/report/AI tests. AI responses are mocked in tests; an actual generation must be checked after deployment. Backend rollback tests verified pick-ups, correction, PIN rejection, completed-round lock, archive immutability, draft storage and photo insert/delete. Test transaction was rolled back.
All 60 original score entries still match the archived scores and the tournament remains complete. Berkeley Jail 3–1; Dylan NTP; no Longest Drive winner.
Direct public draft reads and photo/archive writes are denied. Existing PIN-based RPC architecture is retained.

The cloud browser could not access the local preview, so visual checks on a deployed phone/Mac and the real-PIN end-to-end flow remain outstanding. After deployment, check More > archive, open the Live breakdowns, unlock the captain's desk, generate/save a draft and upload a photo you intend to keep. Do not reopen the completed round merely to test pick-ups.

## Limits and follow-up
The isolated iPhone bottom navigation jump has not been reproduced or fixed in this update. Existing 2026 zero-point gross scores are preserved; we cannot infer which were pick-ups. Archives cannot be overwritten by the archive button. An official correction made after archiving will need a deliberate archive revision separately.
Next-year event creation/reset is not included. Preserve this completed tournament and its existing PIN when setting up a future event; archived captain controls currently validate against the original tournament PIN.

## AI connection
This package includes all V9 changes and replaces the earlier packages. Preserve the api folder and upload vercel.json too.
The server uses Vercel AI Gateway with the deployment's VERCEL_OIDC_TOKEN, or AI_GATEWAY_API_KEY if you configure one. No model credentials are included in browser code or the ZIP. Model: anthropic/claude-sonnet-4.6, verified in the Gateway model catalogue. Optional server variable WRITER_CUP_REPORT_MODEL changes the model.

After deployment: More > Cup archive > unlock Captain's desk > add weather/stories > Generate draft. Review facts and humour, then Save draft. AI can make mistakes; your stored scores cannot be changed by generation.
If generation reports setup/authentication required, open Vercel AI Gateway for your team and configure access. An alternative is a Gateway API key stored as AI_GATEWAY_API_KEY in this project's Production environment, followed by redeployment. Never put a key in GitHub, config.js or chat.
Gateway usage uses your Vercel AI balance and may require credits. This update does not purchase credits or enable auto top-up. Check usage/budget controls in Vercel before repeated generation. Each click makes one bounded generation request, no automatic retries. The PIN is verified before any AI request.
The available connector cannot inspect or configure Gateway credentials/balance here, so the live connection is not yet verified. If the model fails, credentials are missing, or output is truncated, the existing editor/saved draft stays unchanged.
Official setup: https://vercel.com/docs/ai-gateway/authentication-and-byok/oidc
