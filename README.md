# Writer Cup 2026 App — V5

V5 is the polished tournament-day release of the Writer Cup companion app.

## Tournament scoring
- Live 4-point Writer Cup scoring with Supabase Realtime
- Holes 1–6: Foursomes / Alternate Shot
- Holes 7–12: Four-Ball Match Play
- Holes 13–18: Singles Stableford Match Play
- Official White Tee distances and stroke indexes for all 18 holes
- Tournament-day Daily Handicaps automatically feed the Stableford calculations
- Hole 4 Nearest to the Pin and Hole 14 Longest Drive
- Clear Saved Scores action for correcting an accidentally saved hole
- Offline score queue / local backup

## Score access
- Everyone can open the Score tab and browse the live scores in read-only mode
- Spectators can move through previous/current holes and see Stableford previews and match results
- Scorer PIN unlocks score editing for that browser session
- Save, clear, side-competition changes and tournament controls remain PIN protected server-side

## Hole 14 tee-order draw
- Scorer-controlled random draw of all four positions 1–4
- First player is clearly highlighted
- Draw is saved live through Supabase so every device sees the same official order
- A redraw requires scorer control and confirmation
- The order appears in both the scoring screen and Hole 14 Course Guide

## Player profiles
- Ben Writer
- Joel Ryan
- Dylan Allen
- Brent Rogers
- Full player photos, biographies and profile titles
- Once a photo is uploaded it automatically replaces the initials avatar
- Initials remain the fallback only: BW, JR, DA and BR
- Profile photos can be tapped to view full-screen

## Player notes
- Everyone can read all four players' general and hole notes
- Each phone can choose its player under “This phone belongs to”
- Only that player's notes are editable on that phone
- Notes do not require a separate player PIN/login

## Course and tournament hub
- 18-hole Course Guide with strategy, danger notes and local-rule reminders
- Live weather framework for tournament week
- Full scorecard
- Official Writer Cup rules
- White / navy / gold / green Writer Cup visual theme
- Green Live icon and enlarged gold Score pencil in the bottom navigation

## Deployment
This is a static PWA. Upload the contents to the GitHub repository root, then deploy through Vercel. The `supabase` folder is source/backup material and is not required by the browser at runtime.


## V5.1
Singles holes 13–18 now display shots received and Stableford points beneath each gross score. The + / − controls are larger for mobile scoring. Singles winner logic remains hole-by-hole Stableford match play.
