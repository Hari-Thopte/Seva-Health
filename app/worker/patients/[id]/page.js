'use client'
import { useEffect, useState, Suspense, use } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import {
  IconUser,
  IconCalendar,
  IconClipboard,
  IconMic,
  IconAlertTriangle,
  IconAlertCircle,
  IconSpinner
} from '@/components/Icons'
import { toMarathiName, toMarathiVillage, toMarathiFollowupType, toMarathiDigits, formatMarathiDate } from '@/lib/marathi'
import { getOrCreateWorker } from '@/lib/authHelper'

export default function PatientDetailPage(props) {
  return (
    <Suspense fallback={
      <div className="app-shell">
        <Sidebar role="asha" />
        <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <IconSpinner size={36} />
            </div>
            <div>माहिती लोड होत आहे...</div>
          </div>
        </div>
      </div>
    }>
      <PatientDetailContent {...props} />
    </Suspense>
  )
}

function PatientDetailContent({ params }) {
  const router = useRouter()
  const resolvedParams = params && typeof params.then === 'function' ? use(params) : params
  const [patient, setPatient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [today, setToday] = useState('')

  useEffect(() => {
    setToday(new Date().toISOString().split('T')[0])
    const parsed = getOrCreateWorker('asha')

    const patientId = resolvedParams?.id
    if (patientId) {
      fetch(`/api/patients/${patientId}`)
        .then(async r => {
          if (r.status === 401) {
            localStorage.removeItem('seva_worker')
            router.push('/')
            return null
          }
          return r.json()
        })
        .then(data => {
          if (data && !data.error) {
            setPatient(data)
          } else if (data && data.error) {
            setPatient({ error: data.error })
          } else {
            setPatient(null)
          }
          setLoading(false)
        })
        .catch(() => setLoading(false))
    }
  }, [resolvedParams])

  const formatDate = (d) => formatMarathiDate(d, { day: 'numeric', month: 'long', year: 'numeric' })
  const formatTime = (d) => d ? toMarathiDigits(new Date(d).toLocaleTimeString('mr-IN', { hour: '2-digit', minute: '2-digit' })) : ''

  if (loading) return (
    <div className="app-shell">
      <Sidebar role="asha" />
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

  if (!patient || patient.error) return (
    <div className="app-shell">
      <Sidebar role="asha" />
      <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="empty-state">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: 'var(--accent-red)' }}>
            <IconAlertCircle size={36} />
          </div>
          <h3>{patient?.error || 'रुग्ण सापडला नाही'}</h3>
        </div>
      </div>
    </div>
  )

  const riskColor = patient.risk_level === 'high' ? 'red' : patient.risk_level === 'medium' ? 'amber' : 'green'
  const riskLabel = patient.risk_level === 'high' ? 'उच्च जोखीम' : patient.risk_level === 'medium' ? 'मध्यम जोखीम' : 'सामान्य'

  const pendingFollowups = (patient.followups || []).filter(f => f.status === 'pending')
  const overdueFollowups = pendingFollowups.filter(f => f.due_date < today)

  return (
    <div className="app-shell">
      <Sidebar role="asha" />
      <div className="main-content">
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => router.push('/worker/patients')} id="back-to-patients">मागे</button>
            <div>
              <div className="page-title">{toMarathiName(patient.name)}</div>
              <div className="page-subtitle">{toMarathiVillage(patient.village)} · वय {toMarathiDigits(patient.age)} वर्षे · {toMarathiDigits(patient.phone)}</div>
            </div>
          </div>
          <div className="topbar-actions">
            <span className={`badge badge-${riskColor}`} style={{ fontSize: 13, padding: '5px 14px' }}>
              {riskLabel}
            </span>
            <button className="btn btn-primary btn-sm" onClick={() => router.push(`/worker/new-visit`)} id="record-visit-for-patient">
              <IconMic size={14} />
              <span>भेट नोंद करा</span>
            </button>
          </div>
        </div>

        <div className="page-content">
          <div className="grid-2" style={{ alignItems: 'start' }}>
            {/* Patient Info */}
            <div>
              <div className="card mb-20">
                <div className="card-title mb-16" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IconUser size={18} />
                  <span>रुग्ण सविस्तर माहिती</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
                  {[
                    ['रुग्णाचे नाव', toMarathiName(patient.name)],
                    ['वय', `${toMarathiDigits(patient.age)} वर्षे`],
                    ['मोबाईल क्रमांक', toMarathiDigits(patient.phone) || 'नोंद नाही'],
                    ['गाव / वस्ती', toMarathiVillage(patient.village)],
                    ['रुग्ण वर्गवारी', patient.category === 'pregnant' ? 'गरोदर माता' : 'बालक'],
                    patient.weeks_pregnant && ['गर्भधारणा कालावधी', `${toMarathiDigits(patient.weeks_pregnant)} आठवडे`],
                    ['नियुक्त आशा सेविका', toMarathiName(patient.worker_name)],
                    ['नोंदणी तारीख', formatDate(patient.created_at)],
                  ].filter(Boolean).map(([label, value]) => (
                    <div key={label}>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>{value}</div>
                    </div>
                  ))}
                </div>

                {patient.notes && (
                  <div style={{ marginTop: 16, padding: '14px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 15, color: 'var(--text-secondary)', fontFamily: 'Noto Sans Devanagari, sans-serif', lineHeight: 1.8 }}>
                    {toMarathiDigits(patient.notes)}
                  </div>
                )}
              </div>

              {/* Follow-ups */}
              <div className="card">
                <div className="card-header">
                  <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <IconCalendar size={17} />
                    <span>नियोजित फॉलो-अप</span>
                  </div>
                  {overdueFollowups.length > 0 && (
                    <span className="badge badge-red" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span className="status-dot dot-red" />
                      <span>{toMarathiDigits(overdueFollowups.length)} उशिरा</span>
                    </span>
                  )}
                </div>
                {pendingFollowups.length === 0 ? (
                  <div className="empty-state" style={{ padding: '20px 0' }}>
                    <p>कोणताही प्रलंबित फॉलो-अप नाही</p>
                  </div>
                ) : (
                  pendingFollowups.map(f => (
                    <div key={f.id} className={`followup-card ${f.due_date < today ? 'overdue' : f.due_date === today ? 'today' : 'upcoming'}`} id={`patient-followup-${f.id}`}>
                      <div className="followup-icon">
                        <span className={`status-dot ${f.due_date < today ? 'dot-red' : f.due_date === today ? 'dot-amber' : 'dot-green'}`} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>{toMarathiFollowupType(f.type)}</div>
                        <div style={{ fontSize: 14, marginTop: 3, color: f.due_date < today ? 'var(--accent-red)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5, fontWeight: f.due_date < today ? 700 : 500 }}>
                          {f.due_date < today && <IconAlertTriangle size={14} />}
                          <span>{f.due_date < today ? 'उशिरा — ' : ''}{formatDate(f.due_date)}</span>
                        </div>
                        {f.notes && <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>{toMarathiDigits(f.notes)}</div>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Visit History */}
            <div className="card">
              <div className="card-title mb-16" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconClipboard size={18} />
                <span>तपासणी व भेट इतिहास</span>
              </div>
              {(!patient.visits || patient.visits.length === 0) ? (
                <div className="empty-state" style={{ padding: '40px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: 'var(--text-muted)' }}>
                    <IconClipboard size={36} />
                  </div>
                  <h3>अजून कोणतीही भेट नाही</h3>
                </div>
              ) : (
                <div className="timeline">
                  {patient.visits.map((v, i) => (
                    <div key={v.id} className="timeline-item" id={`visit-timeline-${v.id}`}>
                      <div className={`timeline-dot ${v.flags?.includes('HIGH') || v.flags?.includes('MALNUTRITION') ? 'red' : v.flags ? 'amber' : 'green'}`} />
                      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>भेट #{toMarathiDigits(patient.visits.length - i)}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDate(v.visit_date)} {formatTime(v.visit_date)}</div>
                        </div>

                        {v.voice_transcript && (
                          <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'Noto Sans Devanagari, sans-serif', lineHeight: 1.8, marginBottom: 8, padding: '8px 10px', background: 'var(--bg-card)', borderRadius: 6, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                            <span style={{ color: 'var(--accent-green)', marginTop: 3 }}><IconMic size={14} /></span>
                            <span>&quot;{toMarathiDigits(v.voice_transcript)}&quot;</span>
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                          {v.bp_systolic && (
                            <div style={{ fontSize: 12 }}>
                              <span style={{ color: 'var(--text-muted)' }}>रक्तदाब: </span>
                              <span style={{ color: v.bp_systolic >= 140 ? 'var(--accent-red)' : 'var(--accent-green)', fontWeight: 600 }}>
                                {toMarathiDigits(v.bp_systolic)}/{toMarathiDigits(v.bp_diastolic)} mmHg
                              </span>
                            </div>
                          )}
                          {v.weight && (
                            <div style={{ fontSize: 12 }}>
                              <span style={{ color: 'var(--text-muted)' }}>वजन: </span>
                              <span style={{ fontWeight: 600 }}>{toMarathiDigits(v.weight)} किलो</span>
                            </div>
                          )}
                        </div>

                        {v.flags && v.flags.split(',').filter(Boolean).map(flag => (
                          <span key={flag} className="badge badge-red" style={{ marginTop: 6, marginRight: 4 }}>
                            {flag.replace(/_/g, ' ')}
                          </span>
                        ))}

                        {v.notes && (
                          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>{toMarathiDigits(v.notes)}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
