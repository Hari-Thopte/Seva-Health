'use client'
import { useEffect, useState } from 'react'
import { IconMoon, IconSun } from './Icons'

export default function ThemeToggle({ showLabel = true, className = '' }) {
  const [theme, setTheme] = useState('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const savedTheme = localStorage.getItem('seva_theme') || 'light'
      setTheme(savedTheme)
      document.documentElement.setAttribute('data-theme', savedTheme)
    } catch {
      document.documentElement.setAttribute('data-theme', 'light')
    }
  }, [])

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    try {
      localStorage.setItem('seva_theme', nextTheme)
      document.documentElement.setAttribute('data-theme', nextTheme)
    } catch {}
  }

  if (!mounted) {
    return (
      <button
        type="button"
        className={`theme-toggle-btn ${className}`}
        aria-label="थीम बदला"
      >
        <span aria-hidden="true"><IconMoon size={16} /></span>
        {showLabel && <span>गडद मोड</span>}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`theme-toggle-btn ${className}`}
      title={theme === 'dark' ? 'प्रकाशमय मोड (Light Mode) निवडा' : 'गडद मोड (Dark Mode) निवडा'}
      aria-label="थीम बदला"
      id="theme-toggle-btn"
    >
      <span aria-hidden="true">{theme === 'dark' ? <IconSun size={16} /> : <IconMoon size={16} />}</span>
      {showLabel && (
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          {theme === 'dark' ? 'प्रकाशमय मोड' : 'गडद मोड'}
        </span>
      )}
    </button>
  )
}
