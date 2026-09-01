# Writer Cup 2026 App — V6

V6 rebuilds the tournament scoring layer around the updated Writer Cup 2026 format while preserving the live app, profiles, course guide, weather, side competitions, realtime syncing and scorer controls.

## V6 formats

### Holes 1–6 — Writer Cup Scramble
Both players tee off, with tee shots alternating between teams (for example Joel, Dylan, Ben, Brent). The team selects one tee ball, the player whose tee ball was not selected plays the next shot, then partners alternate until holed. Lower team gross score wins the hole.

### Holes 7–12 — Four-Ball Combined Team Stableford
All four players play their own ball. Stableford is calculated using official Daily Handicaps. Ben + Joel's points are added together and compared with Dylan + Brent's total for each hole. Higher combined total wins the hole.

### Holes 13–18 — Aggregate Singles Stableford
Ben v Dylan and Joel v Brent remain the Singles pairings. Stableford points accumulate across all six holes. Higher six-hole aggregate wins each Singles match point.

## Other V6 changes
- Home countdown now targets the 7:00am tee time.
- “White Tees” removed from the Home hero.
- General Rules include team shirt colours: Itchy & Scratchy dark, Berkeley Jail light.
- Official Rules include a Coast Local Rules summary and direct link.
- Rules direct uncertain rulings to the Competition Director.
- New Sponsors & Partners page under More.
- Hole 4 NTP wording updated for the Writer Cup Scramble.
- Hole 14 Longest Drive remains in Aggregate Singles with the random 1–4 hitting-order draw.
- Daily Handicap controls now drive Stableford scoring on Holes 7–18, with each player’s shots received shown directly in the scoring row.
- Live Match shows running aggregate Singles totals.

## Realtime and data
Scores are stored in Supabase and broadcast with Supabase Realtime. Spectators remain read-only unless scorer mode is unlocked. Existing profile, photo, course-guide and note data are preserved.

V6 production deployment
