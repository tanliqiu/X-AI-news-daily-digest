#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import Anthropic from '@anthropic-ai/sdk'
import 'dotenv/config'
import { fetchArxivAffiliations } from './collectors/arxiv.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const FEED_PATH = join(__dirname, 'raw-feed.json')
const OUTPUT_DIR = join(__dirname, '..', 'web', 'data', 'digests')

const SYSTEM_PROMPT = `You are an AI news curator for an applied AI consultant. \
Process raw AI news items collected from arXiv, Hacker News, company blogs, and podcasts \
into a structured daily digest.

For each item:
- Write a 2-3 sentence summary focused on practical implications for building AI products and services
- Categorize as exactly one of:
  - "Research": academic papers, benchmarks, technical evaluations, model architecture findings
  - "Tools": new frameworks, SDKs, open-source releases, APIs, developer tools
  - "Industry News": company announcements, partnerships, funding, policy, market developments

Selection criteria:
- Aim for 4-6 items per section maximum; skip low-signal or duplicate items
- For Hacker News items (no pre-written summary), infer relevance from the title
- Prefer items with concrete implications over speculative or hype-driven content
- Podcast episodes should go in "Industry News" unless they cover a specific research finding
- Skip any item where the underlying content was published more than 3 weeks before today. \
Old blog posts sometimes get reposted to HN; if you recognise the article as not being recent \
(e.g. from the URL date, your training knowledge, or the content itself), exclude it.

For Research items only, add two extra fields:
- "keywords": array of 1–3 tags chosen from: Evaluation, Security, Framework, Application, Alignment, Inference, Training, Multimodal, Reasoning, Agents, RAG, Benchmarks, Survey
- "affiliations": if the raw item has a non-empty "affiliations" array, pass it through unchanged. Otherwise infer up to 5 institution names from your training knowledge of the authors (ordered by contribution, omit unknowns). If none known, omit the field. Return only institution names, not author names.

Your entire response must be a single valid JSON object and nothing else — do not think out loud, \
explain your reasoning, or write any text before or after the JSON. Do not use markdown code fences. \
The very first character of your response must be "{" and the very last must be "}". Schema:
{
  "date": "YYYY-MM-DD",
  "tldr": ["most important development today", "second development", "third development"],
  "sections": {
    "Research": [
      {"title": "...", "summary": "...", "url": "...", "source": "...", "published": "ISO-8601", "keywords": ["Reasoning"], "affiliations": ["MIT", "Google DeepMind"]}
    ],
    "Tools": [
      {"title": "...", "summary": "...", "url": "...", "source": "...", "published": "ISO-8601"}
    ],
    "Industry News": [
      {"title": "...", "summary": "...", "url": "...", "source": "...", "published": "ISO-8601"}
    ]
  }
}`

// Collect all URLs already featured in previous digests (last 30 days)
function getPreviouslyShownUrls(outputDir, today) {
  const shown = new Set()
  if (!existsSync(outputDir)) return shown
  const files = readdirSync(outputDir)
    .filter((f) => f.endsWith('.json') && f.replace('.json', '') !== today)
    .sort()
    .reverse()
    .slice(0, 30)
  for (const file of files) {
    try {
      const digest = JSON.parse(readFileSync(join(outputDir, file), 'utf-8'))
      for (const section of Object.values(digest.sections ?? {})) {
        for (const item of section) {
          if (item.url) shown.add(item.url)
        }
      }
    } catch {}
  }
  return shown
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const GITHUB_REPO = process.env.GITHUB_REPO ?? 'tanliqiu/X-AI-news-daily-digest'

async function fetchFlaggedIssues() {
  if (!GITHUB_TOKEN) return []
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/issues?labels=affiliation-fix&state=open&per_page=50`,
    { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' } }
  )
  if (!res.ok) return []
  return res.json()
}

async function closeIssue(issueNumber) {
  if (!GITHUB_TOKEN) return
  await fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues/${issueNumber}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ state: 'closed' }),
  })
}

async function processFlaggedIssues() {
  const issues = await fetchFlaggedIssues()
  if (issues.length === 0) return []

  console.log(`[prepare-digest] Processing ${issues.length} flagged affiliation issue(s)...`)
  const patched = []

  for (const issue of issues) {
    const body = issue.body ?? ''
    const arxivId = body.match(/\*\*arXiv ID:\*\*\s*`([^`]+)`/)?.[1]
    const digestDate = body.match(/\*\*Digest date:\*\*\s*(\S+)/)?.[1]
    const userCorrection = body.match(/\*\*User correction:\*\*\s*(.+)/)?.[1]?.trim()

    if (!arxivId || !digestDate) {
      console.warn(`[prepare-digest] Skipping issue #${issue.number} — missing arXiv ID or date`)
      continue
    }

    const digestPath = join(OUTPUT_DIR, `${digestDate}.json`)
    if (!existsSync(digestPath)) {
      console.warn(`[prepare-digest] Digest not found for ${digestDate}, skipping issue #${issue.number}`)
      continue
    }

    const affiliations = await fetchArxivAffiliations(arxivId)
    const finalAffiliations = affiliations.length > 0
      ? affiliations
      : userCorrection ? userCorrection.split(',').map((s) => s.trim()).filter(Boolean) : []

    if (finalAffiliations.length === 0) {
      console.warn(`[prepare-digest] No affiliations resolved for ${arxivId}, skipping`)
      continue
    }

    const digest = JSON.parse(await readFile(digestPath, 'utf-8'))
    let updated = false
    for (const item of digest.sections.Research ?? []) {
      if (item.url?.includes(arxivId)) {
        item.affiliations = finalAffiliations
        updated = true
        break
      }
    }

    if (updated) {
      await writeFile(digestPath, JSON.stringify(digest, null, 2))
      console.log(`[prepare-digest] Patched ${arxivId} in ${digestDate} → [${finalAffiliations.join(', ')}]`)
      patched.push({ arxivId, digestDate, affiliations: finalAffiliations, userCorrection, issueNumber: issue.number })
      await closeIssue(issue.number)
    } else {
      console.warn(`[prepare-digest] ${arxivId} not found in ${digestDate} Research section — issue #${issue.number} left open`)
    }
  }

  return patched
}

async function callWithRetry(fn, maxAttempts = 5) {
  let delay = 30_000
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const status = err?.status ?? err?.statusCode
      const isConnectionError = status === undefined && /connection|timeout/i.test(err?.name ?? '')
      const retryable = isConnectionError || status === 408 || status === 429 || status >= 500
      if (!retryable || attempt === maxAttempts) throw err
      console.log(`[prepare-digest] Transient API failure (${status ?? 'network'}), retrying in ${delay / 1000}s (attempt ${attempt}/${maxAttempts})...`)
      await new Promise((r) => setTimeout(r, delay))
      delay = Math.min(delay * 2, 300_000)
    }
  }
}

async function main() {
  const client = new Anthropic()

  if (!existsSync(FEED_PATH)) {
    console.error('[prepare-digest] raw-feed.json not found — run generate-feed.js first')
    process.exit(1)
  }

  const feed = JSON.parse(await readFile(FEED_PATH, 'utf-8'))
  const today = new Date().toISOString().split('T')[0]
  const isWeekend = feed.isWeekend === true
  const dateRange = feed.dateRange ?? null

  if (!feed.items || feed.items.length === 0) {
    console.log('[prepare-digest] No new items, skipping')
    return
  }

  // Filter out items whose URLs already appeared in a previous digest
  const shownUrls = getPreviouslyShownUrls(OUTPUT_DIR, today)
  const items = feed.items.filter((item) => !item.url || !shownUrls.has(item.url))
  const dedupedCount = feed.items.length - items.length
  if (dedupedCount > 0) {
    console.log(`[prepare-digest] Removed ${dedupedCount} items already shown in previous digests`)
  }

  if (items.length === 0) {
    console.log('[prepare-digest] No new items after cross-day dedup, skipping')
    return
  }

  // Enrich arXiv items from non-arXiv sources (e.g. HN) that are missing affiliations
  const arxivOnly = items.filter(
    (item) => item.source !== 'arXiv' && !item.affiliations?.length && item.url?.includes('arxiv.org/abs/')
  )
  if (arxivOnly.length > 0) {
    console.log(`[prepare-digest] Fetching affiliations for ${arxivOnly.length} cross-source arXiv items...`)
    for (let i = 0; i < arxivOnly.length; i += 3) {
      const batch = arxivOnly.slice(i, i + 3)
      const results = await Promise.all(
        batch.map((item) => {
          const id = item.url.match(/arxiv\.org\/abs\/([^\s?#]+)/)?.[1]
          return id ? fetchArxivAffiliations(id) : Promise.resolve([])
        })
      )
      batch.forEach((item, j) => { if (results[j].length > 0) item.affiliations = results[j] })
    }
  }

  console.log(`[prepare-digest] Processing ${items.length} items with Claude...`)

  const weekendNote = isWeekend && dateRange
    ? `\n\nNote: This is a Monday weekend edition covering ${dateRange}. Include items from Friday through Monday.`
    : ''

  let digest
  let usage
  let lastParseError
  const maxParseAttempts = 3
  for (let attempt = 1; attempt <= maxParseAttempts; attempt++) {
    const response = await callWithRetry(() => client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Date: ${today}${weekendNote}\n\nItems:\n${JSON.stringify(items, null, 2)}`,
        },
      ],
    }))

    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''

    try {
      digest = JSON.parse(text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim())
      usage = response.usage
      break
    } catch {
      const match = text.match(/\{[\s\S]*\}/)
      try {
        if (!match) throw new Error('no JSON object found')
        digest = JSON.parse(match[0])
        usage = response.usage
        break
      } catch (err2) {
        lastParseError = err2
        console.error(
          `[prepare-digest] Failed to parse response as JSON (attempt ${attempt}/${maxParseAttempts}): ${err2.message}`
        )
        console.error('First 300 chars:', text.slice(0, 300))
      }
    }
  }

  if (!digest) {
    console.error('[prepare-digest] Giving up after repeated JSON parse failures:', lastParseError?.message)
    process.exit(1)
  }

  if (isWeekend) {
    digest.edition = 'weekend'
    if (dateRange) digest.dateRange = dateRange
  }

  await mkdir(OUTPUT_DIR, { recursive: true })

  const outputPath = join(OUTPUT_DIR, `${today}.json`)
  await writeFile(outputPath, JSON.stringify(digest, null, 2))

  console.log(`[prepare-digest] Written to ${outputPath}`)
  console.log(
    `[prepare-digest] Tokens — input: ${usage.input_tokens}, ` +
    `cache_write: ${usage.cache_creation_input_tokens ?? 0}, ` +
    `cache_read: ${usage.cache_read_input_tokens ?? 0}`
  )

  // Process flagged affiliation issues after today's digest is written
  const patched = await processFlaggedIssues()
  if (patched.length > 0) {
    const { generateCodeFixPR } = await import('./fix-affiliations.js')
    await generateCodeFixPR(patched)
  }
}

main().catch((err) => {
  console.error('[prepare-digest] Fatal:', err.message)
  process.exit(1)
})
