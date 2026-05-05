'use client'

import { useEffect } from 'react'

interface Props {
  date: string
}

export default function MarkAsRead({ date }: Props) {
  useEffect(() => {
    try {
      const stored = localStorage.getItem('digest-read')
      const read: Record<string, boolean> = stored ? JSON.parse(stored) : {}
      read[date] = true
      localStorage.setItem('digest-read', JSON.stringify(read))
    } catch {}
  }, [date])

  return null
}
