'use client'
import { useEffect, useState } from 'react'
import { isDeviceOnline, getPendingSyncCount, syncPendingVisitsToServer } from '@/lib/offlineStorage'
import { IconAlertTriangle, IconCheckCircle, IconSpinner } from './Icons'

export default function PwaRegister() {
  const [online, setOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  useEffect(() => {
    // 1. Service Worker for offline PWA: ONLY active in production
    // In development mode, Next.js HMR conflicts with Service Workers causing infinite reload loops
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      if (process.env.NODE_ENV !== 'production') {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const reg of registrations) {
            reg.unregister()
            console.log('[PWA] Unregistered service worker in dev mode')
          }
        })
        if (typeof caches !== 'undefined') {
          caches.keys().then((keys) => {
            for (const key of keys) caches.delete(key)
          })
        }
      } else {
        navigator.serviceWorker.register('/sw.js').then(
          (reg) => {
            console.log('[PWA] Service Worker registered:', reg.scope)
          },
          (err) => {
            console.warn('[PWA] Service Worker registration failed:', err)
          }
        )
      }
    }

    // 2. Initial state
    setOnline(isDeviceOnline())
    setPendingCount(getPendingSyncCount())

    // 3. Handlers for online/offline events
    const handleOnline = async () => {
      setOnline(true)
      const count = getPendingSyncCount()
      if (count > 0) {
        setSyncing(true)
        const result = await syncPendingVisitsToServer()
        setSyncing(false)
        setPendingCount(getPendingSyncCount())
        if (result.syncedCount > 0) {
          showToast(`✓ इंटरनेट सुरू झाले: ${result.syncedCount} ऑफलाइन भेटी सर्व्हरवर सिंक झाल्या!`)
        }
      } else {
        showToast('✓ इंटरनेट कनेक्शन उपलब्ध आहे.')
      }
    }

    const handleOffline = () => {
      setOnline(false)
      showToast('○ ऑफलाइन मोड: इंटरनेट बंद आहे. नवीन नोंदी स्थानिक मेमरीमध्ये सेव्ह होतील.')
    }

    const handleSyncUpdate = (e) => {
      setPendingCount(e?.detail?.pendingCount ?? getPendingSyncCount())
      setOnline(isDeviceOnline())
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('seva-sync-update', handleSyncUpdate)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('seva-sync-update', handleSyncUpdate)
    }
  }, [])

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 4500)
  }

  const handleManualSync = async () => {
    if (!online) {
      alert('सध्या इंटरनेट बंद आहे. कृपया वाय-फाय किंवा मोबाईल डेटा सुरू करा.')
      return
    }
    setSyncing(true)
    const res = await syncPendingVisitsToServer()
    setSyncing(false)
    setPendingCount(getPendingSyncCount())
    if (res.syncedCount > 0) {
      showToast(`✓ ${res.syncedCount} भेटी यशस्वीरीत्या सर्व्हरवर सिंक झाल्या!`)
    } else {
      showToast('सर्व नोंदी आधीच सिंक आहेत.')
    }
  }

  return (
    <>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            padding: '12px 18px',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            border: '1px solid var(--border)',
            fontSize: 13,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <IconCheckCircle size={18} style={{ color: 'var(--accent-green)' }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Floating Offline / Pending Sync Status Bar */}
      {(!online || pendingCount > 0) && (
        <div
          id="offline-sync-indicator"
          style={{
            position: 'fixed',
            top: 12,
            right: 20,
            zIndex: 9000,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '6px 14px',
            background: online ? 'rgba(217, 107, 39, 0.92)' : 'rgba(180, 40, 40, 0.92)',
            color: '#ffffff',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 600,
            boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
            backdropFilter: 'blur(8px)'
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: online ? '#4ade80' : '#f87171',
              display: 'inline-block'
            }}
          />
          <span>
            {!online
              ? 'ऑफलाइन मोड (इंटरनेट बंद)'
              : `${pendingCount} नोंदणी सिंक बाकी`}
          </span>

          {pendingCount > 0 && online && (
            <button
              onClick={handleManualSync}
              disabled={syncing}
              style={{
                background: '#ffffff',
                color: '#b45309',
                border: 'none',
                padding: '2px 8px',
                borderRadius: 12,
                fontSize: 11,
                cursor: 'pointer',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              {syncing ? <IconSpinner size={12} /> : null}
              <span>{syncing ? 'सिंक होत आहे...' : 'आताच सिंक करा'}</span>
            </button>
          )}
        </div>
      )}
    </>
  )
}
