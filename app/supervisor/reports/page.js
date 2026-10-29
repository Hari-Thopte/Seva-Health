'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import {
  IconTrendingUp,
  IconDownload,
  IconPrinter,
  IconUsers,
  IconAlertTriangle,
  IconClipboard,
  IconCalendar,
  IconBuilding,
  IconCheckCircle,
  IconHeart,
  IconSpinner
} from '@/components/Icons'
import { toMarathiName, toMarathiVillage, toMarathiInitial, toMarathiDigits } from '@/lib/marathi'
import { getOrCreateWorker } from '@/lib/authHelper'

export default function ReportsPage() {
  const router = useRouter()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const parsed = getOrCreateWorker('supervisor')
    fetch('/api/reports')
      .then(async r => {
        if (r.status === 401) {
          localStorage.removeItem('seva_worker')
          router.push('/')
          return null
        }
        return r.json()
      })
      .then(d => { if (d && !d.error) setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const exportCSV = () => {
    if (!data) return
    const rows = [
      ['नाव', 'गाव', 'ब्लॉक', 'रुग्ण', 'भेटी', 'उच्च जोखीम'],
      ...data.workerStats.map(w => [w.name, w.village, w.block, w.patient_count, w.visit_count, w.high_risk_count])
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'seva_report.csv'; a.click()
  }

  if (loading) return (
    <div className="app-shell">
      <Sidebar role="supervisor" />
      <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <IconSpinner size={36} />
          </div>
          <div>लोड होत आहे...</div>
        </div>
      </div>
    </div>
  )

  const s = data?.summary || { totalPatients: 0, highRisk: 0, mediumRisk: 0, totalVisits: 0, overdueFollowups: 0 }

  return (
    <div className="app-shell">
      <Sidebar role="supervisor" />
      <div className="main-content">
        <div className="topbar">
          <div>
            <div className="page-title">अहवाल</div>
            <div className="page-subtitle">जुन्नर ब्लॉक — आरोग्य माहिती</div>
          </div>
          <div className="topbar-actions">
            <button className="btn btn-secondary btn-sm" onClick={exportCSV} id="export-csv-btn">
              <IconDownload size={14} />
              <span>CSV डाउनलोड</span>
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => window.print()} id="print-report-btn">
              <IconPrinter size={14} />
              <span>छापा</span>
            </button>
          </div>
        </div>

        <div className="page-content">
          {/* Summary Cards */}
          <div className="stats-grid mb-20">
            <div className="stat-card green">
              <div className="stat-icon" style={{ color: 'var(--accent-green)' }}><IconUsers size={20} /></div>
              <div className="stat-value">{toMarathiDigits(s.totalPatients)}</div>
              <div className="stat-label">एकूण रुग्ण</div>
            </div>
            <div className="stat-card red">
              <div className="stat-icon" style={{ color: 'var(--accent-red)' }}><IconAlertTriangle size={20} /></div>
              <div className="stat-value">{toMarathiDigits(s.highRisk)}</div>
              <div className="stat-label">उच्च जोखीम</div>
            </div>
            <div className="stat-card amber">
              <div className="stat-icon" style={{ color: 'var(--accent-amber)' }}>
                <span className="status-dot dot-amber" style={{ width: 12, height: 12 }} />
              </div>
              <div className="stat-value">{toMarathiDigits(s.mediumRisk)}</div>
              <div className="stat-label">मध्यम जोखीम</div>
            </div>
            <div className="stat-card blue">
              <div className="stat-icon" style={{ color: 'var(--accent-blue)' }}><IconClipboard size={20} /></div>
              <div className="stat-value">{toMarathiDigits(s.totalVisits)}</div>
              <div className="stat-label">एकूण भेटी</div>
            </div>
            <div className="stat-card purple">
              <div className="stat-icon" style={{ color: 'var(--accent-purple)' }}><IconCalendar size={20} /></div>
              <div className="stat-value">{toMarathiDigits(s.overdueFollowups)}</div>
              <div className="stat-label">उशिरा फॉलो-अप</div>
            </div>
          </div>

          <div className="grid-2">
            {/* Category Breakdown */}
            <div className="card">
              <div className="card-title mb-16" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconHeart size={18} />
                <span>रुग्ण वर्गवारी विभागणी</span>
              </div>
              {(data?.categoryBreakdown || []).map(c => (
                <div key={c.category} style={{ marginBottom: 14 }} id={`category-${c.category}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>
                      {c.category === 'pregnant' ? 'गरोदर माता' : 'बालक'}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{toMarathiDigits(c.count)}</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${(c.count / Math.max(s.totalPatients, 1)) * 100}%` }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                    एकूण पैकी {toMarathiDigits(Math.round((c.count / Math.max(s.totalPatients, 1)) * 100))}%
                  </div>
                </div>
              ))}
            </div>

            {/* Village-wise high risk */}
            <div className="card">
              <div className="card-title mb-16" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconBuilding size={18} />
                <span>गावनिहाय उच्च जोखीम रुग्ण प्रमाण</span>
              </div>
              {(data?.villageStats || []).filter(v => v.high_risk > 0).map((v, i) => (
                <div key={i} style={{ marginBottom: 14 }} id={`village-report-${i}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{toMarathiVillage(v.village)}</span>
                    <span style={{ fontSize: 12 }}>
                      <span style={{ color: 'var(--accent-red)', fontWeight: 700 }}>{toMarathiDigits(v.high_risk)}</span>
                      <span style={{ color: 'var(--text-muted)' }}> / {toMarathiDigits(v.total)}</span>
                    </span>
                  </div>
                  <div className="risk-bar">
                    <div className="risk-bar-fill" style={{
                      width: `${(v.high_risk / v.total) * 100}%`,
                      background: 'var(--accent-red)'
                    }} />
                  </div>
                </div>
              ))}
              {(data?.villageStats || []).filter(v => v.high_risk > 0).length === 0 && (
                <div className="empty-state" style={{ padding: '20px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8, color: 'var(--accent-green)' }}>
                    <IconCheckCircle size={24} />
                  </div>
                  <p>कोणत्याही गावात उच्च जोखीम नाही</p>
                </div>
              )}
            </div>
          </div>

          {/* Full Worker Table */}
          <div className="card" style={{ marginTop: 20 }}>
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconUsers size={18} />
                <span>आशा सेविका मासिक कामगिरी सारांश</span>
              </div>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>आशा सेविका</th>
                    <th>गाव</th>
                    <th>ब्लॉक</th>
                    <th>रुग्ण</th>
                    <th>भेटी</th>
                    <th>उच्च जोखीम</th>
                    <th>पूर्णता %</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.workerStats || []).map((w, i) => {
                    const coverage = Math.min(Math.round((w.visit_count / Math.max(w.patient_count, 1)) * 100), 100)
                    return (
                      <tr key={i} id={`report-worker-${i}`}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="user-avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
                              {toMarathiInitial(w.name)}
                            </div>
                            <span style={{ fontWeight: 600 }}>{toMarathiName(w.name)}</span>
                          </div>
                        </td>
                        <td>{toMarathiVillage(w.village)}</td>
                        <td>{toMarathiVillage(w.block)}</td>
                        <td>{toMarathiDigits(w.patient_count)}</td>
                        <td>{toMarathiDigits(w.visit_count)}</td>
                        <td>
                          {w.high_risk_count > 0 ? (
                            <span className="badge badge-red" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <IconAlertTriangle size={11} />
                              <span>{toMarathiDigits(w.high_risk_count)}</span>
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>०</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="progress-bar" style={{ width: 60 }}>
                              <div className="progress-fill" style={{ width: `${coverage}%` }} />
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 600 }}>{toMarathiDigits(coverage)}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
