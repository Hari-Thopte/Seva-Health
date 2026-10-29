'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import {
  IconCalendar,
  IconCheckCircle,
  IconCheck,
  IconMapPin,
  IconAlertTriangle,
  IconSpinner
} from '@/components/Icons'
import { toMarathiName, toMarathiVillage, toMarathiFollowupType, toMarathiDigits, formatMarathiDate } from '@/lib/marathi'
import { getOrCreateWorker } from '@/lib/authHelper'

export default function FollowupsPage() {
  const router = useRouter()
  const [worker, setWorker] = useState(null)
  const [followups, setFollowups] = useState([])
  const [completed, setCompleted] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('pending')

  useEffect(() => {
    const parsed = getOrCreateWorker('asha')
    setWorker(parsed)
    loadFollowups(parsed.id)
  }, [])

  const loadFollowups = async (workerId) => {
    try {
      const [pendingRes, completedRes] = await Promise.all([
        fetch(`/api/followups?worker_id=${workerId}&status=pending`),
        fetch(`/api/followups?worker_id=${workerId}&status=completed`),
      ])

      if (pendingRes.status === 401 || completedRes.status === 401) {
        localStorage.removeItem('seva_worker')
        router.push('/')
        return
      }

      const pendingData = await pendingRes.json()
      const completedData = await completedRes.json()
      setFollowups(Array.isArray(pendingData) ? pendingData : [])
      setCompleted(Array.isArray(completedData) ? completedData : [])
    } catch (e) {
      console.error(e)
      setFollowups([])
      setCompleted([])
    } finally {
      setLoading(false)
    }
  }

  const markComplete = async (id) => {
    await fetch('/api/followups', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    loadFollowups(worker?.id)
  }

  const [today, setToday] = useState('')

  useEffect(() => {
    setToday(new Date().toISOString().split('T')[0])
  }, [])

  const overdue = (Array.isArray(followups) && today) ? followups.filter(f => f.due_date < today) : []
  const todayDue = (Array.isArray(followups) && today) ? followups.filter(f => f.due_date === today) : []
  const upcoming = (Array.isArray(followups) && today) ? followups.filter(f => f.due_date > today) : []

  const formatDate = (d) => formatMarathiDate(d, { weekday: 'short', day: 'numeric', month: 'short' })

  const FollowupCard = ({ f, showComplete = true }) => {
    const isOverdue = f.due_date < today
    const isToday = f.due_date === today
    const type = isOverdue ? 'overdue' : isToday ? 'today' : 'upcoming'

    return (
      <div className={`followup-card ${type}`} style={{ position: 'relative' }} id={`followup-${f.id}`}>
        <div className="followup-icon">
          <span className={`status-dot ${isOverdue ? 'dot-red' : isToday ? 'dot-amber' : 'dot-green'}`} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{toMarathiName(f.patient_name)}</div>
            {f.risk_level === 'high' && <span className="badge badge-red">उच्च जोखीम</span>}
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
            <IconMapPin size={14} />
            <span>{toMarathiVillage(f.village)} · {toMarathiFollowupType(f.type)}</span>
          </div>
          {f.notes && (
            <div style={{ fontSize: 15, marginTop: 6, fontFamily: 'Noto Sans Devanagari, sans-serif', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {toMarathiDigits(f.notes)}
            </div>
          )}
          <div style={{ marginTop: 8, fontSize: 14, fontWeight: 700, color: isOverdue ? 'var(--accent-red)' : isToday ? 'var(--accent-amber)' : 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: 5 }}>
            {isOverdue && <IconAlertTriangle size={15} />}
            <span>{isOverdue ? 'उशिरा — ' : isToday ? 'आज — ' : ''}{formatDate(f.due_date)}</span>
          </div>
        </div>
        {showComplete && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => markComplete(f.id)}
              id={`complete-followup-${f.id}`}
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <IconCheck size={13} />
              <span>पूर्ण</span>
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => router.push(`/worker/patients/${f.patient_id}`)}
            >
              पहा
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Sidebar role="asha" />
      <div className="main-content">
        <div className="topbar">
          <div>
            <div className="page-title">फॉलो-अप</div>
            <div className="page-subtitle">भेट स्मरणपत्रिका — {toMarathiDigits(overdue.length)} उशिरा, {toMarathiDigits(todayDue.length)} आज</div>
          </div>
          <div className="topbar-actions">
            {overdue.length > 0 && (
              <div className="offline-banner" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconAlertTriangle size={15} />
                <span>{toMarathiDigits(overdue.length)} भेटी उशिरा आहेत! तातडीने संपर्क करा.</span>
              </div>
            )}
          </div>
        </div>

        <div className="page-content">
          {/* Quick Stats */}
          <div className="stats-grid mb-20">
            <div className="stat-card red">
              <div className="stat-icon" style={{ color: 'var(--accent-red)' }}>
                <span className="status-dot dot-red" style={{ width: 12, height: 12 }} />
              </div>
              <div className="stat-value">{toMarathiDigits(overdue.length)}</div>
              <div className="stat-label">उशिरा</div>
            </div>
            <div className="stat-card amber">
              <div className="stat-icon" style={{ color: 'var(--accent-amber)' }}>
                <span className="status-dot dot-amber" style={{ width: 12, height: 12 }} />
              </div>
              <div className="stat-value">{toMarathiDigits(todayDue.length)}</div>
              <div className="stat-label">आज</div>
            </div>
            <div className="stat-card green">
              <div className="stat-icon" style={{ color: 'var(--accent-green)' }}>
                <span className="status-dot dot-green" style={{ width: 12, height: 12 }} />
              </div>
              <div className="stat-value">{toMarathiDigits(upcoming.length)}</div>
              <div className="stat-label">येणारे</div>
            </div>
            <div className="stat-card blue">
              <div className="stat-icon" style={{ color: 'var(--accent-blue)' }}>
                <IconCheckCircle size={20} />
              </div>
              <div className="stat-value">{toMarathiDigits(completed.length)}</div>
              <div className="stat-label">पूर्ण</div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {[
              { key: 'pending', label: `प्रलंबित (${toMarathiDigits(followups.length)})` },
              { key: 'completed', label: `पूर्ण (${toMarathiDigits(completed.length)})` },
            ].map(t => (
              <button key={t.key} id={`tab-${t.key}`}
                className={`btn btn-sm ${tab === t.key ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setTab(t.key)}
              >{t.label}</button>
            ))}
          </div>

          {loading ? (
            <div className="empty-state">
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <IconSpinner size={32} />
              </div>
              <p>लोड होत आहे...</p>
            </div>
          ) : tab === 'pending' ? (
            <div>
              {overdue.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-red)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="status-dot dot-red" />
                    <span>उशीर झालेल्या भेटी</span>
                  </div>
                  {overdue.map(f => <FollowupCard key={f.id} f={f} />)}
                </div>
              )}
              {todayDue.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-amber)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="status-dot dot-amber" />
                    <span>आजच्या नियोजित भेटी</span>
                  </div>
                  {todayDue.map(f => <FollowupCard key={f.id} f={f} />)}
                </div>
              )}
              {upcoming.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-green)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="status-dot dot-green" />
                    <span>पुढील नियोजित भेटी</span>
                  </div>
                  {upcoming.map(f => <FollowupCard key={f.id} f={f} />)}
                </div>
              )}
              {followups.length === 0 && (
                <div className="empty-state">
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: 'var(--accent-green)' }}>
                    <IconCheckCircle size={36} />
                  </div>
                  <h3>सर्व फॉलो-अप पूर्ण!</h3>
                </div>
              )}
            </div>
          ) : (
            <div>
              {completed.length === 0 ? (
                <div className="empty-state">
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: 'var(--text-muted)' }}>
                    <IconCalendar size={36} />
                  </div>
                  <h3>अजून कोणतेही फॉलो-अप पूर्ण नाहीत</h3>
                </div>
              ) : (
                completed.map(f => <FollowupCard key={f.id} f={f} showComplete={false} />)
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
