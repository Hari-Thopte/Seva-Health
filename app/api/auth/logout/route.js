import { NextResponse } from 'next/server'
import { clearSessionCookie } from '@/lib/session'

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'लॉगआउट यशस्वी.' })
  return clearSessionCookie(response)
}
