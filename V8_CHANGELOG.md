# Writer Cup V8

## Scoring Flow & Standard Course Flexibility

- Normal live scoring now automatically advances to the next hole only after the full save sequence succeeds.
- Editing or saving an earlier/correction hole stays on that hole.
- Hole 18 stays on Hole 18 and confirms round scoring is complete.
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
- No database changes or test-round resets are included.

## General match conditions update

- Added Tequila at the Turn at the beginning of Hole 10.
- Added official Writer Cup tees while supplies last.
- Added official player gifts on tournament morning.
- Added post-match prize presentations.

Validation: `node --check app.js`, the 34 existing checks in `node test-v6.js`, and 11 isolated save-flow tests in `node --test test-v8-save.js` pass. These tests use an in-memory database and include 990 ordinary handicap allocations plus split-index thresholds. Live NTP/LD re-save and second-device checks remain part of the dry run.
