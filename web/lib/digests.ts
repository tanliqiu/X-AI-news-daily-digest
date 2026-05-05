import fs from 'fs'
import path from 'path'

const DIGESTS_DIR = path.join(process.cwd(), 'data', 'digests')

export interface DigestItem {
  title: string
  summary: string
  url: string
  source: string
  published: string
  keywords?: string[]
  authors?: { name: string; affiliation: string }[]
}

export interface Digest {
  date: string
  tldr: string[]
  edition?: 'weekend'
  dateRange?: string
  sections: {
    Research: DigestItem[]
    Tools: DigestItem[]
    'Industry News': DigestItem[]
  }
}

export interface DigestSummary {
  date: string
  edition?: 'weekend'
  dateRange?: string
  tldr: string[]
  counts: { Research: number; Tools: number; 'Industry News': number }
}

export function getDigestDates(): string[] {
  if (!fs.existsSync(DIGESTS_DIR)) return []
  return fs
    .readdirSync(DIGESTS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace('.json', ''))
    .sort()
    .reverse()
}

export function getDigest(date: string): Digest | null {
  const filePath = path.join(DIGESTS_DIR, `${date}.json`)
  if (!fs.existsSync(filePath)) return null
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Digest
  } catch {
    return null
  }
}

export function getDigestSummaries(limit = 14): DigestSummary[] {
  const dates = getDigestDates().slice(0, limit)
  const summaries: DigestSummary[] = []
  for (const date of dates) {
    const digest = getDigest(date)
    if (!digest) continue
    summaries.push({
      date,
      edition: digest.edition,
      dateRange: digest.dateRange,
      tldr: digest.tldr ?? [],
      counts: {
        Research: digest.sections.Research?.length ?? 0,
        Tools: digest.sections.Tools?.length ?? 0,
        'Industry News': digest.sections['Industry News']?.length ?? 0,
      },
    })
  }
  return summaries
}
