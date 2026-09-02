# V7 Changelog

## Manual Course
- Added Standard Course / Manual Course selection.
- Standard Course remains the existing The Coast setup and scoring behaviour.
- Added a blank 18-hole Manual Course that can be configured entirely from the phone.
- Manual Course can be completed progressively hole-by-hole during the round.
- Par and Stroke Index are required before a Manual Course hole can be used for Stableford scoring.
- Metres, course name and tee are optional.
- Stableford shots and points use the active Manual Course Par / Stroke Index together with the saved Daily Handicaps and gross scores.
- Writer Cup format remains fixed by playable position: Holes 1–6 Scramble, 7–12 Combined Stableford, 13–18 Aggregate Singles.
- Added clear Manual Course active warnings so the selected course mode is obvious.
- Course Guide remains the standard The Coast guide when Manual Course is active, with temporary-course guidance shown.

## Side competitions
- NTP can be assigned to any playable hole 1–18.
- Longest Drive can be assigned to any playable hole 1–18.
- NTP winner/result controls follow the selected NTP hole.
- Longest Drive winner controls and the four-player random tee-order draw follow the selected Longest Drive hole.
- Longest Drive hitting order remains linked to the competition when its hole is moved.
- Existing saved side-competition results are protected by confirmation when relevant settings are changed.

## Safety / reliability
- Manual Course settings are shared through Supabase rather than being device-only.
- Scorer PIN is required to change course settings.
- Stableford scoring is blocked on a Manual Course hole until valid Par and Stroke Index values exist.
- Course-mode changes are protected once relevant Stableford scoring has begun.
- Existing Standard Course calculations were regression-tested against the V6 engine.
