'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import {
  IconUsers,
  IconSearch,
  IconPlus,
  IconAlertTriangle,
  IconHeart,
  IconCalendar,
  IconCheck,
  IconX,
  IconSpinner
} from '@/components/Icons'
import { toMarathiName, toMarathiVillage, toMarathiInitial, toMarathiDigits, formatMarathiDate } from '@/lib/marathi'
import { getLocalPatients, cachePatientsLocally, isDeviceOnline } from '@/lib/offlineStorage'
import { getOrCreateWorker } from '@/lib/authHelper'
import { Suspense } from 'react'

function PatientsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState(searchParams.get('filter') || 'all')
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [worker, setWorker] = useState(null)
  const [newPatient, setNewPatient] = useState({
    name: '', age: '', phone: '', village: '', category: 'pregnant', weeks_pregnant: '', risk_level: 'low', notes: ''
  })

  useEffect(() => {
    const parsed = getOrCreateWorker('asha')
    setWorker(parsed)

    // Offline-first: Load local patients first
    const cached = getLocalPatients()
    if (cached && cached.length > 0) {
      setPatients(cached)
      setLoading(false)
    }

    fetchPatients(parsed.id)
  }, [])

  const fetchPatients = async (workerId) => {
    if (!isDeviceOnline()) {
      setPatients(getLocalPatients())
      setLoading(false)
      return
    }

    try {
      const res = await fetch(`/api/patients?worker_id=${workerId}`)
      if (res.status === 401) {
        localStorage.removeItem('seva_worker')
        router.push('/')
        return
      }
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          setPatients(data)
          cachePatientsLocally(data)
        }
      }
    } catch (e) {
      console.warn('Network fetch failed, using local offline patients:', e)
      setPatients(getLocalPatients())
    } finally {
      setLoading(false)
    }
  }

  const filtered = (Array.isArray(patients) ? patients : []).filter(p => {
    const matchFilter = filter === 'all' || p.risk_level === filter
    const matchSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.village?.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  const getRiskBadge = (risk) => {
    if (risk === 'high') {
      return (
        <span className="badge badge-red" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <IconAlertTriangle size={12} />
          <span>उच्च जोखीम</span>
        </span>
      )
    }
    if (risk === 'medium') return <span className="badge badge-amber">मध्यम जोखीम</span>
    return <span className="badge badge-green">सामान्य</span>
  }

  const formatDate = (d) => d ? formatMarathiDate(d, { day: 'numeric', month: 'short' }) : 'नाही'

  const handleAddPatient = async (e) => {
    e.preventDefault()
    const payload = { ...newPatient, worker_id: worker.id, age: parseInt(newPatient.age), weeks_pregnant: newPatient.weeks_pregnant ? parseInt(newPatient.weeks_pregnant) : null }
    await fetch('/api/patients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    setShowAdd(false)
    setNewPatient({ name: '', age: '', phone: '', village: '', category: 'pregnant', weeks_pregnant: '', risk_level: 'low', notes: '' })
    fetchPatients(worker.id)
  }

  return (
    <div className="app-shell">
      <Sidebar role="asha" />
      <div className="main-content">
        <div className="topbar">
          <div>
            <div className="page-title">माझे रुग्ण</div>
            <div className="page-subtitle">रुग्ण नोंदणी — {toMarathiDigits(patients.length)} एकूण</div>
          </div>
          <div className="topbar-actions">
            <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)} id="add-patient-btn">
              <IconPlus size={14} />
              <span>नवीन रुग्ण</span>
            </button>
          </div>
        </div>

        <div className="page-content">
          {/* Filters */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', maxWidth: 280, flex: 1 }}>
              <input
                type="text"
                id="patient-search"
                placeholder="नाव किंवा गाव शोधा..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 34 }}
              />
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                <IconSearch size={15} />
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { key: 'all', label: 'सर्व' },
                { key: 'high', label: 'उच्च जोखीम' },
                { key: 'medium', label: 'मध्यम' },
                { key: 'low', label: 'सामान्य' },
              ].map(f => (
                <button
                  key={f.key}
                  id={`filter-${f.key}`}
                  className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Stats Row */}
          <div className="stats-grid" style={{ marginBottom: 20 }}>
            <div className="stat-card green">
              <div className="stat-icon" style={{ color: 'var(--accent-green)' }}><IconUsers size={20} /></div>
              <div className="stat-value">{toMarathiDigits(patients.length)}</div>
              <div className="stat-label">एकूण रुग्ण</div>
            </div>
            <div className="stat-card red">
              <div className="stat-icon" style={{ color: 'var(--accent-red)' }}><IconAlertTriangle size={20} /></div>
              <div className="stat-value">{toMarathiDigits(patients.filter(p => p.risk_level === 'high').length)}</div>
              <div className="stat-label">उच्च जोखीम</div>
            </div>
            <div className="stat-card amber">
              <div className="stat-icon" style={{ color: 'var(--accent-amber)' }}>
                <span className="status-dot dot-amber" style={{ width: 12, height: 12 }} />
              </div>
              <div className="stat-value">{toMarathiDigits(patients.filter(p => p.risk_level === 'medium').length)}</div>
              <div className="stat-label">मध्यम जोखीम</div>
            </div>
            <div className="stat-card blue">
              <div className="stat-icon" style={{ color: 'var(--accent-blue)' }}><IconHeart size={20} /></div>
              <div className="stat-value">{toMarathiDigits(patients.filter(p => p.category === 'pregnant').length)}</div>
              <div className="stat-label">गरोदर माता</div>
            </div>
          </div>

          {loading ? (
            <div className="empty-state">
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <IconSpinner size={32} />
              </div>
              <p>लोड होत आहे...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: 'var(--text-muted)' }}>
                <IconSearch size={36} />
              </div>
              <h3>कोणताही रुग्ण सापडला नाही</h3>
            </div>
          ) : (
            <div className="card">
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>रुग्ण</th>
                      <th>गाव</th>
                      <th>प्रकार</th>
                      <th>जोखीम</th>
                      <th>शेवटची भेट</th>
                      <th>फॉलो-अप</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(p => (
                      <tr key={p.id} onClick={() => router.push(`/worker/patients/${p.id}`)} id={`patient-row-${p.id}`}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="patient-avatar" style={{
                              width: 38, height: 38, fontSize: 15, fontWeight: 700,
                              background: p.risk_level === 'high' ? 'var(--accent-red-dim)' : p.risk_level === 'medium' ? 'var(--accent-amber-dim)' : 'var(--accent-green-dim)',
                              color: p.risk_level === 'high' ? 'var(--accent-red)' : p.risk_level === 'medium' ? 'var(--accent-amber)' : 'var(--accent-green)'
                            }}>{toMarathiInitial(p.name)}</div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 16 }}>{toMarathiName(p.name)}</div>
                              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>वय {toMarathiDigits(p.age)} वर्षे · {toMarathiDigits(p.phone)}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ fontSize: 15 }}>{toMarathiVillage(p.village)}</td>
                        <td>
                          <span className="badge badge-blue">
                            {p.category === 'pregnant' ? `गरोदर (${toMarathiDigits(p.weeks_pregnant)} आठवडे)` : 'बालक'}
                          </span>
                        </td>
                        <td>{getRiskBadge(p.risk_level)}</td>
                        <td style={{ fontSize: 14, color: 'var(--text-muted)' }}>{formatDate(p.last_visit)}</td>
                        <td style={{ fontSize: 14 }}>
                          {p.next_followup ? (
                            <span style={{
                              color: p.next_followup < new Date().toISOString().split('T')[0] ? 'var(--accent-red)' : 'var(--text-secondary)',
                              display: 'inline-flex', alignItems: 'center', gap: 4
                            }}>
                              <span className={`status-dot ${p.next_followup < new Date().toISOString().split('T')[0] ? 'dot-red' : 'dot-green'}`} />
                              <span>{formatDate(p.next_followup)}</span>
                            </span>
                          ) : '-'}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>›</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Patient Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} id="add-patient-modal">
            <div className="modal-header">
              <div className="modal-title">नवीन रुग्ण नोंदणी</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)} aria-label="खिडकी बंद करा">
                <IconX size={18} />
              </button>
            </div>
            <form onSubmit={handleAddPatient}>
              <div className="form-grid-2">
                <div className="form-group">
                  <label>रुग्णाचे नाव *</label>
                  <input id="new-patient-name" required placeholder="उदा. सुनिता शिंदे" value={newPatient.name} onChange={e => setNewPatient(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>वय (वर्षे) *</label>
                  <input id="new-patient-age" type="number" required placeholder="उदा. २५" value={newPatient.age} onChange={e => setNewPatient(p => ({ ...p, age: e.target.value }))} />
                </div>
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label>मोबाईल क्रमांक</label>
                  <input id="new-patient-phone" type="tel" placeholder="९८७६५४३२१०" value={newPatient.phone} onChange={e => setNewPatient(p => ({ ...p, phone: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>गाव / वस्ती *</label>
                  <input id="new-patient-village" required placeholder="गावाचे नाव" value={newPatient.village} onChange={e => setNewPatient(p => ({ ...p, village: e.target.value }))} />
                </div>
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label>रुग्ण वर्गवारी</label>
                  <select id="new-patient-category" value={newPatient.category} onChange={e => setNewPatient(p => ({ ...p, category: e.target.value }))}>
                    <option value="pregnant">गरोदर माता</option>
                    <option value="child">बालक</option>
                  </select>
                </div>
                {newPatient.category === 'pregnant' && (
                  <div className="form-group">
                    <label>गर्भावस्था आठवडे</label>
                    <input id="new-patient-weeks" type="number" placeholder="उदा. १२" value={newPatient.weeks_pregnant} onChange={e => setNewPatient(p => ({ ...p, weeks_pregnant: e.target.value }))} />
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>जोखीम पातळी</label>
                <select id="new-patient-risk" value={newPatient.risk_level} onChange={e => setNewPatient(p => ({ ...p, risk_level: e.target.value }))}>
                  <option value="low">सामान्य</option>
                  <option value="medium">मध्यम</option>
                  <option value="high">उच्च जोखीम</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} id="save-new-patient-btn">
                  <IconCheck size={16} />
                  <span>नोंदणी पूर्ण करा</span>
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>रद्द करा</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PatientsPage() {
  return <Suspense><PatientsContent /></Suspense>
}
