'use client'

import { useState, useEffect } from 'react'

interface Props {
  arxivId: string
  title: string
  digestDate: string
  currentAffiliations: string[]
}

export default function AffiliationFlagButton({ arxivId, title, digestDate, currentAffiliations }: Props) {
  const storageKey = `affil-flagged:${arxivId}`
  const [open, setOpen] = useState(false)
  const [correction, setCorrection] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done'>('idle')
  const [issueUrl, setIssueUrl] = useState<string | null>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const { issueUrl: url } = JSON.parse(stored)
        setStatus('done')
        setIssueUrl(url)
      }
    } catch {}
  }, [storageKey])

  async function submit() {
    setStatus('submitting')
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      const secret = process.env.NEXT_PUBLIC_FLAG_SECRET
      if (secret) headers['x-flag-secret'] = secret

      const res = await fetch('/api/flag-affiliation', {
        method: 'POST',
        headers,
        body: JSON.stringify({ arxivId, title, digestDate, currentAffiliations, userCorrection: correction }),
      })
      const data = await res.json()
      if (res.ok) {
        localStorage.setItem(storageKey, JSON.stringify({ issueUrl: data.issueUrl }))
        setIssueUrl(data.issueUrl)
        setStatus('done')
        setOpen(false)
      } else {
        setStatus('idle')
        console.error('[flag] error:', data.error)
      }
    } catch {
      setStatus('idle')
    }
  }

  if (status === 'done') {
    return (
      <a
        href={issueUrl ?? '#'}
        target="_blank"
        rel="noopener noreferrer"
        title="Affiliation flagged — view issue"
        className="text-amber-600 hover:text-amber-700 transition-colors"
      >
        <FlagIcon filled />
      </a>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Flag incorrect affiliations"
        className="text-zinc-400 hover:text-amber-600 transition-colors"
      >
        <FlagIcon />
      </button>

      {open && (
        <div className="absolute right-0 top-6 z-20 w-72 bg-white border border-zinc-200 rounded-lg p-3 shadow-xl">
          <p className="text-xs font-semibold text-zinc-700 mb-2">Flag affiliation issue</p>

          {currentAffiliations.length > 0 ? (
            <div className="flex flex-wrap gap-1 mb-2">
              {currentAffiliations.map((a) => (
                <span key={a} className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600">{a}</span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-400 mb-2 italic">No affiliations extracted</p>
          )}

          <textarea
            value={correction}
            onChange={(e) => setCorrection(e.target.value)}
            placeholder="Correct affiliations (optional)"
            rows={2}
            className="w-full text-xs bg-zinc-50 border border-zinc-300 rounded px-2 py-1.5 text-zinc-800 placeholder-zinc-400 resize-none focus:outline-none focus:border-zinc-500 mb-2"
          />

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setOpen(false)}
              className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={status === 'submitting'}
              className="text-xs px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-medium disabled:opacity-50 transition-colors"
            >
              {status === 'submitting' ? 'Sending…' : 'Report'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function FlagIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 2v14M2 2l8 3-8 3" />
    </svg>
  )
}
