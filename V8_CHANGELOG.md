# Writer Cup V8

## Scoring Flow & Standard Course Flexibility

- Normal live scoring now automatically advances to the next hole only after the full save sequence succeeds.
- Editing or saving an earlier/correction hole stays on that hole.
- Hole 18 stays on Hole 18 and invites the scorer to review the official result before locking it.
- Save button wording now reflects the action:
  - SAVE HOLE X & NEXT
  - UPDATE HOLE X
  - SAVE HOLE 18
- Standard Course Holes 7–18 now have an optional 2ND SI override.
- Leave 2ND SI blank to keep the normal SI + 18 allocation.
- Enter 19–36 only when the printed card uses a different split index.
- Standard 2ND SI overrides persist to Supabase and display in scoring, Course Guide and Scorecard.
- Manual Course split-index support remains unchanged.
- Server-side Stableford calculation now uses Manual Course values and Standard 2ND SI overrides, matching the app.
- NTP / Longest Drive backend now creates missing side-competition rows as well as updating existing rows.

## Validation

- JavaScript syntax check passed.
- 990 fallback Stableford checks across Daily HCP 0–54 and SI 1–18 matched the previous calculation exactly.
- Split-index threshold check passed: SI 3 / 22 gives one shot at HCP 21 and two at HCP 22.
- Auto-advance correction/progression guard tests passed.

## Save confirmation fixes

- Offline or failed writes queued on the phone keep the scorer on the selected hole and show that live sync is pending.
- After golf scores and all applicable side competitions save, a fresh Supabase read must match the scores, side-comp results, draw order and Standard second-index override before advancing or confirming completion.
- A read already in progress is awaited, then a fresh read confirms the completed writes. Read failures and missing side-comp rows do not count as success.
- Repeated Save taps cannot start overlapping hole saves.
- No test-round reset is included.

## General match conditions update

- Added Tequila at the Turn at the beginning of Hole 10.
- Added official Writer Cup tees while supplies last.
- Added official player gifts on tournament morning.
- Added post-match prize presentations.

## Post-save result banner

- Normal forward saves still advance immediately to the next hole.
- The next scoring screen now shows the previous hole's result for ten seconds.
- Scramble and Combined Stableford banners identify the winning team or a halved hole.
- Aggregate Singles banners show all four players' hole points and the running match totals.
- Corrections remain on the selected hole and do not trigger the forward-scoring banner.

## Correction navigation

- Browsing an earlier hole now shows a RETURN TO CURRENT HOLE button.
- Updating a correction still stays on that hole, so the scorer can review the change before returning to live progress.

## Course Setup mode controls

- USE STANDARD and USE MANUAL now use identical button sizing.
- The active course mode is filled navy and remains fully visible while selected.
- The inactive course mode uses a white outlined treatment.

## Final result protection

- After all 18 holes, NTP and Longest Drive are saved, the scorer can review and choose FINALISE & LOCK RESULTS.
- Finalised scores, handicaps, side competitions and course settings become read-only on every device.
- Reopening a completed round requires a fresh scorer PIN, after which the result must be finalised again.
- The lock is enforced in Supabase as well as in the interface, so an old or second device cannot bypass it.
- Hole 18 no longer marks the round complete automatically; completion happens only after the explicit final review and lock.

## Installed-app refresh

- Versioned JavaScript and stylesheet URLs ensure phones and Macs receive this final V8 build instead of retaining an older installed-app cache.
- The service-worker cache is advanced to the final V8 release while preserving offline opening after the new version has loaded once.

## Unsaved score protection

- Partially entered scores now survive Supabase Realtime and background-sync redraws instead of returning to the last saved value.
- Draft protection follows each hole while navigating and also covers the Standard 2ND SI override plus NTP/Longest Drive entry fields.
- A draft is cleared only after the complete hole save is confirmed live, or after the hole's saved scores are deliberately cleared.
- Failed, offline or unconfirmed saves retain the entries on screen for a safe retry.
- The installed-app cache advances again so phones and Macs receive this protection after the GitHub deployment.

Validation: `node --check app.js`, all 43 checks in `node test-v6.js`, and all 15 isolated save-flow tests in `node --test test-v8-save.js` pass. These tests use an in-memory database and include 990 ordinary handicap allocations plus split-index thresholds. The Supabase lock also passed a rollback-only integration test covering finalise, blocked edits, PIN reopen, correction and relock; no test rows remained afterward.
