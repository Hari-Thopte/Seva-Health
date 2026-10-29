/**
 * /api/patients
 *
 * Security fixes:
 *  ✅ Session required (enforced by middleware.js)
 *  ✅ worker_id scoped from JWT — ASHAs can only read their own patients
 *  ✅ Supervisors can query any worker (or all)
 *  ✅ POST assigns worker_id from session, not request body
 */
import { getDb } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const db = getDb()
  const { searchParams } = new URL(request.url)

  // Worker identity comes from the verified JWT (set by middleware)
  const sessionWorkerId = request.headers.get('x-worker-id')
  const sessionRole = request.headers.get('x-worker-role')

  // Risk filter is still a public query param — safe to pass through
  const riskLevel = searchParams.get('risk')

  let query = `
    SELECT p.*, w.name as worker_name
    FROM patients p
    LEFT JOIN workers w ON p.worker_id = w.id
    WHERE 1=1
  `
  const params = []

  if (sessionRole === 'supervisor') {
    // Supervisors may optionally filter by a specific worker
    const filterWorkerId = searchParams.get('worker_id')
    if (filterWorkerId) {
      query += ' AND p.worker_id = ?'
      params.push(filterWorkerId)
    }
  } else {
    // ASHAs only see their own patients — ignore any worker_id param
    query += ' AND p.worker_id = ?'
    params.push(sessionWorkerId)
  }

  if (riskLevel) { query += ' AND p.risk_level = ?'; params.push(riskLevel) }
  query += " ORDER BY CASE p.risk_level WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, p.name"

  const patients = db.prepare(query).all(...params)
  return NextResponse.json(patients)
}

export async function POST(request) {
  const db = getDb()
  const body = await request.json()

  // Always use the authenticated worker's id — never trust the body
  const sessionWorkerId = request.headers.get('x-worker-id')

  const stmt = db.prepare(`
    INSERT INTO patients (name, age, phone, village, category, weeks_pregnant, risk_level, worker_id, next_followup, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const result = stmt.run(
    body.name, body.age, body.phone, body.village,
    body.category || 'pregnant', body.weeks_pregnant || null,
    body.risk_level || 'low', sessionWorkerId, body.next_followup || null, body.notes || ''
  )
  return NextResponse.json({ id: result.lastInsertRowid, success: true })
}
