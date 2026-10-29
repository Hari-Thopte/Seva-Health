'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import IndianFlag, { IndianFlagEmblem } from '@/components/IndianFlag'
import {
  IconUsers,
  IconBarChart,
  IconAlertTriangle,
  IconSpinner,
  IconPhone,
  IconMail,
  IconShieldCheck,
  IconSend,
  IconCheckCircle,
  IconHeart,
  IconClipboard,
  IconCalendar,
  IconBuilding,
  IconSearch,
  IconX
} from '@/components/Icons'
import { toMarathiDigits } from '@/lib/marathi'

export default function GovernmentDepartmentPage() {
  const router = useRouter()
  const videoRef = useRef(null)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [role, setRole] = useState('asha')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [step, setStep] = useState('input') // 'input' | 'otp'
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [simulatedOtpNotice, setSimulatedOtpNotice] = useState(null)
  const [resendTimer, setResendTimer] = useState(0)

  // Ensure background video autoplays smoothly
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = true
      videoRef.current.defaultMuted = true
      videoRef.current.play().catch(() => {})
    }
    const tryPlay = () => {
      if (videoRef.current && videoRef.current.paused) {
        videoRef.current.muted = true
        videoRef.current.play().catch(() => {})
      }
    }
    window.addEventListener('click', tryPlay, { once: true })
    window.addEventListener('touchstart', tryPlay, { once: true })
    return () => {
      window.removeEventListener('click', tryPlay)
      window.removeEventListener('touchstart', tryPlay)
    }
  }, [])

  // Countdown for OTP resend
  useEffect(() => {
    let interval = null
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer(t => t - 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [resendTimer])

  // When switching role, preserve entered phone or clear errors
  const handleRoleChange = (newRole) => {
    setRole(newRole)
    setError('')
    setStep('input')
    setSimulatedOtpNotice(null)
  }

  // Request OTP
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault()
    const targetContact = phone.trim()
    const targetName = name.trim()

    if (!targetName) {
      setError('कृपया आपले पूर्ण नाव प्रविष्ट करा')
      return
    }

    if (!targetContact) {
      setError('कृपया मोबाईल क्रमांक प्रविष्ट करा')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          contact: targetContact,
          name: targetName,
          role
        })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'OTP पाठवण्यात अडचण आली. कृपया पुन्हा प्रयत्न करा.')
        setLoading(false)
        return
      }

      setSimulatedOtpNotice({
        destination: data.target,
        type: 'मोबाईल SMS',
        message: data.message,
        devOtp: data.devOtp,
        gatewayNotice: data.gatewayNotice,
        gatewayCode: data.gatewayCode
      })
      setStep('otp')
      setResendTimer(30)
      if (data.devOtp) {
        setOtp(data.devOtp)
      } else {
        setOtp('')
      }
    } catch {
      setError('सर्व्हरशी संपर्क होऊ शकला नाही. कृपया पुन्हा प्रयत्न करा.')
    } finally {
      setLoading(false)
    }
  }

  // Verify OTP and Login
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault()
    if (!otp.trim()) {
      setError('कृपया आलेला ६-अंकी OTP प्रविष्ट करा')
      return
    }

    setLoading(true)
    setError('')

    const targetContact = phone.trim()

    try {
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify',
          contact: targetContact,
          name: name.trim(),
          otp: otp.trim(),
          role
        })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'चुकीचा OTP! कृपया पुन्हा अचूक OTP प्रविष्ट करा.')
        setLoading(false)
        return
      }

      // Save worker session
      localStorage.setItem('seva_worker', JSON.stringify(data.worker))

      // Route to appropriate dashboard
      if (data.worker.role === 'supervisor') {
        router.push('/supervisor/dashboard')
      } else {
        router.push('/worker/dashboard')
      }
    } catch {
      setError('प्रवेश करताना त्रुटी आली. कृपया पुन्हा प्रयत्न करा.')
      setLoading(false)
    }
  }

  // Quick One-click Demo Login
  const quickLogin = async (workerName, workerRole) => {
    setLoading(true)
    setError('')
    try {
      const contact = workerRole === 'supervisor'
        ? 'desai.supervisor@seva.gov.in'
        : 'sunita.pawar@seva.gov.in'

      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'demo_login', contact, role: workerRole })
      })

      const data = await res.json()
      if (res.ok && data.worker) {
        localStorage.setItem('seva_worker', JSON.stringify(data.worker))
        if (workerRole === 'supervisor') {
          window.location.href = '/supervisor/dashboard'
        } else {
          window.location.href = '/worker/dashboard'
        }
      } else {
        setRole(workerRole)
        setStep('input')
      }
    } catch {
      setError('प्रवेश करताना त्रुटी आली. कृपया पुन्हा प्रयत्न करा.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="gov-portal-wrapper">
      {/* 1. TOP UTILITY BAR */}
      <div className="gov-topbar">
        <div className="gov-container">
          <div className="gov-topbar-inner">
            <div className="gov-topbar-left">
              <span>आरोग्य भवन, फोर्ट, मुंबई · सार्वजनिक आरोग्य विभाग, महाराष्ट्र शासन</span>
              <span style={{ opacity: 0.3 }}>|</span>
              <span style={{ color: '#e5a968', fontWeight: 600 }}>needhelp@arogya.maharashtra.gov.in</span>
            </div>
            <div className="gov-topbar-right">
              <span>राष्ट्रीय आरोग्य अभियान (NHM)</span>
              <span style={{ opacity: 0.3 }}>|</span>
              <span>आपत्कालीन: <strong style={{ color: '#f6ad55' }}>१०८</strong></span>
              <span style={{ opacity: 0.3 }}>|</span>
              <span>हेल्पलाइन: <strong style={{ color: '#f6ad55' }}>१०४</strong></span>
              <span style={{ opacity: 0.3 }}>|</span>
              <span style={{ color: '#ffffff', fontWeight: 600 }}>मराठी</span>
              <button className="gov-topbar-btn" onClick={() => setShowLoginModal(true)}>
                पोर्टल लॉगिन
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. MAIN NAVBAR */}
      <nav className="gov-navbar">
        <div className="gov-container">
          <div className="gov-navbar-inner">
            <a href="#home" className="gov-brand">
              <IndianFlag width={36} height={24} style={{ borderRadius: 3, boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }} />
              <div>
                <div className="gov-brand-title">सेवा <span style={{ color: '#d96b27', fontSize: 24 }}>आरोग्य</span></div>
                <div className="gov-brand-sub">महाराष्ट्र शासन · राष्ट्रीय आरोग्य अभियान (NHM)</div>
              </div>
            </a>

            <ul className="gov-nav-links">
              <li><a href="#home" style={{ color: '#d96b27' }}>मुख्यपृष्ठ</a></li>
              <li><a href="#pillars">आरोग्य उद्दिष्टे</a></li>
              <li><a href="#services">डिजिटल सेवा</a></li>
              <li><a href="#maternal">क्लिनिकल CDSS</a></li>
              <li><a href="#contact">संपर्क व मदत</a></li>
            </ul>

            <div className="gov-navbar-actions">
              <button
                className="gov-cta-btn"
                onClick={() => setShowLoginModal(true)}
                id="portal-login-nav-btn"
              >
                <span>पोर्टल लॉगिन</span>
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', fontSize: 11, textAlign: 'left', marginLeft: 6 }}>
                <span style={{ color: '#64748b' }}>टोल-फ्री मदत:</span>
                <strong style={{ color: '#0b2920', fontSize: 13 }}>१८००-२३३-४५६७</strong>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* 3. HERO SECTION */}
      <section className="gov-hero" id="home">
        <video
          ref={videoRef}
          className="gov-hero-video"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
        >
          <source src="/media/seva-landing.mp4" type="video/mp4" />
        </video>
        <div className="gov-container" style={{ position: 'relative', zIndex: 5, maxWidth: 960 }}>
          <div className="gov-hero-kicker">महाराष्ट्र शासन · राष्ट्रीय आरोग्य अभियान</div>
          <h1 className="gov-hero-title">
            सेवा आरोग्य
          </h1>
          <div className="gov-hero-subtitle-tag" style={{ letterSpacing: '2px', lineHeight: 1.6 }}>
            आशा स्वयंसेविका व अंगणवाडी कार्यकर्त्यांचे आधुनिक डिजिटल सहाय्यक व्यासपीठ
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginTop: 24 }}>
            <span style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.3)', padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
              ✓ १००% ऑफलाइन PWA कार्यक्षम
            </span>
            <span style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.3)', padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
              ✓ मराठी व्हॉइस CDSS निर्णय प्रणाली
            </span>
            <span style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.3)', padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
              ✓ माता व बाल आरोग्य जलद नोंदणी
            </span>
          </div>

          {/* Hero Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap', marginTop: 32 }}>
            <button
              className="gov-cta-btn"
              style={{ fontSize: 15, padding: '14px 34px', borderRadius: 8, background: '#ccff00', color: '#101700', fontWeight: 800, boxShadow: '0 8px 24px rgba(204, 255, 0, 0.35)' }}
              onClick={() => setShowLoginModal(true)}
              id="hero-portal-login-btn"
            >
              <span>आरोग्य पोर्टल प्रवेश</span>
              <span>→</span>
            </button>
            <a
              href="#pillars"
              className="gov-cta-btn"
              style={{ fontSize: 15, padding: '14px 28px', borderRadius: 8, background: 'rgba(255,255,255,0.15)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.4)', backdropFilter: 'blur(10px)', textDecoration: 'none' }}
            >
              <span>माहिती व उद्दिष्टे पहा ↓</span>
            </a>
          </div>
        </div>
      </section>

      {/* 4. OVERLAPPING 3 FEATURED CARDS */}
      <section className="gov-cards-container" id="maternal">
        <div className="gov-cards-grid">
          {/* Card 1: Maternal Health -> Scroll to pillars */}
          <a
            href="#pillars"
            className="gov-card-featured"
            style={{ backgroundImage: `url('/images/card-maternal.jpg')`, textDecoration: 'none', display: 'block' }}
          >
            <div className="gov-card-overlay" />
            <div className="gov-card-badge">
              <IconHeart size={30} />
            </div>
            <div className="gov-card-content">
              <div className="gov-card-title">माता आरोग्य व प्रसूतीपूर्व काळजी</div>
              <div className="gov-card-desc">ANC नियमित तपासणी · जननी सुरक्षा · सविस्तर माहिती पहा ↓</div>
            </div>
          </a>

          {/* Card 2: Civic & NHM Healthcare -> Scroll to services */}
          <a
            href="#services"
            className="gov-card-featured"
            style={{ backgroundImage: `url('/images/card-civic.jpg')`, textDecoration: 'none', display: 'block' }}
          >
            <div className="gov-card-overlay" />
            <div className="gov-card-badge">
              <IndianFlagEmblem size={32} />
            </div>
            <div className="gov-card-content">
              <div className="gov-card-title">राष्ट्रीय ग्रामीण आरोग्य अभियान</div>
              <div className="gov-card-desc">NHM उपकेंद्र, प्राथमिक आरोग्य केंद्र (PHC) · डिजिटल सेवा पहा ↓</div>
            </div>
          </a>

          {/* Card 3: Child Health & Voice Assistant -> Scroll to contact / services */}
          <a
            href="#services"
            className="gov-card-featured"
            style={{ backgroundImage: `url('/images/card-child.jpg')`, textDecoration: 'none', display: 'block' }}
          >
            <div className="gov-card-overlay" />
            <div className="gov-card-badge">
              <IconUsers size={30} />
            </div>
            <div className="gov-card-content">
              <div className="gov-card-title">बाल व पोषण आरोग्य सेवा</div>
              <div className="gov-card-desc">बाल आरोग्य · MUAC कुपोषण तपासणी · मराठी व्हॉइस माहिती ↓</div>
            </div>
          </a>
        </div>
      </section>

      {/* 5. DEEP FOREST GREEN SECTION */}
      <section className="gov-deep-section" id="pillars">
        <div className="gov-container">
          <div className="gov-section-header">
            <span className="gov-kicker">• आमचे ध्येय •</span>
            <h2 className="gov-deep-title">
              एकत्रित आपण<br />
              निरोगी महाराष्ट्र घडवू
            </h2>
            <p className="gov-deep-subtitle">
              दुर्गम खेड्यांपासून ते प्राथमिक आरोग्य केंद्रापर्यंत — आशा सेविकांच्या सक्षमीकरणातून प्रत्येक माता आणि बालकापर्यंत आधुनिक आरोग्य सेवा पोहोचवणे.
            </p>
          </div>

          <div className="gov-pillars-grid">
            {/* Pillar 01 */}
            <div className="gov-pillar-card">
              <div>
                <div className="gov-pillar-header">
                  <div className="gov-pillar-icon">
                    <IconBuilding size={24} />
                  </div>
                  <div className="gov-pillar-num">०१</div>
                </div>
                <div className="gov-pillar-title">मातृ व प्रसूती आरोग्य</div>
                <div className="gov-pillar-desc">
                  जननी सुरक्षा योजना, ANC नियमित तपासणी, रक्तदाब व गरोदर माता काळजी व्यवस्थापन.
                </div>
              </div>
              <button className="gov-pillar-link" onClick={() => setShowLoginModal(true)}>
                <span>सविस्तर माहिती</span>
                <span>→</span>
              </button>
            </div>

            {/* Pillar 02 */}
            <div className="gov-pillar-card">
              <div>
                <div className="gov-pillar-header">
                  <div className="gov-pillar-icon">
                    <IconHeart size={24} />
                  </div>
                  <div className="gov-pillar-num">०२</div>
                </div>
                <div className="gov-pillar-title">बाल आरोग्य व पोषण</div>
                <div className="gov-pillar-desc">
                  बाल लसीकरण वेळापत्रक, कुपोषण निवारण, अचूक MUAC मोजमाप व फॉलो-अप देखरेख.
                </div>
              </div>
              <button className="gov-pillar-link" onClick={() => setShowLoginModal(true)}>
                <span>सविस्तर माहिती</span>
                <span>→</span>
              </button>
            </div>

            {/* Pillar 03 */}
            <div className="gov-pillar-card">
              <div>
                <div className="gov-pillar-header">
                  <div className="gov-pillar-icon">
                    <IconClipboard size={24} />
                  </div>
                  <div className="gov-pillar-num">०३</div>
                </div>
                <div className="gov-pillar-title">मराठी व्हॉइस व CDSS</div>
                <div className="gov-pillar-desc">
                  स्थानिक मराठी भाषेतील ऑडिओ नोंदणी व स्वयंचलित क्लिनिकल जोखीम ओळख (High BP, Underweight, ताप).
                </div>
              </div>
              <button className="gov-pillar-link" onClick={() => setShowLoginModal(true)}>
                <span>सविस्तर माहिती</span>
                <span>→</span>
              </button>
            </div>

            {/* Pillar 04 */}
            <div className="gov-pillar-card">
              <div>
                <div className="gov-pillar-header">
                  <div className="gov-pillar-icon">
                    <IconBarChart size={24} />
                  </div>
                  <div className="gov-pillar-num">०४</div>
                </div>
                <div className="gov-pillar-title">१००% ऑफलाइन कार्यक्षमता</div>
                <div className="gov-pillar-desc">
                  इंटरनेट नसतानाही अखंड नोंदणी, स्थानिक सुरक्षा रांग व स्वयंचलित बॅकग्राउंड डेटा सिंक.
                </div>
              </div>
              <button className="gov-pillar-link" onClick={() => setShowLoginModal(true)}>
                <span>सविस्तर माहिती</span>
                <span>→</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 6. WHITE SECTION */}
      <section className="gov-services-section" id="services">
        <div className="gov-container">
          <div className="gov-services-header-row">
            <div>
              <span className="gov-kicker" style={{ color: '#d96b27' }}>◇ NHM आरोग्य डिजिटल सेवा ◇</span>
              <h2 className="gov-services-title">
                डिजिटल आरोग्य सेवा · सर्वांसाठी सहज सुलभ
              </h2>
            </div>
            <button className="gov-cta-btn" onClick={() => setShowLoginModal(true)}>
              <span>पोर्टल प्रवेश करा</span>
              <span>→</span>
            </button>
          </div>

          <div className="gov-services-grid">
            {/* Service 1 */}
            <div className="gov-service-box" onClick={() => setShowLoginModal(true)}>
              <div className="gov-service-ring">
                <IconHeart size={22} />
              </div>
              <div className="gov-service-name">माता आरोग्य</div>
              <div className="gov-service-sub">प्रसूतीपूर्व काळजी व ANC तपासणी</div>
            </div>

            {/* Service 2 */}
            <div className="gov-service-box" onClick={() => setShowLoginModal(true)}>
              <div className="gov-service-ring">
                <IconUsers size={22} />
              </div>
              <div className="gov-service-name">बाल आरोग्य</div>
              <div className="gov-service-sub">लसीकरण व MUAC तपासणी</div>
            </div>

            {/* Service 3 */}
            <div className="gov-service-box" onClick={() => setShowLoginModal(true)}>
              <div className="gov-service-ring">
                <IconClipboard size={22} />
              </div>
              <div className="gov-service-name">रुग्ण नोंदणी</div>
              <div className="gov-service-sub">मराठी व्हॉइस व डिजिटल नोंद</div>
            </div>

            {/* Service 4 */}
            <div className="gov-service-box" onClick={() => setShowLoginModal(true)}>
              <div className="gov-service-ring">
                <IconCalendar size={22} />
              </div>
              <div className="gov-service-name">फॉलो-अप व्यवस्थापन</div>
              <div className="gov-service-sub">नियमित भेट व देखरेख</div>
            </div>

            {/* Service 5 */}
            <div className="gov-service-box" onClick={() => setShowLoginModal(true)}>
              <div className="gov-service-ring">
                <IconBarChart size={22} />
              </div>
              <div className="gov-service-name">प्रगती अहवाल</div>
              <div className="gov-service-sub">मासिक व ब्लॉक स्तरावरील अहवाल</div>
            </div>

            {/* Service 6 */}
            <div className="gov-service-box" onClick={() => setShowLoginModal(true)}>
              <div className="gov-service-ring">
                <IconPhone size={22} />
              </div>
              <div className="gov-service-name">आपत्कालीन सेवा</div>
              <div className="gov-service-sub">१०८ रुग्णवाहिका व हेल्पलाइन</div>
            </div>
          </div>

          {/* Partner & Accreditation Bar */}
          <div style={{ textAlign: 'center', margin: '40px 0 20px', color: '#94a3b8', fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>
            ◇ सहयोगी कार्यक्रम व भागीदार संस्था ◇
          </div>
          <div className="gov-partners-bar">
            <div className="gov-partner-logo">जननी सुरक्षा योजना</div>
            <div className="gov-partner-logo">PM-JAY आयुष्मान भारत</div>
            <div className="gov-partner-logo">RMNCH+A</div>
            <div className="gov-partner-logo">राष्ट्रीय पोषण अभियान</div>
            <div className="gov-partner-logo">UNICEF India</div>
          </div>
        </div>
      </section>

      {/* 7. OFFICIAL FOOTER */}
      <footer className="gov-footer" id="contact">
        <div className="gov-container">
          <div className="gov-footer-grid">
            {/* Col 1: Address */}
            <div className="gov-footer-col">
              <div className="gov-footer-col-icon">
                <IconBuilding size={20} />
              </div>
              <div>
                <div className="gov-footer-col-title">पत्ता (Headquarters)</div>
                <div className="gov-footer-col-text">
                  आरोग्य भवन, सेंट जॉर्जेस हॉस्पिटल आवार,<br />
                  फोर्ट, मुंबई — ४०० ००१, महाराष्ट्र.
                </div>
              </div>
            </div>

            {/* Col 2: Contact */}
            <div className="gov-footer-col">
              <div className="gov-footer-col-icon">
                <IconMail size={20} />
              </div>
              <div>
                <div className="gov-footer-col-title">संपर्क व हेल्पलाइन</div>
                <div className="gov-footer-col-text">
                  needhelp@arogya.maharashtra.gov.in<br />
                  आपत्कालीन: <strong>१०८</strong> · NHM हेल्पलाइन: <strong>१०४</strong><br />
                  टोल-फ्री: <strong>१८००-२३३-४५६७</strong>
                </div>
              </div>
            </div>

            {/* Col 3: Timings */}
            <div className="gov-footer-col">
              <div className="gov-footer-col-icon">
                <IconCalendar size={20} />
              </div>
              <div>
                <div className="gov-footer-col-title">कार्यरत वेळा (Timings)</div>
                <div className="gov-footer-col-text">
                  प्राथमिक आरोग्य केंद्र (PHC): सकाळी ८:०० ते रात्री ८:००<br />
                  प्रशासकीय कार्यालय: सोम - शनि (१०:०० ते ५:४५)<br />
                  <span style={{ color: '#e5a968', fontWeight: 600 }}>आपत्कालीन व रुग्णवाहिका सेवा २४x७ अविरत</span>
                </div>
              </div>
            </div>
          </div>

          <div className="gov-footer-bottom">
            <div>
              © २०२६ सेवा आरोग्य · सार्वजनिक आरोग्य विभाग, महाराष्ट्र शासन.
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <a href="#" style={{ color: '#94a3b8', textDecoration: 'none' }} onClick={() => setShowLoginModal(true)}>Portal Login</a>
              <span>·</span>
              <a href="#" style={{ color: '#94a3b8', textDecoration: 'none' }}>Privacy Policy</a>
              <span>·</span>
              <a href="#" style={{ color: '#94a3b8', textDecoration: 'none' }}>Terms of Use</a>
              <span>·</span>
              <a href="#" style={{ color: '#94a3b8', textDecoration: 'none' }}>Help Center</a>
            </div>
          </div>
        </div>
      </footer>

      {/* 8. INTERACTIVE LOGIN MODAL (High-End Government Portal Login with OTP & Demo Access) */}
      {showLoginModal && (
        <div className="gov-login-modal-overlay" onClick={() => setShowLoginModal(false)}>
          <div className="gov-login-modal" onClick={e => e.stopPropagation()}>
            <div className="gov-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <IndianFlag width={26} height={17} style={{ borderRadius: 2 }} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: 0.5 }}>आरोग्य सेवा पोर्टल लॉगिन</div>
                  <div style={{ fontSize: 11, color: '#e5a968' }}>महाराष्ट्र शासन · सुरक्षित OTP प्रवेश</div>
                </div>
              </div>
              <button
                style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', padding: 4 }}
                onClick={() => setShowLoginModal(false)}
              >
                <IconX size={20} />
              </button>
            </div>

            <div className="gov-modal-body">
              {/* Role Selector Tabs */}
              <div className="role-grid mb-16" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div
                  className={`role-card ${role === 'asha' ? 'selected' : ''}`}
                  onClick={() => handleRoleChange('asha')}
                  id="modal-role-asha"
                >
                  <span className="role-icon"><IconUsers size={16} /></span>
                  <div className="role-name" style={{ fontSize: 13 }}>आशा सेविका</div>
                  <div className="role-desc" style={{ fontSize: 10 }}>फील्ड आरोग्य कार्यकर्ती</div>
                </div>
                <div
                  className={`role-card ${role === 'supervisor' ? 'selected' : ''}`}
                  onClick={() => handleRoleChange('supervisor')}
                  id="modal-role-supervisor"
                >
                  <span className="role-icon"><IconBarChart size={16} /></span>
                  <div className="role-name" style={{ fontSize: 13 }}>पर्यवेक्षक</div>
                  <div className="role-desc" style={{ fontSize: 10 }}>ब्लॉक आरोग्य अधिकारी</div>
                </div>
              </div>

              {/* STEP 1: Mobile Phone Form */}
              {step === 'input' && (
                <form onSubmit={handleSendOtp}>
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12 }}>आपले पूर्ण नाव (Full Name) *</label>
                    <input
                      type="text"
                      placeholder="उदा. हर्षिका थोपटे"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      style={{ fontSize: 14 }}
                      id="modal-login-name"
                      autoFocus
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: 12 }}>मोबाईल क्रमांक *</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <span style={{ position: 'absolute', left: 12, color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>
                        +९१
                      </span>
                      <input
                        type="tel"
                        placeholder="९८७६५४३२१०"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        style={{ paddingLeft: 52, fontSize: 14 }}
                        maxLength={10}
                        id="modal-login-phone"
                      />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      लॉगिन करण्यासाठी या मोबाईल क्रमांकावर SMS द्वारे खरा OTP पाठवला जाईल.
                    </div>
                  </div>

                  {error && (
                    <div style={{ color: 'var(--accent-red)', fontSize: 12, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <IconAlertTriangle size={14} />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center', gap: 8, marginTop: 6 }}
                    type="submit"
                    disabled={loading}
                    id="modal-send-otp-btn"
                  >
                    {loading ? (
                      <>
                        <IconSpinner size={16} />
                        <span>OTP पाठवत आहे...</span>
                      </>
                    ) : (
                      <>
                        <IconSend size={16} />
                        <span>सुरक्षा OTP मिळवा</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* STEP 2: OTP Verification */}
              {step === 'otp' && (
                <form onSubmit={handleVerifyOtp}>
                  {simulatedOtpNotice && (
                    <div style={{
                      padding: '12px 14px',
                      background: 'rgba(5, 150, 105, 0.06)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      marginBottom: 16
                    }}>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                        <IconCheckCircle size={16} style={{ color: 'var(--accent-green)' }} />
                        <span>सुरक्षा OTP तयार केला आहे</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                        मोबाईल क्रमांक: <strong>+९१ {toMarathiDigits(simulatedOtpNotice.destination)}</strong>
                      </div>

                      {simulatedOtpNotice.gatewayCode === 999 && (
                        <div style={{
                          marginTop: 8,
                          padding: '8px 10px',
                          background: '#fff7ed',
                          border: '1px solid #fdba74',
                          borderRadius: 6,
                          fontSize: 11,
                          color: '#c2410c',
                          lineHeight: 1.5
                        }}>
                          <strong>Fast2SMS गेटवे मर्यादा:</strong> Fast2SMS वरून थेट मोबाईलवर SMS जाण्यासाठी खात्यावर किमान ₹१०० चे एकवेळ रिचार्ज आवश्यक आहे (Status 999).
                        </div>
                      )}

                      {simulatedOtpNotice.devOtp ? (
                        <div style={{ marginTop: 8, padding: '10px 12px', background: '#ecfdf5', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #a7f3d0' }}>
                          <div>
                            <div style={{ fontSize: 11, color: '#047857', fontWeight: 600 }}>प्रवेशासाठी लॉगिन OTP:</div>
                            <span style={{ fontSize: 18, color: '#059669', fontWeight: 800, letterSpacing: 2 }}>
                              {simulatedOtpNotice.devOtp}
                            </span>
                          </div>
                          <span style={{ fontSize: 11, color: '#047857', background: '#d1fae5', padding: '3px 8px', borderRadius: 4, fontWeight: 600 }}>आपोआप भरला आहे ✓</span>
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, color: 'var(--accent-green)', marginTop: 6, fontWeight: 600 }}>
                          ✓ आपल्या मोबाईलवर SMS द्वारे खरा OTP पाठवला आहे. कृपया SMS तपासून तो खाली प्रविष्ट करा.
                        </div>
                      )}
                    </div>
                  )}

                  <div className="form-group">
                    <label style={{ fontSize: 12 }}>६-अंकी OTP प्रविष्ट करा *</label>
                    <input
                      type="text"
                      placeholder="१२३४५६"
                      value={otp}
                      onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="otp-big-input"
                      maxLength={6}
                      id="modal-login-otp"
                      autoFocus
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                      <span>पाठवला: {name ? `${name} (+९१ ${toMarathiDigits(phone)})` : `+९१ ${toMarathiDigits(phone)}`}</span>
                      {resendTimer > 0 ? (
                        <span>पुन्हा पाठवा ({toMarathiDigits(resendTimer)} सेकंद)</span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          style={{ background: 'none', border: 'none', color: 'var(--accent-green)', cursor: 'pointer', fontWeight: 600, padding: 0, fontSize: 11 }}
                        >
                          पुन्हा OTP पाठवा
                        </button>
                      )}
                    </div>
                  </div>

                  {error && (
                    <div style={{ color: 'var(--accent-red)', fontSize: 12, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <IconAlertTriangle size={14} />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center', gap: 8 }}
                    type="submit"
                    disabled={loading || otp.length < 4}
                    id="modal-verify-btn"
                  >
                    {loading ? (
                      <>
                        <IconSpinner size={16} />
                        <span>तपासत आहे...</span>
                      </>
                    ) : (
                      <>
                        <IconShieldCheck size={16} />
                        <span>सत्यापित करा आणि प्रवेश करा</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              <div className="divider" style={{ margin: '18px 0' }} />

              {/* Fast Demo One-Click Access */}
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', fontWeight: 700, marginBottom: 8, letterSpacing: 0.5 }}>
                त्वरित चाचणी (१-क्लिक प्रवेश)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '8px 10px', fontSize: 11, justifyContent: 'center' }}
                  onClick={() => quickLogin('सुनिता पवार', 'asha')}
                  id="quick-demo-asha"
                >
                  आशा: सुनिता पवार
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '8px 10px', fontSize: 11, justifyContent: 'center' }}
                  onClick={() => quickLogin('पर्यवेक्षक देसाई', 'supervisor')}
                  id="quick-demo-supervisor"
                >
                  पर्यवेक्षक: देसाई
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
