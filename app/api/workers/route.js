/**
 * /api/workers
 *
 * Security fixes:
 *  ✅ Only returns safe public fields (id, name, village, block, role) — no otp, phone, email
 *  ✅ Restricted to supervisors; ASHAs receive 403
 */
import { getDb } from '@/lib/db'
import { NextResponse } from 'next/server'

// Safe columns only — never expose otp hash, phone, email
const SAFE_COLS = 'id, name, village, block, role'

export async function GET(request) {
  const sessionRole = request.headers.get('x-worker-role')

  // Only supervisors may list workers
  if (sessionRole !== 'supervisor') {
    return NextResponse.json(
      { error: 'फक्त पर्यवेक्षकांना हे पाहण्याचा अधिकार आहे.' },
      { status: 403 }
    )
  }

  const db = getDb()
  const { searchParams } = new URL(request.url)
  const role = searchParams.get('role')

  const workers = role
    ? db.prepare(`SELECT ${SAFE_COLS} FROM workers WHERE role = ?`).all(role)
    : db.prepare(`SELECT ${SAFE_COLS} FROM workers`).all()

  return NextResponse.json(workers)
}
