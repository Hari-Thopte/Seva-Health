'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import {
  IconUsers,
  IconAlertTriangle,
  IconCalendar,
  IconClipboard,
  IconMic,
  IconCheckCircle,
  IconSpinner,
  IconPlus
} from '@/components/Icons'
import { toMarathiName, toMarathiVillage, toMarathiInitial, toMarathiDigits, formatMarathiDate } from '@/lib/marathi'
import { getLocalPatients, cachePatientsLocally, getLocalVisits, isDeviceOnline } from '@/lib/offlineStorage'
import { getOrCreateWorker } from '@/lib/authHelper'

export default function WorkerDashboard() {
  const router = useRouter()
  const [worker, setWorker] = useState(null)
  const [patients, setPatients] = useState([])
  const [followups, setFollowups] = useState([])
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)
  const [isOnline, setIsOnline] = useState(true)

  const [today, setToday] = useState('')
  const [dateStr, setDateStr] = useState('')

  useEffect(() => {
    setIsOnline(isDeviceOnline())
    const now = new Date()
    setToday(now.toISOString().split('T')[0])
    setDateStr(toMarathiDigits(now.toLocaleDateString('mr-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })))

    const parsed = getOrCreateWorker('asha')
    setWorker(parsed)

    // Preload local cached data
    const localPatients = getLocalPatients()
    if (localPatients.length > 0) {
      setPatients(localPatients)
    }
    const localVisits = getLocalVisits()
    if (localVisits.length > 0) {
      setVisits(localVisits)
    }

    fetchData(parsed.id)

    const connHandler = () => setIsOnline(isDeviceOnline())
    window.addEventListener('online', connHandler)
    window.addEventListener('offline', connHandler)
    return () => {
      window.removeEventListener('online', connHandler)
      window.removeEventListener('offline', connHandler)
    }
  }, [])

  const fetchData = async (workerId) => {
    if (!isDeviceOnline()) {
      setPatients(getLocalPatients())
      setVisits(getLocalVisits())
      setLoading(false)
      return
    }

    try {
      const [pRes, fRes, vRes] = await Promise.all([
        fetch(`/api/patients?worker_id=${workerId}`),
        fetch(`/api/followups?worker_id=${workerId}&status=pending`),
        fetch(`/api/visits?worker_id=${workerId}`),
      ])

      if (pRes.status === 401 || fRes.status === 401 || vRes.status === 401) {
        localStorage.removeItem('seva_worker')
        router.push('/')
        return
      }

      const pData = await pRes.json()
      const fData = await fRes.json()
      const vData = await vRes.json()

      if (Array.isArray(pData) && pData.length > 0) {
        setPatients(pData)
        cachePatientsLocally(pData)
      }
      if (Array.isArray(fData)) setFollowups(fData)
      if (Array.isArray(vData)) setVisits(vData)
    } catch (e) {
      console.warn('Network fetch error, loading from local cache:', e)
      setPatients(getLocalPatients())
      setVisits(getLocalVisits())
    } finally {
      setLoading(false)
    }
  }

  const highRisk = (Array.isArray(patients) ? patients : []).filter(p => p.risk_level === 'high')
  const overdue = today ? followups.filter(f => f.due_date < today) : []
  const todayDue = today ? followups.filter(f => f.due_date === today) : []
  const todayVisits = today ? visits.filter(v => v.visit_date?.startsWith(today)) : []

  const getRiskColor = (risk) => {
    if (risk === 'high') return 'red'
    if (risk === 'medium') return 'amber'
    return 'green'
  }

  const formatDate = (d) => formatMarathiDate(d, { day: 'numeric', month: 'short' })

  if (loading) return (
    <div className="app-shell">
      <Sidebar role="asha" />
      <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <IconSpinner size={36} />
          </div>
          <div>लोड होत आहे...</div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="app-shell">
      <Sidebar role="asha" />
      <div className="main-content">
        <div className="topbar">
          <div>
            <div className="page-title">नमस्कार, {toMarathiName(worker?.name)?.split(' ')[0] || 'सुनिता'} ताई</div>
            <div className="page-subtitle">{dateStr || 'आरोग्य सहाय्यक'}</div>
          </div>
          <div className="topbar-actions">
            {overdue.length > 0 && (
              <div className="offline-banner" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconAlertTriangle size={15} />
                <span>{toMarathiDigits(overdue.length)} फॉलो-अप उशिरा आहेत</span>
              </div>
            )}
            <div className="sync-badge" style={!isOnline ? { borderColor: 'rgba(239, 68, 68, 0.4)', color: '#f87171' } : {}}>
              <div className="sync-dot" style={!isOnline ? { background: '#f87171' } : {}} />
              {isOnline ? 'सर्व डेटा सिंक' : 'स्थानिक (ऑफलाइन)'}
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => router.push('/worker/new-visit')} id="quick-record-btn">
              <IconMic size={15} />
              <span>भेट नोंद करा</span>
            </button>
          </div>
        </div>

        <div className="page-content">
          {/* Stats */}
          <div className="stats-grid">
            <div className="stat-card green">
              <div className="stat-icon" style={{ color: 'var(--accent-green)' }}>
                <IconUsers size={20} />
              </div>
              <div className="stat-value">{toMarathiDigits(patients.length)}</div>
              <div className="stat-label">एकूण रुग्ण</div>
              <div className="stat-change">माझ्या यादीतील</div>
            </div>
            <div className="stat-card red">
              <div className="stat-icon" style={{ color: 'var(--accent-red)' }}>
                <IconAlertTriangle size={20} />
              </div>
              <div className="stat-value">{toMarathiDigits(highRisk.length)}</div>
              <div className="stat-label">उच्च जोखीम</div>
              <div className="stat-change" style={{ color: highRisk.length > 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                {highRisk.length > 0 ? 'तातडीने भेट द्या' : 'सध्या ठीक'}
              </div>
            </div>
            <div className="stat-card amber">
              <div className="stat-icon" style={{ color: 'var(--accent-amber)' }}>
                <IconCalendar size={20} />
              </div>
              <div className="stat-value">{toMarathiDigits(overdue.length + todayDue.length)}</div>
              <div className="stat-label">फॉलो-अप बाकी</div>
              <div className="stat-change" style={{ color: overdue.length > 0 ? 'var(--accent-red)' : 'var(--accent-amber)' }}>
                {overdue.length > 0 ? `${toMarathiDigits(overdue.length)} उशिरा` : `${toMarathiDigits(todayDue.length)} आज`}
              </div>
            </div>
            <div className="stat-card blue">
              <div className="stat-icon" style={{ color: 'var(--accent-blue)' }}>
                <IconClipboard size={20} />
              </div>
              <div className="stat-value">{toMarathiDigits(todayVisits.length)}</div>
              <div className="stat-label">आजच्या भेटी</div>
              <div className="stat-change">आज पूर्ण</div>
            </div>
          </div>

          <div className="grid-2">
            {/* High Risk Alerts */}
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: 'var(--accent-red)' }}><IconAlertTriangle size={17} /></span>
                    <span>उच्च जोखीम रुग्ण</span>
                  </div>
                  <div className="card-subtitle">तातडीने भेट द्या</div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => router.push('/worker/patients?filter=high')} id="view-high-risk-btn">सर्व पहा</button>
              </div>
              {highRisk.length === 0 ? (
                <div className="empty-state" style={{ padding: '30px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10, color: 'var(--accent-green)' }}>
                    <IconCheckCircle size={36} />
                  </div>
                  <p>सध्या कोणताही उच्च जोखीम रुग्ण नाही</p>
                </div>
              ) : (
                <div className="patient-list">
                  {highRisk.slice(0, 4).map(p => (
                    <div key={p.id} className="patient-row" onClick={() => router.push(`/worker/patients/${p.id}`)} id={`patient-card-${p.id}`}>
                      <div className="patient-avatar" style={{ background: 'var(--accent-red-dim)', color: 'var(--accent-red)', fontWeight: 700 }}>
                        {toMarathiInitial(p.name)}
                      </div>
                      <div className="patient-info">
                        <div className="patient-name">{toMarathiName(p.name)}</div>
                        <div className="patient-meta">{toMarathiVillage(p.village)} · {p.category === 'pregnant' ? `${toMarathiDigits(p.weeks_pregnant)} आठवडे` : 'बालक'}</div>
                      </div>
                      <div>
                        <span className="badge badge-red">उच्च जोखीम</span>
                        {p.next_followup && (
                          <div style={{ fontSize: 13, color: p.next_followup < today ? 'var(--accent-red)' : 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span className={`status-dot ${p.next_followup < today ? 'dot-red' : 'dot-green'}`} />
                            <span>{formatDate(p.next_followup)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Follow-ups */}
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: 'var(--accent-amber)' }}><IconCalendar size={17} /></span>
                    <span>आजचे फॉलो-अप</span>
                  </div>
                  <div className="card-subtitle">आज भेट द्यायच्या आहेत</div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => router.push('/worker/followups')} id="view-all-followups-btn">सर्व पहा</button>
              </div>
              {overdue.length === 0 && todayDue.length === 0 ? (
                <div className="empty-state" style={{ padding: '30px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10, color: 'var(--accent-green)' }}>
                    <IconCheckCircle size={36} />
                  </div>
                  <p>आजचे सर्व फॉलो-अप पूर्ण!</p>
                </div>
              ) : (
                <>
                  {overdue.slice(0, 2).map(f => (
                    <div key={f.id} className="followup-card overdue" id={`followup-overdue-${f.id}`}>
                      <div className="followup-icon" style={{ color: 'var(--accent-red)' }}>
                        <span className="status-dot dot-red" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>{toMarathiName(f.patient_name)}</div>
                        <div style={{ fontSize: 14, color: 'var(--accent-red)', marginTop: 3, fontWeight: 600 }}>उशिरा — {formatDate(f.due_date)}</div>
                        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 3 }}>{toMarathiDigits(f.notes)}</div>
                      </div>
                      <span className="badge badge-red">उशिरा</span>
                    </div>
                  ))}
                  {todayDue.slice(0, 3).map(f => (
                    <div key={f.id} className="followup-card today" id={`followup-today-${f.id}`}>
                      <div className="followup-icon" style={{ color: 'var(--accent-amber)' }}>
                        <span className="status-dot dot-amber" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>{toMarathiName(f.patient_name)}</div>
                        <div style={{ fontSize: 14, color: 'var(--accent-amber)', marginTop: 3, fontWeight: 600 }}>आज — {toMarathiVillage(f.village)}</div>
                        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 3 }}>{toMarathiDigits(f.notes)}</div>
                      </div>
                      <span className="badge badge-amber">आज</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Recent Visits */}
          <div className="card" style={{ marginTop: 20 }}>
            <div className="card-header">
              <div>
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: 'var(--accent-blue)' }}><IconClipboard size={17} /></span>
                  <span>अलीकडील भेटी</span>
                </div>
                <div className="card-subtitle">नुकत्याच झालेल्या आरोग्य तपासण्या</div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => router.push('/worker/new-visit')} id="record-new-visit-btn">
                <IconPlus size={14} />
                <span>नवीन भेट</span>
              </button>
            </div>
            {visits.length === 0 ? (
              <div className="empty-state">
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: 'var(--text-muted)' }}>
                  <IconClipboard size={36} />
                </div>
                <h3>अजून कोणतीही भेट नाही</h3>
                <p>पहिली भेट नोंद करण्यासाठी वर क्लिक करा</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>रुग्ण</th>
                      <th>गाव</th>
                      <th>जोखीम</th>
                      <th>नोट्स</th>
                      <th>तारीख</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visits.slice(0, 8).map(v => (
                      <tr key={v.id} onClick={() => router.push(`/worker/patients/${v.patient_id}`)} id={`visit-row-${v.id}`}>
                        <td>
                          <div style={{ fontWeight: 700, fontSize: 16 }}>{toMarathiName(v.patient_name)}</div>
                          {v.voice_transcript && (
                            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <IconMic size={13} />
                              <span>{v.voice_transcript.slice(0, 45)}…</span>
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: 15 }}>{toMarathiVillage(v.village)}</td>
                        <td><span className={`badge badge-${getRiskColor(v.risk_level)}`}>{v.risk_level === 'high' ? 'उच्च' : v.risk_level === 'medium' ? 'मध्यम' : 'सामान्य'}</span></td>
                        <td style={{ fontSize: 14, maxWidth: 220 }} className="truncate">{v.notes || v.flags || '-'}</td>
                        <td style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>{formatDate(v.visit_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
