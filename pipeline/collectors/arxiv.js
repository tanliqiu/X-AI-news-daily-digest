import { XMLParser } from 'fast-xml-parser'

const FEEDS = [
  'https://export.arxiv.org/rss/cs.AI',
  'https://export.arxiv.org/rss/cs.CL',
  'https://export.arxiv.org/rss/cs.LG',
]

const DEFAULT_LOOKBACK_HOURS = 48
const MAX_PAPERS = 10

// Extract numbered institution affiliations from arXiv HTML abstract page.
// arXiv HTML uses LaTeXML, placing author/affiliation info in class="ltx_authors"
// before class="ltx_abstract". Affiliations appear as "1 Institution A 2 Institution B".
function parseAffiliationsFromHtml(html) {
  const blockMatch = html.match(/class="ltx_authors"[^>]*>([\s\S]*?)(?=class="ltx_abstract")/)
  if (!blockMatch) return []

  const text = blockMatch[1]
    .replace(/<[^>]+>/g, ' ')
    .replace(/\S+@\S+\.\S+/g, '')       // strip emails
    .replace(/\([^)]*\)/g, '')          // strip parentheticals like (April 9, 2026)
    .replace(/\s+/g, ' ')
    .trim()

  const affiliations = []
  const seen = new Set()
  // Match: digit preceded by whitespace (not part of address like "7/9"), then institution text.
  // Stop at: next numbered institution, E-mail marker, or end of string.
  const regex = /(?<=\s|^)(\d{1,2})\s+([A-Z][\s\S]+?)(?=\s+\d{1,2}\s+[A-Z]|\s*(?:E-mail|email|Correspondence)\b|\s*$)/g

  for (const match of text.matchAll(regex)) {
    const inst = match[2].trim().replace(/[,.\s]+$/, '').slice(0, 120)
    if (inst.length >= 4 && !seen.has(inst)) {
      seen.add(inst)
      affiliations.push(inst)
      if (affiliations.length >= 5) break
    }
  }
  return affiliations
}

async function fetchArxivAffiliations(arxivId) {
  try {
    const res = await fetch(`https://arxiv.org/html/${arxivId}`, {
      headers: { 'User-Agent': 'AI-Digest-Bot/1.0' },
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return []
    return parseAffiliationsFromHtml(await res.text())
  } catch {
    return []
  }
}

export async function collectArxiv(lookbackHours = DEFAULT_LOOKBACK_HOURS) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: true,
    trimValues: true,
  })

  const cutoff = new Date(Date.now() - lookbackHours * 60 * 60 * 1000)
  const allItems = []
  const seen = new Set()

  await Promise.all(
    FEEDS.map(async (feedUrl) => {
      try {
        const res = await fetch(feedUrl, {
          headers: { 'User-Agent': 'AI-Digest-Bot/1.0' },
          signal: AbortSignal.timeout(15000),
        })
        if (!res.ok) return

        const xml = await res.text()
        const parsed = parser.parse(xml)
        const rawItems = parsed?.rss?.channel?.item
        if (!rawItems) return

        const items = Array.isArray(rawItems) ? rawItems : [rawItems]

        for (const item of items) {
          const rawUrl = typeof item.link === 'string' ? item.link : String(item.link || '')
          const arxivId = rawUrl.match(/arxiv\.org\/abs\/([^\s?#]+)/)?.[1]
          if (!arxivId || seen.has(arxivId)) continue

          const pubDate = item.pubDate ? new Date(item.pubDate) : null
          if (pubDate && pubDate < cutoff) continue

          seen.add(arxivId)
          const title = String(item.title || '')
            .replace(/\[.*?\]\s*/, '')
            .trim()
          const description = String(item.description || '')
            .replace(/<[^>]+>/g, '')
            .trim()
            .slice(0, 500)

          allItems.push({
            type: 'paper',
            id: arxivId,
            title,
            summary: description,
            url: `https://arxiv.org/abs/${arxivId}`,
            source: 'arXiv',
            published: pubDate?.toISOString() ?? new Date().toISOString(),
          })
        }
      } catch (err) {
        console.error(`[arxiv] Failed to fetch ${feedUrl}: ${err.message}`)
      }
    })
  )

  const papers = allItems.slice(0, MAX_PAPERS)
  if (papers.length === 0) return papers

  // Phase 2: Atom API for author names (sequential after RSS to avoid rate limiting)
  const idList = papers.map((p) => p.id).join(',')
  let atomResult = ''
  try {
    const atomRes = await fetch(
      `https://export.arxiv.org/api/query?id_list=${idList}&max_results=${MAX_PAPERS}`,
      { headers: { 'User-Agent': 'AI-Digest-Bot/1.0' }, signal: AbortSignal.timeout(20000) }
    )
    if (atomRes.ok) atomResult = await atomRes.text()
  } catch (err) {
    console.error(`[arxiv] Atom API fetch failed: ${err.message}`)
  }

  // Phase 3: HTML pages for affiliations — batches of 3 to stay within arxiv rate limits
  const htmlAffiliations = []
  for (let i = 0; i < papers.length; i += 3) {
    const batch = papers.slice(i, i + 3)
    const results = await Promise.all(batch.map((p) => fetchArxivAffiliations(p.id)))
    htmlAffiliations.push(...results)
  }

  // Parse Atom response for author names
  if (atomResult) {
    try {
      const atomParsed = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        parseAttributeValue: true,
        trimValues: true,
        isArray: (name) => ['entry', 'author'].includes(name),
      }).parse(atomResult)

      const entries = atomParsed?.feed?.entry ?? []
      const authorsByArxivId = new Map()
      for (const entry of entries) {
        const idUrl = typeof entry.id === 'string' ? entry.id : ''
        const arxivId = idUrl.match(/arxiv\.org\/abs\/([^\s?#v]+)/)?.[1]
        if (!arxivId) continue
        const authors = (entry.author ?? [])
          .map((a) => (typeof a.name === 'string' ? a.name.trim() : ''))
          .filter(Boolean)
        authorsByArxivId.set(arxivId, authors)
      }
      for (const paper of papers) {
        const authors = authorsByArxivId.get(paper.id)
        if (authors?.length) paper.authors = authors
      }
    } catch (err) {
      console.error(`[arxiv] Atom API parse failed: ${err.message}`)
    }
  }

  // Merge HTML-extracted affiliations
  for (let i = 0; i < papers.length; i++) {
    if (htmlAffiliations[i].length > 0) {
      papers[i].affiliations = htmlAffiliations[i]
    }
  }

  const withAffil = papers.filter((p) => p.affiliations).length
  console.log(`[arxiv] ${papers.length} papers, ${withAffil} with HTML affiliations`)

  return papers
}
