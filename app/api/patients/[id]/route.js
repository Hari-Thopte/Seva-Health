/**
 * /api/patients/[id]
 *
 * Security fixes:
 *  ✅ GET: ownership check — ASHAs can only read their own patients
 *  ✅ PATCH: allow-list of editable columns — no SQL injection via field names
 *  ✅ PATCH: worker_id cannot be changed via the API
 *  ✅ PATCH: ownership check before update
 */
import { getDb } from '@/lib/db'
import { NextResponse } from 'next/server'

// Exhaustive allow-list of columns a worker may update on a patient record.
// worker_id is intentionally excluded — cannot be reassigned via the API.
const PATCHABLE_FIELDS = new Set([
  'name', 'age', 'phone', 'village', 'category',
  'weeks_pregnant', 'children_count', 'risk_level',
  'last_visit', 'next_followup', 'notes'
])

export async function GET(request, { params }) {
  const db = getDb()
  const { id } = await params

  const sessionWorkerId = request.headers.get('x-worker-id')
  const sessionRole = request.headers.get('x-worker-role')

  const patient = db.prepare(`
    SELECT p.*, w.name as worker_name, w.phone as worker_phone
    FROM patients p
    LEFT JOIN workers w ON p.worker_id = w.id
    WHERE p.id = ?
  `).get(id)

  if (!patient) {
    return NextResponse.json({ error: 'रुग्ण आढळला नाही.' }, { status: 404 })
  }

  // ASHAs may only view their own patients
  if (sessionRole !== 'supervisor' && String(patient.worker_id) !== sessionWorkerId) {
    return NextResponse.json({ error: 'अनधिकृत प्रवेश.' }, { status: 403 })
  }

  const visits = db.prepare(`
    SELECT v.*, w.name as worker_name
    FROM visits v
    LEFT JOIN workers w ON v.worker_id = w.id
    WHERE v.patient_id = ?
    ORDER BY v.visit_date DESC
  `).all(id)

  const followups = db.prepare(`
    SELECT * FROM followups WHERE patient_id = ? ORDER BY due_date ASC
  `).all(id)

  return NextResponse.json({ ...patient, visits, followups })
}

export async function PATCH(request, { params }) {
  const db = getDb()
  const { id } = await params

  const sessionWorkerId = request.headers.get('x-worker-id')
  const sessionRole = request.headers.get('x-worker-role')

  // Verify patient exists
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(id)
  if (!patient) {
    return NextResponse.json({ error: 'रुग्ण आढळला नाही.' }, { status: 404 })
  }

  // Ownership check — ASHAs may only edit their own patients
  if (sessionRole !== 'supervisor' && String(patient.worker_id) !== sessionWorkerId) {
    return NextResponse.json({ error: 'अनधिकृत प्रवेश.' }, { status: 403 })
  }

  const body = await request.json()

  // Filter to only allow-listed columns — prevents SQL injection via key names
  // and prevents worker_id reassignment
  const allowed = Object.keys(body).filter(k => PATCHABLE_FIELDS.has(k))

  if (allowed.length === 0) {
    return NextResponse.json({ error: 'कोणतेही वैध फील्ड सापडले नाही.' }, { status: 400 })
  }

  const setClauses = allowed.map(k => `${k} = ?`).join(', ')
  const values = allowed.map(k => body[k])

  db.prepare(`UPDATE patients SET ${setClauses} WHERE id = ?`).run(...values, id)

  return NextResponse.json({ success: true })
}

export async function DELETE(request, { params }) {
  const db = getDb()
  const { id } = await params

  const sessionWorkerId = request.headers.get('x-worker-id')
  const sessionRole = request.headers.get('x-worker-role')

  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(id)
  if (!patient) {
    return NextResponse.json({ error: 'रुग्ण आढळला नाही.' }, { status: 404 })
  }

  // Only supervisors or the owning ASHA may delete (DPDP §13 data erasure)
  if (sessionRole !== 'supervisor' && String(patient.worker_id) !== sessionWorkerId) {
    return NextResponse.json({ error: 'अनधिकृत प्रवेश.' }, { status: 403 })
  }

  db.prepare('DELETE FROM patients WHERE id = ?').run(id)
  return NextResponse.json({ success: true })
}
