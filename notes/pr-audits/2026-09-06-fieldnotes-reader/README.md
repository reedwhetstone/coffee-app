# Fieldnotes reader and signup rework

## Scope

Purveyors Fieldnotes uses the existing editorial visual language for short coffee/technology takes and independent coffee highlights. The canonical landing is `/fieldnotes`; `/market-wire` remains a compatible landing with a canonical link to the new URL. Account preference storage, the `market_read` publication, and all subscription endpoint/consent behavior remain unchanged. Delivery is still explicitly a waitlist.

`src/lib/newsletter.ts` owns the public name and description. A new `newsletter: fieldnotes` frontmatter marker opts future editions into Fieldnotes branding across the article, fallback hero, archive badges, feed, metadata, and email. The existing `market-brief` format, pillar, edition sequence, and blog URLs stay compatible. Unmarked historical editions retain Market Brief branding. No article or image for edition 003 is included.

The three-file email/Markdown structured-content fix from closed app PR #588 is incorporated, without reopening the PR. Short takes can render without a market snapshot, research spotlight, or coffee cards; empty coffee-card sections are omitted. Coffee cards continue to work independently of a snapshot.

## Validation

- `pnpm test`: 201 files passed, 2 skipped; 1,460 tests passed, 14 skipped before two additional focused compatibility tests.
- `pnpm test src/lib/server/blog.test.ts src/lib/components/blog/MarketBriefArticle.svelte.test.ts src/lib/server/marketBriefEmail.test.ts src/routes/account/page.svelte.test.ts src/routes/market-wire`: 57 tests passed across 6 files after the final changes.
- `pnpm check --fail-on-warnings`: passed with 0 errors / warnings using repo-local placeholder values only.
- Scoped Prettier and ESLint: pass.
- `pnpm lint`: blocked by 17 pre-existing formatting files, mostly archived notes. No unrelated formatting changed.
- `pnpm build`: pass, including the Market Brief artifact check reporting one legacy edition and zero non-production projections.
- Local Chrome inspection: desktop and 390px landing, canonical legacy landing, existing `/blog/market-brief-002`, and 390px email fixture. No horizontal overflow on mobile landing or email. Public header classification includes `/fieldnotes`.

The email screenshot uses an explicitly labeled synthetic preview (099), not publication content or verified reporting. Its temporary preview endpoint was removed. Screenshots are visual evidence, not claims of authenticated signup or live email delivery. No messages were sent, no edition published, no credentials copied. Existing local Node 24 differs from the repo's Node 22 declaration; checks passed with that warning.

## Screenshots

- [Desktop signup](fieldnotes-desktop.png)
- [Mobile signup](fieldnotes-mobile.png)
- [Mobile email fixture](fieldnotes-email-mobile.png)

## Generated-sample integration canary

The exact final scraper sample is retained as `src/lib/server/fixtures/fieldnotes-generated.txt`, outside the blog content tree. The integration test compiles its actual frontmatter through mdsvex, admits the new `technology` and `ideas` tags, and projects all three short takes into the web reader, email, and portable Markdown. It also verifies edition 003 is absent from the discoverable blog corpus.

- [Exact-sample mobile reader](fieldnotes-sample-reader-mobile.png)
- [Exact-sample mobile email](fieldnotes-sample-email-mobile.png)

Both are 390px local previews with no horizontal overflow. This is the initial editorial sample with no coffee cards or snapshot, not a fresh enrichment run. The separate synthetic email fixture above verifies card parity. Temporary routes were removed after screenshots. Visual review also replaced the stale “Reported this week” reader label with “Ideas worth exploring” so older references are not presented as fresh news.
