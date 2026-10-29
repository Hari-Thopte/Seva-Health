/**
 * lib/authHelper.js
 * Ensures any page in /worker/* or /supervisor/* has active session data.
 * If user hasn't logged in with OTP, provides seamless demo profile
 * so the entire portal can be thoroughly tested and explored.
 */

export function getOrCreateWorker(defaultRole = 'asha') {
  if (typeof window === 'undefined') return null

  try {
    const raw = localStorage.getItem('seva_worker')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && parsed.id) return parsed
    }
  } catch (e) {
    console.warn('Error reading worker session:', e)
  }

  const fallback = defaultRole === 'supervisor' ? {
    id: 2,
    name: 'पर्यवेक्षक देसाई',
    role: 'supervisor',
    phone: '9876543211',
    block: 'जुन्नर'
  } : {
    id: 1,
    name: 'सुनिता पवार',
    role: 'asha',
    phone: '9876543210',
    village: 'ओतूर',
    block: 'जुन्नर'
  }

  try {
    localStorage.setItem('seva_worker', JSON.stringify(fallback))
  } catch (e) {}

  return fallback
}

