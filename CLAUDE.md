# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Pipeline (Node.js, ES modules — run from `pipeline/`)
```bash
npm run generate    # Collect items from all sources → raw-feed.json
npm run digest      # Curate via Claude → web/data/digests/YYYY-MM-DD.json
npm run run-all     # Both in sequence
```

### Web (Next.js — run from `web/`)
```bash
npm run dev         # Dev server at localhost:3000
npm run build       # Production build
npm run lint        # TypeScript + ESLint
```

## Architecture

Two independent packages with a shared data contract via JSON files in `web/data/digests/`.

### Pipeline (`pipeline/`)
Two-phase design:

1. **Collection** (`generate-feed.js`): Runs 5 collectors in parallel (arxiv, hackernews, blogs, podcasts, followbuilders). Each returns items with `{ id, title, summary, url, source, published }`. Deduplicates against `state.json` (7-day TTL). ArXiv additionally fetches author affiliations from HTML pages in batches of 3 to respect rate limits. Outputs `raw-feed.json`.

2. **Curation** (`prepare-digest.js`): Reads `raw-feed.json`, cross-checks URLs against the last 30 digests, then calls **Claude Sonnet 4.6** to summarize, categorize (Research / Tools / Industry News), extract keywords, and write 3 TLDRs. Uses ephemeral prompt caching on the system prompt. Writes the final digest to `web/data/digests/YYYY-MM-DD.json`.

Monday runs use a 96-hour lookback (Fri–Mon) and tag the edition as a weekend digest.

### Web (`web/`)
Next.js 15 App Router with static generation. Digest JSON files are the only data source — no database, no API calls at runtime.

- `app/page.tsx` — home page: latest digest hero + previous digest cards
- `app/digest/[date]/` — individual digest with section blocks and prev/next nav
- `app/bookmarks/` — filtered view of bookmarked items (localStorage-backed)
- `lib/digests.ts` — all file I/O and TypeScript interfaces for digest schema
- `next.config.ts` — traces `data/digests/**` so all JSON is included in the static build

User state (read status, bookmarks) is stored in `localStorage` only.

### Digest JSON schema
```json
{
  "date": "YYYY-MM-DD",
  "tldr": ["...", "...", "..."],
  "edition": "weekend",         // Monday editions only
  "dateRange": "Apr 25–28",     // Monday editions only
  "sections": {
    "Research":      [{ "title", "summary", "url", "source", "published", "keywords", "affiliations" }],
    "Tools":         [{ "title", "summary", "url", "source", "published" }],
    "Industry News": [{ "title", "summary", "url", "source", "published" }]
  }
}
```

## Environment

`pipeline/.env` (required):
```
ANTHROPIC_API_KEY=sk-...
```

`POD2TXT_API_KEY` is optional (podcast transcripts).
