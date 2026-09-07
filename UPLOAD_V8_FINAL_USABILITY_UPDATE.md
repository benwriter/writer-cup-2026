# Writer Cup V8 final usability update

## Upload to GitHub

Upload these files to the root of `benwriter/writer-cup-2026`, replacing the existing copies:

- `app.js`
- `styles.css`
- `test-v6.js`
- `test-v8-save.js`
- `V8_CHANGELOG.md`
- `SUPABASE_V8_FINAL_ROUND_LOCK.sql`

Only `app.js` and `styles.css` change the visible site. The test, changelog and SQL files keep the repository aligned with the deployed behaviour.

The Supabase migration is already applied. Uploading the SQL file is a record of that backend change; it does not reset or alter tournament data.

## Included behaviour

- Previous-hole result banner remains visible for 10 seconds after normal auto-advance.
- Earlier-hole corrections show **Return to Current Hole**.
- **Use Standard** and **Use Manual** are equal size, with the selected mode navy.
- Hole 18 saves and remains open for review.
- Once all 18 holes, NTP and Longest Drive are complete, **Finalise & Lock Results** protects the official record.
- Reopening a completed round requires a fresh scorer PIN.

## After Vercel deploys

Refresh the app, then perform one final test round. Confirm the 10-second banner, correction return button, Hole 18 review and final lock/reopen flow. Reset test data only when ready for the tournament-day setup.
