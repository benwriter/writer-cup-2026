# Writer Cup V10

V10 is the year-neutral Writer Cup release. The completed 2026 event remains preserved as its own scorecard and archive.

## Included

- One active event pointer in Supabase, with a separate tournament, teams, players, holes, handicaps, course setup, side competitions and notes for each Cup.
- PIN-protected **Event Setup** under More → Tournament.
- Create the next Cup only after the current Cup is complete. The four player profiles and team names copy forward as an editable starting point.
- Editable date, Sydney tee-off time, venue, tees, optional weather coordinates, venue story, match conditions and sponsors for future events.
- Editable 18-hole setup for every future Cup, including Par, Stroke Index, optional second index, distance and movable NTP / Longest Drive positions.
- Home, Live, Score, Course and Tournament pages read the selected event.
- Cup Archive under More → Tournament, with preserved scorecards, results, notes and read-only existing photos.
- Archive print and round-data download.
- Completed rounds automatically archive through the PIN-gated finalisation function.
- Explicit Stableford pick-up scoring remains available and records zero points without a gross score.
- Captain’s Desk report generation and archive photo uploading/deleting are retired. The old report endpoint is a 410 tombstone, and the backend no longer grants those mutations.

## Deployment

1. Apply `SUPABASE_V10_YEARLY_EVENTS.sql` once to the Writer Cup Supabase project. It has already been applied to the connected project and verified against a rolled-back fixture.
2. Upload the V10 web files to the existing GitHub repository. Do not upload the old ZIP files or test backups.
3. Vercel will redeploy the existing project. The app remains on the completed 2026 event until **Event Setup** creates the next Cup.

## Safety checks completed

- 2026 remains complete with 60 score rows, one archive, Dylan as NTP winner and no Longest Drive winner.
- Reports and photos remain at zero.
- A temporary second Cup was created and edited inside a rolled-back transaction. The live 2026 rows were unchanged.
- 44 application checks and 30 focused tests pass.
