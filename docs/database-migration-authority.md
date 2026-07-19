# Database migration authority

Parchment is the sole authoring and production release authority for the shared
Supabase database. Do not add SQL migrations under `coffee-app/supabase/migrations`.
The coffee-app CI gate rejects any file in that directory.

The 34 historical coffee-app migrations are preserved byte-for-byte under
`parchment-api/supabase/history/coffee-app`. Parchment verifies their immutable
hashes but never treats that imported history as an executable production
ledger. New migrations belong in `parchment-api/supabase/migrations` and reach
production only through Parchment's reviewed migration workflow.

The historical coffee-app files also remain recoverable from this repository's
Git history before their removal. `supabase/schema.sql` is a context-only schema
snapshot, not executable migration authority.
