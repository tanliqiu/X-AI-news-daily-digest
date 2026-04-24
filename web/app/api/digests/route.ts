import { NextResponse } from 'next/server'
import { getDigestDates } from '@/lib/digests'

export function GET() {
  return NextResponse.json({ dates: getDigestDates() })
}
