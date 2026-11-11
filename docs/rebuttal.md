# Rebuttal setup and storage

The app keeps the existing bilingual editor, preview, concern mapping and
version history UI. This distribution uses Next.js and local SQLite instead
of the original managed hosting/database integration.

## Customize a project

Edit these files together, preserving matching reviewer IDs:

| File | Content |
|---|---|
| `app/seed.json` | Initial bilingual drafts and separate titles |
| `app/review-data.ts` | Project label, reviewer navigation, evidence and writing guidance |
| `app/review-records.ts` | Original review text and concern cards |
| `app/review-translations.ts` | Review translations |
| `app/review-reference.ts` | Lookup of W/Q excerpts; adapt if you split a long concern |

The `General` entry is reserved for a shared response. Reviewer IDs must match
across these files. Each initial draft must have revision `0`. Concern cards
use a numeric `section` to locate headings such as `**1. Comparison**` or
`## 1. Comparison` in the current draft; matching a section does not certify
that a concern is scientifically resolved.

The lightweight Markdown renderer supports paragraphs, bold, inline code,
headings, bullet lists and simple pipe tables. It does not interpret raw HTML.
The budget counter uses JavaScript string length; check the destination form's
own count before submitting. This app never submits a response for you.

## Data lifecycle

The default database is `data/drafts.sqlite`, relative to the app's working
directory. Override it with an absolute `REBUTTAL_DB` path. For example:

```bash
REBUTTAL_DB=/your/private/folder/drafts.sqlite npm start
```

The first request inserts missing seed documents. Subsequent requests preserve
saved drafts. Editing seed text does **not** overwrite existing drafts. Start
a separate database for a new project; keep the corresponding source
configuration with it. Do not share one database between differently configured
projects. Reviewer IDs removed from configuration are not shown by the API.

Every save carries `baseRevision`. A stale save returns HTTP 409; the current
version is preserved. Restoring history makes a new version. Changing either
language or a title clears the bilingual alignment check and returns a finalized
draft to draft status. A ready draft requires both languages and that check.

Export in the UI offers Markdown and a current-draft JSON backup. The JSON export
is not a full history export and has no automatic import button. To preserve all
versions, stop the server and copy the database directory (including any WAL
files), or use SQLite's online backup facility. Retain the initial seed files
too, since revision 0 comes from those files.

The application is a local single-user service, not an authentication system.
Origin and host checks reject foreign browser origins and non-loopback hosts.
Only run trusted local code on the same machine. Keep personal seeds and review
files in a private copy of the repository.
