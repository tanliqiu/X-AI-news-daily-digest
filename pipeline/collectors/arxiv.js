import { gunzipSync } from 'zlib'
import { XMLParser } from 'fast-xml-parser'

const FEEDS = [
  'https://export.arxiv.org/rss/cs.AI',
  'https://export.arxiv.org/rss/cs.CL',
  'https://export.arxiv.org/rss/cs.LG',
]

const DEFAULT_LOOKBACK_HOURS = 48
const MAX_PAPERS = 10

// Extract .tex file contents from a decompressed tar buffer using a minimal parser.
function extractTexFromTar(tarBuf) {
  const files = []
  let offset = 0
  while (offset + 512 <= tarBuf.length) {
    if (tarBuf[offset] === 0) break
    const name = tarBuf.subarray(offset, offset + 100).toString('utf8').replace(/\0+$/, '')
    const size = parseInt(tarBuf.subarray(offset + 124, offset + 136).toString('utf8'), 8) || 0
    const type = tarBuf[offset + 156]
    offset += 512
    if ((type === 0 || type === 48) && name.endsWith('.tex')) {
      files.push(tarBuf.subarray(offset, offset + size).toString('utf8'))
    }
    offset += Math.ceil(size / 512) * 512
  }
  return files
}

// Extract unique institution names from LaTeX source.
function affiliationsFromTex(tex) {
  // Strip comments, normalize common escapes
  const src = tex
    .replace(/(?<!\\)%[^\n]*/g, '')
    .replace(/\\&/g, '&')
    .replace(/\\~\{?\}?/g, ' ')

  const results = [], seen = new Set()

  const INST_WORDS = /\b(?:University|Institute|Laboratory|Labs?|College|School|Research(?:er)?|Center|Centre|Department|Faculty|Hospital|Foundation|Technology|Sciences?|Academy|Polytechnic|Corp|Inc|Ltd|Group|Independent|NTNU|MIT|CMU|UCLA|EPFL|ETH|Ventures?)\b/i
  const isPersonName = (s) => /^[A-Z][a-z]+(?: [A-Z]\.?)? [A-Z][a-z]+$/.test(s) && !INST_WORDS.test(s)
  const isAddressOnly = (s) => /^[\w\s]+,\s*[A-Z]{2}\s+\d{5}/.test(s) || /^\d{5}$/.test(s)
  const COUNTRIES = /\b(?:USA|United States|UK|United Kingdom|China|Germany|France|Japan|Canada|Australia|Norway|India|Korea|Italy|Spain|Netherlands|Switzerland|Sweden|Denmark|Finland|Ireland|Israel|Singapore|Brazil|Poland)\b/i
  const isGarbage = (s) =>
    s.includes('&') ||
    /(?:equal|co-first)\s+contribution|corresponding author/i.test(s) ||
    /^[a-z]{2,20}$/.test(s) ||   // lowercase-only token (username, partial command)
    /^(TBD|N\/A|NA|TBA|Anonymous)$/i.test(s.split(/[\s,]+/).pop() ?? s) ||  // placeholder suffix
    /ORCID|\b\d{4}-\d{4}-\d{4}-\d{3}[\dX]\b/.test(s) ||  // ORCID identifiers
    s.startsWith('\\') ||
    // City-only or City+State+Country without any institution keyword
    (!INST_WORDS.test(s) && COUNTRIES.test(s) && s.split(',').length <= 3 && s.split(/\s+/).length <= 6)

  const clean = (raw) => raw
    .replace(/\\includegraphics(?:\[[^\]]*\])?\s*\{[^}]*\}/g, '') // strip \includegraphics[...]{...}
    .replace(/\$[^$\n]*\$/g, '')                                   // strip inline math $...$
    .replace(/\$/g, '')                                            // strip lone $ residue
    .replace(/\[\d+(?:\.\d+)?(?:pt|em|ex|cm|mm|in)\]/g, '')      // strip spacing like [7pt]
    .replace(/\\(?:textbf|textit|emph|textrm|textsc|textsuperscript|footnotemark|thanks|footnote)\s*(?:\[[^\]]*\])?\s*\{[^}]*\}/g, '')
    .replace(/\\[a-zA-Z]+(?:\{[^}]*\})?/g, ' ')
    .replace(/\S*@\S+/g, '')
    .replace(/,\s*[A-Za-z ]+,\s*[A-Z]{2}\s+\d{5}.*$/, '')
    .replace(/,\s*[A-Z]{2}\s+\d{5}.*$/, '')
    .replace(/[{}[\]]/g, '')
    .replace(/\s+/g, ' ').replace(/[,\s]+$/, '').trim().slice(0, 120)

  const add = (raw) => {
    const rawSimple = raw
      .replace(/\$[^$\n]*\$/g, '')
      .replace(/\\[a-zA-Z]+(?:\{[^}]*\})?/g, ' ')
      .replace(/\s+/g, ' ').trim()
    if (isAddressOnly(rawSimple)) return
    const s = clean(raw)
    if (s.length >= 4 && !seen.has(s) && !isPersonName(s) && !isAddressOnly(s) && !isGarbage(s)) {
      seen.add(s); results.push(s)
    }
  }

  // 1. Pre-pass: $^n$Institution inline superscript style (digit-only — $^*$ marks authors, not institutions)
  //    Must run before math stripping erases the markers.
  for (const m of src.matchAll(/\$\^\{?(?:\d+)\}?\$\s*([A-Z][^$\\\n{}]{3,100})/g)) {
    const s = clean(m[1])
    if (s.length >= 4 && !seen.has(s) && !isPersonName(s) && !isGarbage(s)) {
      seen.add(s); results.push(s)
    }
    if (results.length >= 5) break
  }

  // 2. ACM sigconf: \institution{Dept \\ ShortName} + optional nearby \city{} \country{}
  //    Run before generic \affiliation{} to avoid capturing truncated inner content.
  if (src.includes('\\institution{')) {
    for (const m of src.matchAll(/\\institution\s*\{([^}]+)\}/g)) {
      const parts = m[1].split(/\\\\/).map(p => clean(p)).filter(p => p.length >= 2)
      const instName = parts[parts.length - 1] ?? clean(m[1])
      if (!instName || instName.length < 2) continue
      const after = src.slice(m.index + m[0].length, m.index + m[0].length + 250)
      const city = after.match(/\\city\s*\{([^}]+)\}/)?.[1]
      const country = after.match(/\\country\s*\{([^}]+)\}/)?.[1]
      const combined = [instName, city && clean(city), country && clean(country)].filter(Boolean).join(', ')
      if (!seen.has(combined)) { seen.add(combined); results.push(combined) }
      if (results.length >= 5) return results
    }
    if (results.length > 0) return results
  }

  // 3. IEEEtran: \IEEEauthorblockA{...} — extract affiliation block with brace-balanced content,
  //    then split by \\ and take only parts that look like institution names (not email/ORCID lines).
  for (const m of src.matchAll(/\\IEEEauthorblockA\s*\{/g)) {
    // Use brace-balanced extraction so nested \texttt{...} doesn't prematurely close the match.
    let depth = 0, start = m.index + m[0].length, end = -1
    for (let i = start; i < src.length; i++) {
      if (src[i] === '\\') { i++; continue }
      if (src[i] === '{') depth++
      else if (src[i] === '}') {
        if (depth === 0) { end = i; break }
        depth--
      }
    }
    if (end === -1) continue
    const blockContent = src.slice(start, end)
    // Split on \\ separators; take parts that are not email/ORCID/URL lines.
    for (const part of blockContent.split(/\\\\/)) {
      const stripped = part
        .replace(/\\texttt\s*\{[^}]*\}/g, '')   // remove \texttt{...} (emails/urls)
        .replace(/\\[a-zA-Z]+(?:\{[^}]*\})?/g, ' ')
        .replace(/\S*@\S+/g, '')                 // remove email addresses
        .replace(/ORCID\s*:\s*[\d-]+/gi, '')     // remove ORCID lines
        .replace(/https?:\/\/\S+/g, '')          // remove URLs
        .replace(/[{}]/g, '')
        .replace(/\s+/g, ' ').trim()
      if (stripped.length >= 4 && INST_WORDS.test(stripped)) {
        add(stripped)
        if (results.length >= 5) return results
      }
    }
  }

  // 4. Standard affiliation commands (split by \\ and \qquad to handle multiple insts per line)
  for (const m of src.matchAll(/\\(?:affiliation|affil|institute|address)\*?\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/g)) {
    for (const part of m[1].split(/\\\\|\\qquad|\\quad/)) { add(part); if (results.length >= 5) return results }
  }

  // 5. JMLR style: \addr Institution (no braces)
  if (results.length === 0) {
    for (const m of src.matchAll(/\\addr\s+([A-Z][^\\\n{$]{3,100})/g)) {
      add(m[1]); if (results.length >= 5) return results
    }
  }

  // 6. ICML: \icmlaffiliation{key}{Institution Name}
  for (const m of src.matchAll(/\\icmlaffiliation\s*\{[^}]*\}\s*\{([^}]+)\}/g)) {
    add(m[1]); if (results.length >= 5) return results
  }

  // 7. NeurIPS/ACL \textsuperscript{n}Institution Name
  if (results.length === 0) {
    for (const m of src.matchAll(/\\textsuperscript\{\d+\}\s*([A-Z][^\\\n{}]+)/g)) {
      add(m[1]); if (results.length >= 5) return results
    }
  }

  // 8. Fallback: \author{Name \\ Institution \\ \And ...} with brace-counting
  if (results.length === 0) {
    const marker = '\\author{'
    const start = src.indexOf(marker)
    if (start >= 0) {
      let depth = 0, authorContent = null
      for (let i = start + marker.length; i < src.length; i++) {
        if (src[i] === '\\') { i++; continue }
        if (src[i] === '{') depth++
        else if (src[i] === '}') {
          if (depth === 0) { authorContent = src.slice(start + marker.length, i); break }
          depth--
        }
      }
      if (authorContent) {
        for (const group of authorContent.split(/\\And\b/i)) {
          const parts = group.split(/\\\\/).filter(p => p.trim().length >= 4)
          for (const part of parts.slice(1)) { add(part); if (results.length >= 5) return results }
        }
      }
    }
  }

  return results
}

export async function fetchArxivAffiliations(arxivId) {
  try {
    const res = await fetch(`https://arxiv.org/e-print/${arxivId}`, {
      headers: { 'User-Agent': 'AI-Digest-Bot/1.0' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return []

    const buf = Buffer.from(await res.arrayBuffer())
    let texFiles = []
    try {
      const unpacked = gunzipSync(buf)
      texFiles = extractTexFromTar(unpacked)
      if (texFiles.length === 0) texFiles = [unpacked.toString('utf8')]
    } catch {
      // Not gzipped — try raw tar
      texFiles = extractTexFromTar(buf)
    }

    // Prefer files that have \author (real paper), not standalone figures with \begin{document}
    // Prefer files with both markers; fall back to any file with affiliation commands
    const main = texFiles.find(t => t.includes('\\begin{document}') && t.includes('\\author'))
      ?? texFiles.find(t => t.includes('\\affil') || t.includes('\\affiliation') || t.includes('\\author{'))
      ?? texFiles.find(t => t.includes('\\begin{document}'))
      ?? texFiles[0]
    return main ? affiliationsFromTex(main) : []
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