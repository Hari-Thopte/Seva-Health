/**
 * /api/visits
 *
 * Security fixes:
 *  ✅ POST: verify patient_id belongs to the authenticated worker (no cross-worker visit creation)
 *  ✅ POST: flags recomputed server-side from voice_transcript via clinicalParser — client flags ignored
 *  ✅ GET: worker_id scoped from JWT (no param tampering)
 */
import { getDb } from '@/lib/db'
import { NextResponse } from 'next/server'
import { parseMarathiClinicalText } from '@/lib/clinicalParser'

export async function GET(request) {
  const db = getDb()
  const { searchParams } = new URL(request.url)

  const sessionWorkerId = request.headers.get('x-worker-id')
  const sessionRole = request.headers.get('x-worker-role')
  const patientId = searchParams.get('patient_id')

  let query = `
    SELECT v.*, p.name as patient_name, p.village, p.risk_level, w.name as worker_name
    FROM visits v
    LEFT JOIN patients p ON v.patient_id = p.id
    LEFT JOIN workers w ON v.worker_id = w.id
    WHERE 1=1
  `
  const params = []

  if (sessionRole === 'supervisor') {
    const filterWorkerId = searchParams.get('worker_id')
    if (filterWorkerId) { query += ' AND v.worker_id = ?'; params.push(filterWorkerId) }
  } else {
    query += ' AND v.worker_id = ?'
    params.push(sessionWorkerId)
  }

  if (patientId) { query += ' AND v.patient_id = ?'; params.push(patientId) }
  query += ' ORDER BY v.visit_date DESC LIMIT 50'

  const visits = db.prepare(query).all(...params)
  return NextResponse.json(visits)
}

export async function POST(request) {
  const db = getDb()
  const body = await request.json()

  const sessionWorkerId = request.headers.get('x-worker-id')
  const sessionRole = request.headers.get('x-worker-role')

  // Verify the patient belongs to this worker (supervisors may log visits for any patient)
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(body.patient_id)
  if (!patient) {
    return NextResponse.json({ error: 'रुग्ण आढळला नाही.' }, { status: 404 })
  }
  if (sessionRole !== 'supervisor' && String(patient.worker_id) !== sessionWorkerId) {
    return NextResponse.json(
      { error: 'आपण फक्त आपल्या रुग्णांसाठी भेट नोंदवू शकता.' },
      { status: 403 }
    )
  }

  // ── Recompute clinical flags server-side — never trust client-supplied flags ──
  const transcript = body.voice_transcript || ''
  const parsed = parseMarathiClinicalText(transcript)

  // Merge parsed measurements; prefer body values if parser found nothing
  const bp_systolic  = parsed.bp_systolic  ?? (body.bp_systolic  || null)
  const bp_diastolic = parsed.bp_diastolic ?? (body.bp_diastolic || null)
  const weight       = parsed.weight       ?? (body.weight       || null)

  // Server-authoritative flags from the clinical parser
  const serverFlags = parsed.flags.join(',')

  const stmt = db.prepare(`
    INSERT INTO visits (patient_id, worker_id, visit_date, voice_transcript, bp_systolic, bp_diastolic, weight, notes, flags)
    VALUES (?, ?, datetime('now'), ?, ?, ?, ?, ?, ?)
  `)
  const result = stmt.run(
    body.patient_id,
    sessionWorkerId,
    transcript,
    bp_systolic,
    bp_diastolic,
    weight,
    body.notes || '',
    serverFlags
  )

  // Update patient risk level from server-computed flags
  let risk = 'low'
  if (
    parsed.flags.includes('HIGH_BP') ||
    parsed.flags.includes('TEEN_PREGNANCY') ||
    parsed.flags.includes('MALNUTRITION') ||
    parsed.flags.includes('FEVER')
  ) {
    risk = 'high'
  } else if (parsed.flags.includes('UNDERWEIGHT') || parsed.flags.includes('ANEMIA')) {
    risk = 'medium'
  }

  if (risk !== 'low') {
    db.prepare("UPDATE patients SET risk_level = ?, last_visit = datetime('now') WHERE id = ?")
      .run(risk, body.patient_id)
  } else {
    db.prepare("UPDATE patients SET last_visit = datetime('now') WHERE id = ?").run(body.patient_id)
  }

  return NextResponse.json({
    id: result.lastInsertRowid,
    success: true,
    parsedFlags: parsed.flags,
    parsedExplanations: parsed.explanations
  })
}
