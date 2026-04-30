#!/usr/bin/env node
import { readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { collectArxiv } from './collectors/arxiv.js'
import { collectHackerNews } from './collectors/hackernews.js'
import { collectBlogs } from './collectors/blogs.js'
import { collectPodcasts } from './collectors/podcasts.js'
import { collectFollowBuilders } from './collectors/followbuilders.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const STATE_PATH = join(__dirname, 'state.json')
const OUTPUT_PATH = join(__dirname, 'raw-feed.json')

const STATE_TTL_DAYS = 7

async function loadState() {
  if (!existsSync(STATE_PATH)) return { seen: {} }
  try {
    return JSON.parse(await readFile(STATE_PATH, 'utf-8'))
  } catch {
    return { seen: {} }
  }
}

function pruneState(state) {
  const cutoff = Date.now() - STATE_TTL_DAYS * 24 * 60 * 60 * 1000
  const pruned = {}
  for (const [id, seenAt] of Object.entries(state.seen ?? {})) {
    if (new Date(seenAt).getTime() > cutoff) pruned[id] = seenAt
  }
  return { seen: pruned }
}

async function main() {
  console.log('[generate-feed] Starting...')

  const state = await loadState()

  const [papers, hnStories, articles, episodes, fbItems] = await Promise.all([
    collectArxiv(),
    collectHackerNews(),
    collectBlogs(),
    collectPodcasts(),
    collectFollowBuilders(),
  ])

  console.log(
    `[generate-feed] Collected: ${papers.length} papers, ${hnStories.length} HN, ` +
    `${articles.length} articles, ${episodes.length} podcast episodes, ${fbItems.length} follow-builders`
  )

  const allItems = [...papers, ...hnStories, ...articles, ...episodes, ...fbItems]
  const newItems = allItems.filter((item) => !state.seen[item.id])

  const now = new Date().toISOString()
  for (const item of newItems) {
    state.seen[item.id] = now
  }

  const prunedState = pruneState(state)
  await writeFile(STATE_PATH, JSON.stringify(prunedState, null, 2))

  console.log(`[generate-feed] ${newItems.length} new items after deduplication`)

  await writeFile(
    OUTPUT_PATH,
    JSON.stringify({ generatedAt: now, items: newItems }, null, 2)
  )
  console.log(`[generate-feed] Written to ${OUTPUT_PATH}`)
}

main().catch((err) => {
  console.error('[generate-feed] Fatal:', err.message)
  process.exit(1)
})
