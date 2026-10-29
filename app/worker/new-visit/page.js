'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import {
  IconMic,
  IconSquare,
  IconCheckCircle,
  IconCheck,
  IconTrash,
  IconAlertTriangle,
  IconFlag,
  IconClipboard,
  IconSpinner,
  IconHeart
} from '@/components/Icons'
import { toMarathiName, toMarathiVillage, toMarathiDigits } from '@/lib/marathi'
import { parseMarathiClinicalText } from '@/lib/clinicalParser'
import {
  getLocalPatients,
  cachePatientsLocally,
  saveVisitOfflineFirst,
  isDeviceOnline
} from '@/lib/offlineStorage'
import { getOrCreateWorker } from '@/lib/authHelper'

const FLAGS = [
  { key: 'HIGH_BP', label: 'उच्च रक्तदाब', color: 'red' },
  { key: 'UNDERWEIGHT', label: 'कमी वजन', color: 'amber' },
  { key: 'TEEN_PREGNANCY', label: 'अल्पवयीन गर्भधारणा', color: 'red' },
  { key: 'MALNUTRITION', label: 'कुपोषण', color: 'red' },
  { key: 'FEVER', label: 'ताप / थंडी वाजणे', color: 'amber' },
  { key: 'ANEMIA', label: 'रक्तक्षय (अॅनिमिया)', color: 'amber' },
]

const QUICK_PRESETS = [
  {
    title: 'उच्च रक्तदाब (तपासणी उदाहरण)',
    text: 'सविता ताईंची भेट घेतली. रक्तदाब १४०/९० आहे. विश्रांतीचा सल्ला दिला आणि PHC ला जाण्यास सांगितले.'
  },
  {
    title: 'कमी वजन (तपासणी उदाहरण)',
    text: 'अनिता ताईंची तपासणी केली. वजन ४२ किलो आहे. अतिरिक्त पूरक आहार आणि लोह गोळ्या दिल्या.'
  },
  {
    title: 'तीव्र ताप व थंडी (तपासणी उदाहरण)',
    text: 'रुग्णाला तीव्र ताप १०१ फॅरनहाइट आणि थंडी भरली आहे. तातडीने वैद्यकीय तपासणीचा सल्ला दिला.'
  },
  {
    title: 'सामान्य तपासणी (निरोगी उदाहरण)',
    text: 'नियमित प्रसूतीपूर्व तपासणी केली. रक्तदाब १२०/८०, वजन ५५ किलो, आई आणि बाळाचे आरोग्य सामान्य आहे.'
  }
]

export default function NewVisitPage() {
  const router = useRouter()
  const [worker, setWorker] = useState(null)
  const [patients, setPatients] = useState([])
  const [onlineStatus, setOnlineStatus] = useState(true)
  const [form, setForm] = useState({
    patient_id: '',
    bp_systolic: '',
    bp_diastolic: '',
    weight: '',
    notes: '',
    flags: [],
  })
  const [transcript, setTranscript] = useState('')
  const [recording, setRecording] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveDetails, setSaveDetails] = useState(null)
  const [saving, setSaving] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [cdssAudit, setCdssAudit] = useState([])
  const [offlineVoiceNotice, setOfflineVoiceNotice] = useState(false)
  const [audioUrl, setAudioUrl] = useState(null)

  const recognitionRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])

  useEffect(() => {
    setOnlineStatus(isDeviceOnline())
    const parsed = getOrCreateWorker('asha')
    setWorker(parsed)

    // Offline-first: Load local patients immediately
    const local = getLocalPatients()
    setPatients(local)

    // If online, refresh from server and cache
    if (isDeviceOnline()) {
      fetch(`/api/patients?worker_id=${parsed.id}`)
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            setPatients(data)
            cachePatientsLocally(data)
          }
        })
        .catch(err => {
          console.warn('Network fetch failed, using local cached patients:', err)
        })
    }

    const handleConn = () => setOnlineStatus(isDeviceOnline())
    window.addEventListener('online', handleConn)
    window.addEventListener('offline', handleConn)
    return () => {
      window.removeEventListener('online', handleConn)
      window.removeEventListener('offline', handleConn)
    }
  }, [])

  // Process Marathi Clinical Text using the Rule-Based CDSS & NLP Engine
  const runClinicalExtraction = (text) => {
    if (!text || !text.trim()) return

    const extracted = parseMarathiClinicalText(text)

    setForm(prev => {
      const nextFlags = [...prev.flags]
      // Merge detected flags
      extracted.flags.forEach(f => {
        if (!nextFlags.includes(f)) nextFlags.push(f)
      })

      return {
        ...prev,
        bp_systolic: extracted.bp_systolic !== null ? String(extracted.bp_systolic) : prev.bp_systolic,
        bp_diastolic: extracted.bp_diastolic !== null ? String(extracted.bp_diastolic) : prev.bp_diastolic,
        weight: extracted.weight !== null ? String(extracted.weight) : prev.weight,
        flags: nextFlags
      }
    })

    if (extracted.explanations && extracted.explanations.length > 0) {
      setCdssAudit(extracted.explanations)
    }
  }

  // Handle Preset Clicks
  const handleApplyPreset = (presetText) => {
    setTranscript(presetText)
    runClinicalExtraction(presetText)
  }

  // Start Voice & Device Microphone Recording
  const startRecording = async () => {
    setOfflineVoiceNotice(false)
    setAudioUrl(null)

    // 1. Start Audio Recorder (MediaRecorder works 100% offline on-device)
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const mediaRecorder = new MediaRecorder(stream)
        audioChunksRef.current = []

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data)
          }
        }

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
          const url = URL.createObjectURL(audioBlob)
          setAudioUrl(url)
          stream.getTracks().forEach(track => track.stop())
        }

        mediaRecorderRef.current = mediaRecorder
        mediaRecorder.start()
      }
    } catch (micErr) {
      console.warn('Microphone stream access error:', micErr)
    }

    // 2. Start Web Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setOfflineVoiceNotice(true)
      setRecording(true)
      return
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.lang = 'mr-IN'
      recognition.continuous = true
      recognition.interimResults = true

      recognition.onresult = (event) => {
        let interim = ''
        let final = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript + ' '
          } else {
            interim += event.results[i][0].transcript
          }
        }
        if (final) {
          setTranscript(prev => {
            const updated = prev + final
            runClinicalExtraction(updated)
            return updated
          })
        }
        setInterimText(interim)
      }

      recognition.onerror = (e) => {
        console.warn('Speech recognition warning:', e.error)
        // In Chrome, if offline, SpeechRecognition fails with 'network' error
        if (e.error === 'network' || !navigator.onLine) {
          setOfflineVoiceNotice(true)
        }
      }

      recognition.onend = () => {
        setRecording(false)
        setInterimText('')
      }

      recognitionRef.current = recognition
      recognition.start()
      setRecording(true)
    } catch (e) {
      console.error('Speech recognition start failed:', e)
      setOfflineVoiceNotice(true)
      setRecording(true)
    }
  }

  const stopRecording = () => {
    try {
      recognitionRef.current?.stop()
    } catch (e) {}

    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
    } catch (e) {}

    setRecording(false)
    setInterimText('')
    if (transcript) {
      runClinicalExtraction(transcript)
    }
  }

  const toggleFlag = (key) => {
    setForm(prev => ({
      ...prev,
      flags: prev.flags.includes(key) ? prev.flags.filter(f => f !== key) : [...prev.flags, key]
    }))
  }

  // Submit Visit with Offline-First Local Queue & Background Sync
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.patient_id) {
      alert('कृपया रुग्ण निवडा')
      return
    }
    setSaving(true)

    const payload = {
      patient_id: parseInt(form.patient_id),
      worker_id: worker?.id || 1,
      voice_transcript: transcript,
      bp_systolic: form.bp_systolic ? parseInt(form.bp_systolic) : null,
      bp_diastolic: form.bp_diastolic ? parseInt(form.bp_diastolic) : null,
      weight: form.weight ? parseFloat(form.weight) : null,
      notes: form.notes,
      flags: form.flags.join(','),
      visit_date: new Date().toISOString()
    }

    // Save offline first (saves to local queue, and if online, syncs with SQLite)
    const result = await saveVisitOfflineFirst(payload)
    setSaveDetails(result)
    setSaved(true)
    setSaving(false)

    setTimeout(() => router.push('/worker/dashboard'), 2400)
  }

  const selectedPatient = patients.find(p => p.id === parseInt(form.patient_id))

  return (
    <div className="app-shell">
      <Sidebar role="asha" />
      <div className="main-content">
        <div className="topbar">
          <div>
            <div className="page-title">रुग्ण भेट नोंदवा</div>
            <div className="page-subtitle">
              मराठी व्हॉइस इनपुट · क्लिनिकल CDSS निष्कर्षण · पूर्णतः ऑफलाइन कार्यक्षम
            </div>
          </div>
          <div className="topbar-actions">
            <span
              style={{
                fontSize: 12,
                padding: '4px 10px',
                borderRadius: 14,
                background: onlineStatus ? 'rgba(74, 222, 128, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: onlineStatus ? '#4ade80' : '#f87171',
                fontWeight: 600
              }}
            >
              {onlineStatus ? '● ऑनलाइन' : '○ ऑफलाइन मोड'}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => router.push('/worker/dashboard')} id="back-to-dashboard-btn">मागे</button>
          </div>
        </div>

        <div className="page-content">
          {saved ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16, color: 'var(--accent-green)' }}>
                <IconCheckCircle size={64} />
              </div>
              <h2 style={{ fontSize: 24, marginBottom: 8 }}>भेट यशस्वीरित्या नोंद केली!</h2>
              <p style={{ color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto', fontSize: 14 }}>
                {saveDetails?.offline
                  ? '✓ इंटरनेट बंद असल्याने भेट स्थानिक मेमरीमध्ये (Offline Queue) सुरक्षित जतन केली आहे. कनेक्शन आल्यावर ती सर्व्हरवर सिंक होईल.'
                  : '✓ भेट सर्व्हरवर सुरक्षित सेव्ह झाली आहे.'}
              </p>
              <div style={{ marginTop: 20 }}>
                <span className="badge badge-green">डॅशबोर्डवर नेत आहोत...</span>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="grid-2" style={{ alignItems: 'start' }}>
                {/* Left Column: Voice Recorder & CDSS Audit */}
                <div>
                  <div className="card mb-20">
                    <div className="card-title mb-12" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <IconMic size={18} />
                        <span>मराठी आवाज नोंदणी (व्हॉइस इनपुट)</span>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {onlineStatus ? 'Web Speech (mr-IN)' : 'स्थानिक ऑडिओ बफर'}
                      </span>
                    </div>

                    {/* Offline voice advisory notice */}
                    {offlineVoiceNotice && (
                      <div
                        style={{
                          marginBottom: 12,
                          padding: '10px 14px',
                          background: 'rgba(217, 107, 39, 0.12)',
                          border: '1px solid rgba(217, 107, 39, 0.3)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 12,
                          color: 'var(--text-primary)'
                        }}
                      >
                        <strong>ऑफलाइन व्हॉइस मोड:</strong> क्रोम ब्राउझरचे मराठी स्पीच मॉडेल ऑफलाइन असताना इंटरनेट मागत असल्यास, आपण डिव्हाइसचा मायक्रोफोन ऑडिओ रेकॉर्ड करू शकता किंवा खालील १-टॅप क्लिनिकल वाक्ये वापरू शकता.
                      </div>
                    )}

                    <div className={`voice-recorder ${recording ? 'recording' : ''}`}>
                      <button
                        type="button"
                        id="voice-record-btn"
                        className={`voice-btn ${recording ? 'voice-btn-recording' : 'voice-btn-idle'}`}
                        onClick={recording ? stopRecording : startRecording}
                        style={{ color: '#ffffff' }}
                        aria-label={recording ? 'रेकॉर्डिंग थांबवा' : 'रेकॉर्डिंग सुरू करा'}
                      >
                        {recording ? <IconSquare size={26} /> : <IconMic size={30} />}
                      </button>
                      <div className={`voice-status ${recording ? 'active' : ''}`}>
                        {recording ? 'रेकॉर्डिंग सुरू आहे... (मराठीत बोला)' : 'बोलण्यासाठी वर क्लिक करा'}
                      </div>
                      {recording && interimText && (
                        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--accent-red)' }}>
                          <em>{interimText}</em>
                        </div>
                      )}
                      <div className="transcript-box">
                        {transcript || interimText ? (
                          <span style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                            {transcript}
                            {interimText && <em style={{ color: 'var(--text-muted)' }}>{interimText}</em>}
                          </span>
                        ) : (
                          <span className="transcript-placeholder">
                            उदा. &quot;सविता ताईंची भेट घेतली. रक्तदाब १४०/९०, वजन ४२ किलो. विश्रांतीचा सल्ला दिला.&quot;
                          </span>
                        )}
                      </div>

                      {/* Offline Recorded Audio Playback */}
                      {audioUrl && (
                        <div style={{ marginTop: 10, width: '100%', textAlign: 'center' }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                            डिव्हाइसवर स्थानिक साठवलेला ऑडिओ (Offline Audio File):
                          </div>
                          <audio src={audioUrl} controls style={{ width: '100%', height: 32 }} />
                        </div>
                      )}

                      {transcript && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                          onClick={() => {
                            setTranscript('')
                            setCdssAudit([])
                            setAudioUrl(null)
                          }}
                          id="clear-transcript-btn"
                        >
                          <IconTrash size={14} />
                          <span>साफ करा</span>
                        </button>
                      )}
                    </div>

                    {/* 1-Tap Marathi Clinical Voice Presets */}
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>
                        त्वरित क्लिनिकल वाक्ये (१-टॅप टेस्ट व ऑफलाइन व्हॉइस प्रीडिक्टर):
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {QUICK_PRESETS.map((p, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{
                              justifyContent: 'flex-start',
                              textAlign: 'left',
                              fontSize: 13.5,
                              padding: '10px 14px',
                              lineHeight: 1.5
                            }}
                            onClick={() => handleApplyPreset(p.text)}
                          >
                            <div>
                              <strong style={{ color: 'var(--accent-orange)' }}>{p.title}: </strong>
                              <span>&ldquo;{p.text}&rdquo;</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* CDSS Clinical Audit Trail Panel */}
                  <div className="card mb-20">
                    <div className="card-title mb-10" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <IconHeart size={18} style={{ color: 'var(--accent-orange)' }} />
                      <span>क्लिनिकल निर्णय सहाय्यक प्रणाली (वैद्यकीय विश्लेषण)</span>
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>
                      NHM मार्गदर्शक तत्त्वानुसार मराठी मजकुरातून क्लिनिकल मूल्यमापन:
                    </div>

                    {cdssAudit.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {cdssAudit.map((audit, i) => (
                          <div
                            key={i}
                            style={{
                              padding: '10px 14px',
                              background: 'var(--accent-red-dim)',
                              border: '1px solid var(--accent-red)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: 14,
                              color: 'var(--accent-red)',
                              lineHeight: 1.6
                            }}
                          >
                            <strong>✓ {audit.label}: </strong>
                            <span>{audit.reason}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 14, color: 'var(--text-muted)', fontStyle: 'italic', padding: '10px 0' }}>
                        कोणतीही उच्च जोखीम किंवा असामान्य निकष अद्याप आढळले नाहीत.
                      </div>
                    )}
                  </div>

                  {/* Risk Flags Selection */}
                  <div className="card">
                    <div className="card-title mb-12" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <IconFlag size={18} />
                      <span>जोखीम लक्षणे (मॅन्युअल निवड शक्य)</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {FLAGS.map(flag => (
                        <button
                          key={flag.key}
                          type="button"
                          id={`flag-${flag.key}`}
                          className={`btn btn-sm ${form.flags.includes(flag.key) ? `btn-danger` : 'btn-secondary'}`}
                          onClick={() => toggleFlag(flag.key)}
                          style={form.flags.includes(flag.key) ? { background: 'var(--accent-red-dim)', borderColor: 'var(--accent-red)' } : {}}
                        >
                          {flag.label}
                        </button>
                      ))}
                    </div>
                    {form.flags.length > 0 && (
                      <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--accent-red-dim)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--accent-red)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <IconAlertTriangle size={16} />
                        <span>{toMarathiDigits(form.flags.length)} जोखीम नोंदवली — रुग्ण उच्च जोखीम म्हणून चिन्हांकित होईल</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Visit Form */}
                <div>
                  <div className="card">
                    <div className="card-title mb-20" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <IconClipboard size={18} />
                        <span>तपासणी तपशील (स्वयंचलित भरलेले)</span>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--accent-green)', fontWeight: 600 }}>
                        ✓ स्वयंचलित ओळख सक्षम
                      </span>
                    </div>

                    <div className="form-group">
                      <label>रुग्ण निवडा *</label>
                      <select
                        id="patient-select"
                        value={form.patient_id}
                        onChange={e => setForm(prev => ({ ...prev, patient_id: e.target.value }))}
                        required
                      >
                        <option value="">— रुग्ण निवडा —</option>
                        {patients.map(p => (
                          <option key={p.id} value={p.id}>
                            {toMarathiName(p.name)} — {toMarathiVillage(p.village)} {p.risk_level === 'high' ? '(उच्च जोखीम)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedPatient && (
                      <div style={{ padding: '12px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', marginBottom: 16, fontSize: 13 }}>
                        <div style={{ fontWeight: 600 }}>{toMarathiName(selectedPatient.name)}</div>
                        <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                          {selectedPatient.category === 'pregnant' ? `गरोदर — ${toMarathiDigits(selectedPatient.weeks_pregnant)} आठवडे` : 'बालक'} · {toMarathiVillage(selectedPatient.village)} ·
                          <span className={`badge badge-${selectedPatient.risk_level === 'high' ? 'red' : selectedPatient.risk_level === 'medium' ? 'amber' : 'green'}`} style={{ marginLeft: 6 }}>
                            {selectedPatient.risk_level === 'high' ? 'उच्च जोखीम' : selectedPatient.risk_level === 'medium' ? 'मध्यम' : 'सामान्य'}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="form-grid-2">
                      <div className="form-group">
                        <label>सिस्टोलिक रक्तदाब (mmHg)</label>
                        <input
                          type="number"
                          id="bp-systolic"
                          placeholder="उदा. १२०"
                          value={form.bp_systolic}
                          onChange={e => setForm(prev => ({ ...prev, bp_systolic: e.target.value }))}
                        />
                      </div>
                      <div className="form-group">
                        <label>डायस्टोलिक रक्तदाब (mmHg)</label>
                        <input
                          type="number"
                          id="bp-diastolic"
                          placeholder="उदा. ८०"
                          value={form.bp_diastolic}
                          onChange={e => setForm(prev => ({ ...prev, bp_diastolic: e.target.value }))}
                        />
                      </div>
                    </div>

                    {form.bp_systolic && parseInt(form.bp_systolic) >= 140 && (
                      <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--accent-red-dim)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--accent-red)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <IconAlertTriangle size={14} />
                        <span>क्लिनिकल इशारा: सिस्टोलिक रक्तदाब ≥ १४० mmHg आढळला! तातडीने PHC रेफरल द्या.</span>
                      </div>
                    )}

                    <div className="form-group">
                      <label>वजन (किलोग्रॅम)</label>
                      <input
                        type="number"
                        id="weight-input"
                        placeholder="उदा. ५५.५"
                        step="0.1"
                        value={form.weight}
                        onChange={e => setForm(prev => ({ ...prev, weight: e.target.value }))}
                      />
                    </div>

                    {form.weight && parseFloat(form.weight) < 45 && (
                      <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(217, 107, 39, 0.15)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--accent-orange)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <IconAlertTriangle size={14} />
                        <span>क्लिनिकल इशारा: वजन ४५ किलोपेक्षा कमी असल्याने अतिरिक्त पूरक पोषणाचा सल्ला द्या.</span>
                      </div>
                    )}

                    <div className="form-group">
                      <label>आरोग्य नोंदी व डॉक्टरी सल्ला</label>
                      <textarea
                        id="visit-notes"
                        placeholder="भेटीचे तपशील, दिलेली औषधे किंवा पुढील सूचना..."
                        rows={3}
                        value={form.notes}
                        onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ flex: 1, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6 }}
                        disabled={saving}
                        id="save-visit-btn"
                      >
                        {saving ? (
                          <>
                            <IconSpinner size={16} />
                            <span>सेव्ह होत आहे...</span>
                          </>
                        ) : (
                          <>
                            <IconCheck size={16} />
                            <span>{onlineStatus ? 'भेट सेव्ह करा' : 'ऑफलाइन सेव्ह करा (स्थानिक मेमरी)'}</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => router.push('/worker/dashboard')}
                        id="cancel-visit-btn"
                      >
                        रद्द करा
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
