'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import {
  IconUsers,
  IconAlertTriangle,
  IconSpinner
} from '@/components/Icons'
import { toMarathiName, toMarathiVillage, toMarathiInitial, toMarathiDigits } from '@/lib/marathi'
import { getOrCreateWorker } from '@/lib/authHelper'

export default function WorkersPage() {
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

  const workers = data?.workerStats || []

  return (
    <div className="app-shell">
      <Sidebar role="supervisor" />
      <div className="main-content">
        <div className="topbar">
          <div>
            <div className="page-title">आशा सेविका व अंगणवाडी कार्यकर्ती</div>
            <div className="page-subtitle">सर्व कार्यकर्त्यांची माहिती — {toMarathiDigits(workers.length)} सक्रिय</div>
          </div>
          <div className="topbar-actions">
          </div>
        </div>

        <div className="page-content">
          <div className="grid-auto">
            {workers.map((w, i) => {
              const perf = Math.min(Math.round((w.visit_count / Math.max(w.patient_count, 1)) * 100), 100)
              return (
                <div key={i} className="card" id={`worker-card-${i}`} style={{ cursor: 'default' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div className="user-avatar" style={{ width: 48, height: 48, fontSize: 18, fontWeight: 700 }}>
                      {toMarathiInitial(w.name)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{toMarathiName(w.name)}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{toMarathiVillage(w.village)} · {toMarathiVillage(w.block)}</div>
                      <span className="badge badge-green" style={{ marginTop: 4 }}>आशा सेविका</span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div style={{ textAlign: 'center', padding: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent-blue)' }}>{toMarathiDigits(w.patient_count)}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>रुग्ण</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent-green)' }}>{toMarathiDigits(w.visit_count)}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>भेटी</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent-red)' }}>{toMarathiDigits(w.high_risk_count)}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>उच्च जोखीम</div>
                    </div>
                  </div>

                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>तपासणी भेट पूर्णता</span>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{toMarathiDigits(perf)}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${perf}%` }} />
                    </div>
                  </div>

                  {w.high_risk_count > 0 && (
                    <div style={{ marginTop: 8, padding: '6px 10px', background: 'var(--accent-red-dim)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--accent-red)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <IconAlertTriangle size={13} />
                      <span>{toMarathiDigits(w.high_risk_count)} उच्च जोखीम रुग्ण — तातडीने लक्ष आवश्यक</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
