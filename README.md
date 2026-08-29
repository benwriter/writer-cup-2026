# Writer Cup 2026 App — V4

V4 turns the Writer Cup app from a live scorer into a full tournament companion.

## Included
- Live 4-point Writer Cup scoring with Supabase Realtime
- Foursomes, Four-Ball and Singles Stableford match-play logic
- Official White Tee distances and stroke indexes for all 18 holes
- Hole 4 NTP and Hole 14 Longest Drive
- Offline score queue / local backup
- Scorer PIN for score and tournament-control changes
- Public player profiles for Ben, Joel, Dylan and Brent
- Scorer-controlled profile title, biography and photo upload
- Shared general notes and hole-by-hole player notes with no note PIN
- Per-device “This phone belongs to” selector to make one player’s note box editable
- 18-hole Course Guide with:
  - par, White Tee distance and stroke index
  - current Writer Cup format
  - course strategy
  - Writer Cup match strategy
  - danger notes
  - current local-rule reminders
  - shared notes from all four players
  - official Coast hole-page link
  - jump straight from guide to scoring
- Tournament-weather framework using Open-Meteo:
  - before tournament week: “Forecast opens 7 days out”
  - within seven days: temperature, rain chance, dominant wind, max wind and gusts
  - Little Bay / The Coast coordinates are preconfigured
- Full scorecard moved into Tournament HQ
- Official Writer Cup rules remain in the app

## Permissions
- Anyone can view scores, profiles, course guide and notes.
- Shared player notes deliberately do not use a PIN.
- Profile biography/photo editing uses the scorer PIN.
- Live score/tournament changes use the scorer PIN.

## Weather
The tournament forecast is fetched from Open-Meteo only when the event is within the seven-day window. The app remains usable if weather is unavailable.

## Deployment
This is still a static PWA and can be deployed to Vercel once the GitHub repository is ready.
