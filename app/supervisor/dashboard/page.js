'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import {
  IconBarChart,
  IconTrendingUp,
  IconUsers,
  IconAlertTriangle,
  IconClipboard,
  IconBuilding,
  IconSpinner
} from '@/components/Icons'
import { toMarathiName, toMarathiVillage, toMarathiInitial, toMarathiDigits, formatMarathiDate } from '@/lib/marathi'
import { getOrCreateWorker } from '@/lib/authHelper'

export default function SupervisorDashboard() {
  const router = useRouter()
  const [worker, setWorker] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [monthYear, setMonthYear] = useState('')

  useEffect(() => {
    setMonthYear(toMarathiDigits(new Date().toLocaleDateString('mr-IN', { month: 'long', year: 'numeric' })))
    const parsed = getOrCreateWorker('supervisor')
    setWorker(parsed)
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

  const formatDate = (d) => d ? formatMarathiDate(d, { day: 'numeric', month: 'short' }) : '-'

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

  const s = data?.summary || { totalPatients: 0, highRisk: 0, mediumRisk: 0, lowRisk: 0, overdueFollowups: 0, totalVisits: 0, totalWorkers: 0 }

  return (
    <div className="app-shell">
      <Sidebar role="supervisor" />
      <div className="main-content">
        <div className="topbar">
          <div>
            <div className="page-title">नमस्कार, {toMarathiName(worker?.name) || 'पर्यवेक्षक'}</div>
            <div className="page-subtitle">पर्यवेक्षक डॅशबोर्ड · जुन्नर ब्लॉक — {monthYear || 'आरोग्य अहवाल'}</div>
          </div>
          <div className="topbar-actions">
            <div className="sync-badge">
              <div className="sync-dot" />
              थेट माहिती
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => router.push('/supervisor/reports')} id="view-reports-btn">
              <IconTrendingUp size={14} />
              <span>अहवाल पहा</span>
            </button>
          </div>
        </div>

        <div className="page-content">
          {/* Key Stats */}
          <div className="stats-grid">
            <div className="stat-card green">
              <div className="stat-icon" style={{ color: 'var(--accent-green)' }}><IconUsers size={20} /></div>
              <div className="stat-value">{toMarathiDigits(s.totalPatients)}</div>
              <div className="stat-label">एकूण रुग्ण</div>
              <div className="stat-change">ब्लॉकमधील सर्व</div>
            </div>
            <div className="stat-card red">
              <div className="stat-icon" style={{ color: 'var(--accent-red)' }}><IconAlertTriangle size={20} /></div>
              <div className="stat-value">{toMarathiDigits(s.highRisk)}</div>
              <div className="stat-label">उच्च जोखीम</div>
              <div className="stat-change" style={{ color: 'var(--accent-red)' }}>तातडीने लक्ष द्या</div>
            </div>
            <div className="stat-card amber">
              <div className="stat-icon" style={{ color: 'var(--accent-amber)' }}>
                <span className="status-dot dot-amber" style={{ width: 12, height: 12 }} />
              </div>
              <div className="stat-value">{toMarathiDigits(s.overdueFollowups)}</div>
              <div className="stat-label">उशिरा फॉलो-अप</div>
              <div className="stat-change" style={{ color: 'var(--accent-red)' }}>{s.overdueFollowups > 0 ? 'कार्यवाही आवश्यक' : 'सर्व अद्ययावत'}</div>
            </div>
            <div className="stat-card blue">
              <div className="stat-icon" style={{ color: 'var(--accent-blue)' }}><IconClipboard size={20} /></div>
              <div className="stat-value">{toMarathiDigits(s.totalVisits)}</div>
              <div className="stat-label">एकूण भेटी</div>
              <div className="stat-change">सर्व आशा सेविका</div>
            </div>
            <div className="stat-card purple">
              <div className="stat-icon" style={{ color: 'var(--accent-purple)' }}><IconUsers size={20} /></div>
              <div className="stat-value">{toMarathiDigits(s.totalWorkers)}</div>
              <div className="stat-label">आशा सेविका</div>
              <div className="stat-change">सक्रिय</div>
            </div>
          </div>

          <div className="grid-2">
            {/* Worker Performance */}
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">आशा सेविका कामगिरी</div>
                  <div className="card-subtitle">प्रत्येक आशा सेविकेची कामगिरी</div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => router.push('/supervisor/workers')} id="view-all-workers-btn">सर्व पहा</button>
              </div>
              {(data?.workerStats || []).map((w, i) => (
                <div key={i} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }} id={`worker-stat-${i}`}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="user-avatar" style={{ width: 32, height: 32, fontSize: 13, fontWeight: 700 }}>
                        {toMarathiInitial(w.name)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>{toMarathiName(w.name)}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{toMarathiVillage(w.village)} · {toMarathiVillage(w.block)}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 15.5, fontWeight: 700 }}>{toMarathiDigits(w.patient_count)} रुग्ण</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{toMarathiDigits(w.visit_count)} भेटी</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {w.high_risk_count > 0 && (
                      <span className="badge badge-red" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <IconAlertTriangle size={11} />
                        <span>{toMarathiDigits(w.high_risk_count)} उच्च</span>
                      </span>
                    )}
                    <div style={{ flex: 1 }}>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${Math.min((w.visit_count / (w.patient_count || 1)) * 100, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Right col */}
            <div>
              {/* Village Stats */}
              <div className="card mb-20">
                <div className="card-title mb-16" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IconBuilding size={18} />
                  <span>गावनिहाय आकडेवारी</span>
                </div>
                {(data?.villageStats || []).map((v, i) => (
                  <div key={i} style={{ marginBottom: 12 }} id={`village-stat-${i}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 15, fontWeight: 600 }}>{toMarathiVillage(v.village)}</span>
                      <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                        {toMarathiDigits(v.total)} रुग्ण
                        {v.high_risk > 0 && <span style={{ color: 'var(--accent-red)', marginLeft: 8, fontWeight: 700 }}>{toMarathiDigits(v.high_risk)} उच्च</span>}
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${(v.total / Math.max(s.totalPatients, 1)) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Risk Chart */}
              <div className="card">
                <div className="card-title mb-4" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IconBarChart size={18} />
                  <span>रुग्ण जोखीम प्रमाण</span>
                </div>
                <div className="card-subtitle mb-16">सर्व नोंदणीकृत रुग्णांचे जोखीम वर्गीकरण</div>
                <div style={{ display: 'flex', gap: 20 }}>
                  {[
                    { label: 'उच्च जोखीम', value: s.highRisk, color: 'var(--accent-red)', dot: 'dot-red' },
                    { label: 'मध्यम जोखीम', value: s.mediumRisk, color: 'var(--accent-amber)', dot: 'dot-amber' },
                    { label: 'सामान्य', value: s.lowRisk, color: 'var(--accent-green)', dot: 'dot-green' },
                  ].map(item => (
                    <div key={item.label} style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
                        <span className={`status-dot ${item.dot}`} style={{ width: 10, height: 10 }} />
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: item.color }}>{item.value}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 16, height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex', gap: 2 }}>
                  <div style={{ height: '100%', width: `${(s.highRisk / Math.max(s.totalPatients, 1)) * 100}%`, background: 'var(--accent-red)' }} />
                  <div style={{ height: '100%', width: `${(s.mediumRisk / Math.max(s.totalPatients, 1)) * 100}%`, background: 'var(--accent-amber)' }} />
                  <div style={{ height: '100%', flex: 1, background: 'var(--accent-green)', opacity: 0.7 }} />
                </div>
              </div>
            </div>
          </div>

          {/* Recent Visits */}
          <div className="card" style={{ marginTop: 20 }}>
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconClipboard size={18} />
                <span>सर्व आशा सेविकांच्या अलीकडील भेटी</span>
              </div>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>रुग्णाचे नाव</th>
                    <th>आशा सेविका</th>
                    <th>जोखीम</th>
                    <th>नोट्स</th>
                    <th>तारीख</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.recentVisits || []).map(v => (
                    <tr key={v.id} id={`supervisor-visit-${v.id}`}>
                      <td style={{ fontWeight: 600 }}>{toMarathiName(v.patient_name)}</td>
                      <td>{toMarathiName(v.worker_name)}</td>
                      <td>
                        <span className={`badge badge-${v.risk_level === 'high' ? 'red' : v.risk_level === 'medium' ? 'amber' : 'green'}`}>
                          {v.risk_level === 'high' ? 'उच्च' : v.risk_level === 'medium' ? 'मध्यम' : 'सामान्य'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, maxWidth: 200 }} className="truncate">{v.notes || v.flags || '-'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(v.visit_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
