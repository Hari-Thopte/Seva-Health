'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import IndianFlag from './IndianFlag'
import ThemeToggle from './ThemeToggle'
import {
  IconHome,
  IconMic,
  IconUsers,
  IconCalendar,
  IconBarChart,
  IconTrendingUp,
  IconLogOut
} from './Icons'
import { toMarathiName, toMarathiVillage, toMarathiInitial, MARATHI_NAMES, MARATHI_VILLAGES } from '@/lib/marathi'

export default function Sidebar(props) {
  return (
    <Suspense fallback={<aside className="sidebar" />}>
      <SidebarContent {...props} />
    </Suspense>
  )
}

function SidebarContent({ role = 'asha' }) {
  const router = useRouter()
  const pathname = usePathname()
  const [worker, setWorker] = useState(null)

  useEffect(() => {
    const w = localStorage.getItem('seva_worker')
    if (w) {
      try {
        const parsed = JSON.parse(w)
        if (parsed.name && (MARATHI_NAMES[parsed.name] || MARATHI_VILLAGES[parsed.village])) {
          parsed.name = MARATHI_NAMES[parsed.name] || parsed.name
          parsed.village = MARATHI_VILLAGES[parsed.village] || parsed.village
          localStorage.setItem('seva_worker', JSON.stringify(parsed))
        }
        setWorker(parsed)
      } catch (e) {}
    }
  }, [])

  const workerLinks = [
    { href: '/worker/dashboard', icon: <IconHome size={18} />, label: 'मुख्यपृष्ठ' },
    { href: '/worker/new-visit', icon: <IconMic size={18} />, label: 'रुग्ण भेट नोंदवा' },
    { href: '/worker/patients', icon: <IconUsers size={18} />, label: 'सर्व नोंदणीकृत रुग्ण' },
    { href: '/worker/followups', icon: <IconCalendar size={18} />, label: 'नियमित फॉलो-अप', badge: true },
  ]

  const supervisorLinks = [
    { href: '/supervisor/dashboard', icon: <IconBarChart size={18} />, label: 'ब्लॉक डॅशबोर्ड' },
    { href: '/supervisor/workers', icon: <IconUsers size={18} />, label: 'आरोग्य सेविका यादी' },
    { href: '/supervisor/reports', icon: <IconTrendingUp size={18} />, label: 'मासिक प्रगती अहवाल' },
  ]

  const effectiveRole = worker?.role || role
  const links = effectiveRole === 'supervisor' ? supervisorLinks : workerLinks

  const handleLogout = async (e) => {
    if (e) e.preventDefault()
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      localStorage.removeItem('seva_worker')
      sessionStorage.clear()
      window.location.href = '/'
    }
  }

  const displayName = toMarathiName(worker?.name) || (effectiveRole === 'supervisor' ? 'पर्यवेक्षक देसाई' : 'सुनिता पवार')
  const displayVillage = toMarathiVillage(worker?.village) || (effectiveRole === 'supervisor' ? 'जुन्नर' : 'आंबेगाव')
  const initials = toMarathiInitial(displayName)

  return (
    <aside className="sidebar">
      <div className="sidebar-logo" style={{ cursor: 'pointer' }} onClick={() => router.push('/')} title="सार्वजनिक लँडिंग पेजवर जा">
        <div className="logo-mark" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flexShrink: 0 }}>
            <IndianFlag size={32} />
          </div>
          <div>
            <div className="logo-text">सेवा <span>आरोग्य</span></div>
            <div className="logo-sub">महाराष्ट्र शासन (NHM)</div>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label" style={{ marginTop: 0 }}>
          {effectiveRole === 'supervisor' ? 'पर्यवेक्षक नियंत्रण कक्ष' : 'आशा सेविका कार्यक्षेत्र'}
        </div>
        {links.map(link => (
          <button
            key={link.href}
            className={`nav-link ${pathname === link.href ? 'active' : ''}`}
            onClick={() => router.push(link.href)}
            id={`nav-${link.href.replace(/\//g, '-').slice(1)}`}
          >
            <span className="nav-icon">{link.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{link.label}</span>
            {link.badge && <span className="nav-badge" id="followup-badge">३</span>}
          </button>
        ))}

        <div className="divider" style={{ margin: '16px 0' }} />

        <button
          className="nav-link"
          onClick={() => router.push('/')}
          id="nav-landing-page"
          style={{ fontSize: 13 }}
        >
          <span className="nav-icon"><IconHome size={18} /></span>
          <span>मुख्य दालन (होमपेज)</span>
        </button>

        <ThemeToggle className="sidebar-theme-toggle" />

        <button
          className="nav-link logout-btn"
          onClick={handleLogout}
          id="nav-logout"
          style={{
            fontSize: 13,
            color: '#fca5a5',
            cursor: 'pointer'
          }}
          title="खात्यातून बाहेर पडा"
        >
          <span className="nav-icon" style={{ color: '#f87171' }}><IconLogOut size={18} /></span>
          <span style={{ fontWeight: 500 }}>खात्यातून बाहेर पडा</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <div className="user-card" id="user-profile-card">
          <div className="user-avatar" style={{ fontSize: 15, fontWeight: 700 }}>{initials}</div>
          <div>
            <div className="user-name">{displayName}</div>
            <div className="user-role">{displayVillage} · {effectiveRole === 'supervisor' ? 'पर्यवेक्षक' : 'आशा कार्यकर्ती'}</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
