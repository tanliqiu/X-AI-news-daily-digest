# X AI News Daily Digest

A daily AI news pipeline that collects, curates, and publishes a digest of the most relevant developments in applied AI — targeting practitioners building AI products and services.

**Live site:** https://web-psi-one-34.vercel.app

## How it works

Two independent packages connected by JSON files.

### Pipeline (`pipeline/`)

Runs in two phases:

1. **Collect** (`npm run generate`) — five collectors run in parallel:
   - **arXiv** — fetches RSS feeds for cs.AI, cs.CL, cs.LG; downloads raw LaTeX source (`.e-print` tarball) to extract author affiliations across 7 template styles (NeurIPS, ICML, ACM sigconf, JMLR, IEEE, authblk, fallback)
   - **Hacker News** — top AI-relevant stories via Algolia API
   - **Blogs** — Latent Space, Hugging Face, company engineering blogs
   - **Podcasts** — transcripts via POD2TXT (optional)
   - **Follow Builders** — curated list of builders/researchers

   Deduplicates against `state.json` (7-day TTL). Outputs `raw-feed.json`.

2. **Curate** (`npm run digest`) — sends `raw-feed.json` to Claude Sonnet 4.6 with a system prompt that categorizes items into Research / Tools / Industry News, writes practitioner-focused summaries, extracts keywords, and writes 3 TLDRs. Cross-checks against the last 30 digests to skip already-published items. Outputs `web/data/digests/YYYY-MM-DD.json`.

Monday runs use a 96-hour lookback (covers Fri–Mon) and tag the edition as a weekend digest.

### Web (`web/`)

Next.js 15 App Router, statically generated. No database or runtime API calls — digest JSON files are the sole data source.

User state (bookmarks, read status) is stored in `localStorage` only.

## Setup

### Pipeline

```bash
cd pipeline
cp .env.example .env   # add ANTHROPIC_API_KEY (and optionally POD2TXT_API_KEY)
npm install
npm run run-all        # collect + curate in one step
```

### Web

```bash
cd web
npm install
npm run dev            # http://localhost:3000
```

## Digest JSON schema

```json
{
  "date": "YYYY-MM-DD",
  "tldr": ["...", "...", "..."],
  "edition": "weekend",       
  "dateRange": "Apr 25–28",   
  "sections": {
    "Research": [{
      "title": "",
      "summary": "",
      "url": "",
      "source": "arXiv",
      "published": "",
      "keywords": ["Reasoning"],
      "affiliations": ["MIT"]
    }],
    "Tools": [{ "title", "summary", "url", "source", "published" }],
    "Industry News": [{ "title", "summary", "url", "source", "published" }]
  }
}
```

`edition` and `dateRange` appear only on Monday (weekend) editions.

## Deployment

Hosted on Vercel. Deploy from repo root:

```bash
npx vercel --prod
```
