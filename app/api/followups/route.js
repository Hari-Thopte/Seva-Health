/**
 * /api/followups
 *
 * Security: worker identity from JWT; ASHAs see only their followups.
 */
import { getDb } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const db = getDb()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || 'pending'

  const sessionWorkerId = request.headers.get('x-worker-id')
  const sessionRole = request.headers.get('x-worker-role')

  let query = `
    SELECT f.*, p.name as patient_name, p.village, p.risk_level, p.category
    FROM followups f
    LEFT JOIN patients p ON f.patient_id = p.id
    WHERE f.status = ?
  `
  const params = [status]

  if (sessionRole === 'supervisor') {
    const filterWorkerId = searchParams.get('worker_id')
    if (filterWorkerId) { query += ' AND f.worker_id = ?'; params.push(filterWorkerId) }
  } else {
    query += ' AND f.worker_id = ?'
    params.push(sessionWorkerId)
  }

  query += ' ORDER BY f.due_date ASC'

  const followups = db.prepare(query).all(...params)
  return NextResponse.json(followups)
}

export async function POST(request) {
  const db = getDb()
  const body = await request.json()
  const sessionWorkerId = request.headers.get('x-worker-id')
  const sessionRole = request.headers.get('x-worker-role')

  // Verify the patient belongs to this worker (supervisors may log follow-ups for any patient)
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(body.patient_id)
  if (!patient) {
    return NextResponse.json({ error: 'रुग्ण आढळला नाही.' }, { status: 404 })
  }
  if (sessionRole !== 'supervisor' && String(patient.worker_id) !== sessionWorkerId) {
    return NextResponse.json(
      { error: 'आपण फक्त आपल्या रुग्णांसाठी फॉलो-अप नोंदवू शकता.' },
      { status: 403 }
    )
  }

  const stmt = db.prepare(`
    INSERT INTO followups (patient_id, worker_id, due_date, type, notes)
    VALUES (?, ?, ?, ?, ?)
  `)
  const result = stmt.run(
    body.patient_id, sessionWorkerId, body.due_date,
    body.type || 'antenatal', body.notes || ''
  )
  return NextResponse.json({ id: result.lastInsertRowid, success: true })
}

export async function PATCH(request) {
  const db = getDb()
  const body = await request.json()
  const sessionWorkerId = request.headers.get('x-worker-id')
  const sessionRole = request.headers.get('x-worker-role')

  // Ensure the followup belongs to the authenticated worker (unless supervisor)
  const followup = db.prepare('SELECT * FROM followups WHERE id = ?').get(body.id)
  if (!followup) {
    return NextResponse.json({ error: 'Follow-up आढळला नाही.' }, { status: 404 })
  }
  if (sessionRole !== 'supervisor' && String(followup.worker_id) !== sessionWorkerId) {
    return NextResponse.json({ error: 'अनधिकृत प्रवेश.' }, { status: 403 })
  }

  db.prepare(`
    UPDATE followups SET status = 'completed', completed_at = datetime('now') WHERE id = ?
  `).run(body.id)
  return NextResponse.json({ success: true })
}
