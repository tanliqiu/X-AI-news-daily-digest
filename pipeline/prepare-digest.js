#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import Anthropic from '@anthropic-ai/sdk'
import 'dotenv/config'

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

For Research items only, add two extra fields:
- "keywords": array of 1–3 tags chosen from: Evaluation, Security, Framework, Application, Alignment, Inference, Training, Multimodal, Reasoning, Agents, RAG, Benchmarks, Survey
- "affiliations": if the raw item has a non-empty "affiliations" array, pass it through unchanged. Otherwise infer up to 5 institution names from your training knowledge of the authors (ordered by contribution, omit unknowns). If none known, omit the field. Return only institution names, not author names.

Return ONLY valid JSON. No markdown fences, no preamble. Schema:
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

  console.log(`[prepare-digest] Processing ${items.length} items with Claude...`)

  const weekendNote = isWeekend && dateRange
    ? `\n\nNote: This is a Monday weekend edition covering ${dateRange}. Include items from Friday through Monday.`
    : ''

  const response = await client.messages.create({
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
  })

  const text =
    response.content[0]?.type === 'text' ? response.content[0].text : ''

  let digest
  try {
    digest = JSON.parse(text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim())
  } catch (err) {
    console.error('[prepare-digest] Failed to parse response as JSON:', err.message)
    console.error('First 300 chars:', text.slice(0, 300))
    process.exit(1)
  }

  if (isWeekend) {
    digest.edition = 'weekend'
    if (dateRange) digest.dateRange = dateRange
  }

  await mkdir(OUTPUT_DIR, { recursive: true })

  const outputPath = join(OUTPUT_DIR, `${today}.json`)
  await writeFile(outputPath, JSON.stringify(digest, null, 2))

  const usage = response.usage
  console.log(`[prepare-digest] Written to ${outputPath}`)
  console.log(
    `[prepare-digest] Tokens — input: ${usage.input_tokens}, ` +
    `cache_write: ${usage.cache_creation_input_tokens ?? 0}, ` +
    `cache_read: ${usage.cache_read_input_tokens ?? 0}`
  )
}

main().catch((err) => {
  console.error('[prepare-digest] Fatal:', err.message)
  process.exit(1)
})
