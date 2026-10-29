/**
 * /api/reports
 *
 * Security: restricted to supervisors only.
 * ASHAs have no legitimate reason to see aggregate reports across all workers.
 */
import { getDb } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const sessionRole = request.headers.get('x-worker-role')
  if (sessionRole !== 'supervisor') {
    return NextResponse.json(
      { error: 'फक्त पर्यवेक्षकांना हे पाहण्याचा अधिकार आहे.' },
      { status: 403 }
    )
  }

  const db = getDb()

  const totalPatients = db.prepare('SELECT COUNT(*) as c FROM patients').get().c
  const highRisk = db.prepare("SELECT COUNT(*) as c FROM patients WHERE risk_level = 'high'").get().c
  const mediumRisk = db.prepare("SELECT COUNT(*) as c FROM patients WHERE risk_level = 'medium'").get().c
  const lowRisk = db.prepare("SELECT COUNT(*) as c FROM patients WHERE risk_level = 'low'").get().c

  const today = new Date().toISOString().split('T')[0]
  const overdueFollowups = db.prepare(`
    SELECT COUNT(*) as c FROM followups WHERE status='pending' AND date(due_date) < date('now')
  `).get().c
  const todayFollowups = db.prepare(`
    SELECT COUNT(*) as c FROM followups WHERE status='pending' AND date(due_date) = date('now')
  `).get().c
  const totalVisits = db.prepare('SELECT COUNT(*) as c FROM visits').get().c
  const totalWorkers = db.prepare("SELECT COUNT(*) as c FROM workers WHERE role='asha'").get().c

  const workerStats = db.prepare(`
    SELECT w.name, w.village, w.block,
      COUNT(DISTINCT p.id) as patient_count,
      COUNT(DISTINCT v.id) as visit_count,
      SUM(CASE WHEN p.risk_level='high' THEN 1 ELSE 0 END) as high_risk_count
    FROM workers w
    LEFT JOIN patients p ON p.worker_id = w.id
    LEFT JOIN visits v ON v.worker_id = w.id
    WHERE w.role = 'asha'
    GROUP BY w.id
  `).all()

  const recentVisits = db.prepare(`
    SELECT v.*, p.name as patient_name, p.risk_level, w.name as worker_name
    FROM visits v
    LEFT JOIN patients p ON v.patient_id = p.id
    LEFT JOIN workers w ON v.worker_id = w.id
    ORDER BY v.created_at DESC LIMIT 10
  `).all()

  const categoryBreakdown = db.prepare(`
    SELECT category, COUNT(*) as count FROM patients GROUP BY category
  `).all()

  const villageStats = db.prepare(`
    SELECT village, COUNT(*) as total,
      SUM(CASE WHEN risk_level='high' THEN 1 ELSE 0 END) as high_risk
    FROM patients GROUP BY village ORDER BY total DESC
  `).all()

  return NextResponse.json({
    summary: { totalPatients, highRisk, mediumRisk, lowRisk, overdueFollowups, todayFollowups, totalVisits, totalWorkers },
    workerStats,
    recentVisits,
    categoryBreakdown,
    villageStats,
  })
}
