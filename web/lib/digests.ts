import fs from 'fs'
import path from 'path'

const DIGESTS_DIR = path.join(process.cwd(), 'data', 'digests')

export interface DigestItem {
  title: string
  summary: string
  url: string
  source: string
  published: string
}

export interface Digest {
  date: string
  tldr: string[]
  sections: {
    Research: DigestItem[]
    Tools: DigestItem[]
    'Industry News': DigestItem[]
  }
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
