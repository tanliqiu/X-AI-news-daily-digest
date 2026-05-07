import { NextRequest, NextResponse } from 'next/server'

const REPO = process.env.GITHUB_REPO ?? 'tanliqiu/X-AI-news-daily-digest'
const LABEL = 'affiliation-fix'

export async function POST(req: NextRequest) {
  const token = process.env.GITHUB_TOKEN
  if (!token) return NextResponse.json({ error: 'Not configured' }, { status: 500 })

  const { arxivId, title, digestDate, currentAffiliations, userCorrection } = await req.json()

  const bodyLines = [
    `**Paper:** [${title}](https://arxiv.org/abs/${arxivId})`,
    `**arXiv ID:** \`${arxivId}\``,
    `**Digest date:** ${digestDate}`,
    `**Current affiliations:** ${currentAffiliations?.length ? currentAffiliations.join(', ') : '_none_'}`,
  ]
  if (userCorrection?.trim()) bodyLines.push(`**User correction:** ${userCorrection.trim()}`)

  const res = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: `[affiliation-fix] ${title}`,
      body: bodyLines.join('\n'),
      labels: [LABEL],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[flag-affiliation] GitHub API error:', err)
    return NextResponse.json({ error: 'GitHub API error' }, { status: 502 })
  }

  const issue = await res.json()
  return NextResponse.json({ issueUrl: issue.html_url })
}
