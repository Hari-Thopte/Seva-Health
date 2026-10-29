/**
 * Simple in-process rate limiter for the OTP endpoint.
 * Resets on server restart (swap for Redis in production).
 *
 * Rules:
 *  - Max 5 OTP send attempts per normalized contact per 15-minute window
 *  - Max 5 verify attempts per contact — reset when a new OTP is successfully sent
 *
 * Key normalization:
 *  - Phone numbers: strip all non-digits, take last 10 digits  → "9876543210"
 *  - Emails: lowercase trim
 *  This ensures "9876543210", "+91 98765 43210" and "98765…43210" map to the same key.
 */

const store = new Map() // key → { sendCount, sendWindowStart, verifyCount }

const SEND_LIMIT = process.env.NODE_ENV === 'production' ? 5 : 50
const SEND_WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const VERIFY_LIMIT = process.env.NODE_ENV === 'production' ? 5 : 50

function normalizeKey(contact) {
  const c = contact.trim()
  // If it looks like a phone number (only digits/spaces/+/-), reduce to last 10 digits
  const digits = c.replace(/\D/g, '')
  if (digits.length >= 10 && digits.length <= 15) {
    return digits.slice(-10)
  }
  // Otherwise treat as email — lowercase
  return c.toLowerCase()
}

function getEntry(key) {
  if (!store.has(key)) {
    store.set(key, { sendCount: 0, sendWindowStart: Date.now(), verifyCount: 0 })
  }
  return store.get(key)
}

/**
 * Record a send attempt.
 * Also resets the verify counter so a re-sent OTP unlocks a locked-out user.
 * Returns { allowed: boolean, retryAfterMs?: number }
 */
export function checkSendRate(contact) {
  const key = normalizeKey(contact)
  const entry = getEntry(key)
  const now = Date.now()

  // Reset send window if expired
  if (now - entry.sendWindowStart > SEND_WINDOW_MS) {
    entry.sendCount = 0
    entry.sendWindowStart = now
  }

  if (entry.sendCount >= SEND_LIMIT) {
    const retryAfterMs = SEND_WINDOW_MS - (now - entry.sendWindowStart)
    return { allowed: false, retryAfterMs }
  }

  entry.sendCount++
  // Reset verify counter each time a fresh OTP is sent — prevents permanent lockout
  entry.verifyCount = 0
  return { allowed: true }
}

/**
 * Record a verify attempt.
 * Returns { allowed: boolean }
 */
export function checkVerifyRate(contact) {
  const key = normalizeKey(contact)
  const entry = getEntry(key)

  if (entry.verifyCount >= VERIFY_LIMIT) {
    return { allowed: false }
  }

  entry.verifyCount++
  return { allowed: true }
}

/**
 * Clear verify attempts on successful login.
 */
export function clearVerifyAttempts(contact) {
  const key = normalizeKey(contact)
  if (store.has(key)) {
    store.get(key).verifyCount = 0
  }
}
