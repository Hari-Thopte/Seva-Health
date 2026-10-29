/**
 * End-to-end security test: OTP login → JWT cookie → protected APIs
 * Run with: node scripts/test-auth-flow.js
 */
const BASE = 'http://localhost:3000'

async function api(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers }
  })
  let body
  try { body = await res.json() } catch { body = null }
  return { status: res.status, body, headers: res.headers }
}

function pass(label, got, expected) {
  const ok = got === expected
  console.log(`${ok ? '✅' : '❌'} ${label}: ${got} ${ok ? '' : `(expected ${expected})`}`)
  return ok
}

let allPassed = true

console.log('\n═══════════════════════════════════════════════')
console.log('  Seva Health — API Security Test Suite')
console.log('═══════════════════════════════════════════════\n')

// T1: No auth → 401
const t1 = await api('/api/patients')
allPassed &= pass('T1  No-auth /api/patients', t1.status, 401)

// T2: GET /api/auth/otp must not leak worker list
const t2 = await api('/api/auth/otp')
const t2leaks = t2.body?.availableWorkers != null
console.log(`${!t2leaks ? '✅' : '❌'} T2  GET /api/auth/otp leaks workers: ${t2leaks}`)
allPassed &= !t2leaks

// T3: Alias 'demo' must be rejected
const t3 = await api('/api/auth/otp', { method: 'POST', body: JSON.stringify({ action: 'send', contact: 'demo', role: 'asha' }) })
allPassed &= pass('T3  Alias "demo" rejected', t3.status, 404)

// T4: Unknown phone must be rejected
const t4 = await api('/api/auth/otp', { method: 'POST', body: JSON.stringify({ action: 'send', contact: '9000000099', role: 'asha' }) })
allPassed &= pass('T4  Unknown phone rejected', t4.status, 404)

// T5-T6: Rate limiting — 5 sends allowed, 6th blocked
console.log('\n  Rate limit test (sends to desai.supervisor@seva.gov.in):')
let rateLimitHit = false
for (let i = 1; i <= 6; i++) {
  const ri = await api('/api/auth/otp', { method: 'POST', body: JSON.stringify({ action: 'send', contact: 'desai.supervisor@seva.gov.in', role: 'supervisor' }) })
  const isLimited = ri.status === 429
  console.log(`  Send ${i}: ${ri.status}${isLimited ? ' ← RATE LIMITED' : ''}`)
  if (i === 6) {
    allPassed &= pass('T5  6th send rate-limited', ri.status, 429)
    rateLimitHit = isLimited
  }
}

// ─── Full login flow ──────────────────────────────────────────────────────
console.log('\n  Full login flow (Priya Kulkarni — ASHA):')

// Get a fresh OTP for a contact not yet rate-limited
const sendRes = await api('/api/auth/otp', {
  method: 'POST',
  body: JSON.stringify({ action: 'send', contact: 'sunita.pawar@seva.gov.in', role: 'asha' })
})
console.log(`  OTP send: ${sendRes.status} — devOtp present: ${sendRes.body?.devOtp != null}`)

// Read OTP from response (if devOtp available) or from latest server task log
import fs from 'fs'
import path from 'path'
let otp = sendRes.body?.devOtp
if (!otp) {
  const taskDir = 'C:\\Users\\Hari\\.gemini\\antigravity-ide\\brain\\9150da85-958a-4aee-bbaf-a8c81e86bcd2\\.system_generated\\tasks'
  const files = fs.readdirSync(taskDir).filter(f => f.endsWith('.log'))
  files.sort((a, b) => fs.statSync(path.join(taskDir, b)).mtimeMs - fs.statSync(path.join(taskDir, a)).mtimeMs)
  for (const f of files) {
    const lines = fs.readFileSync(path.join(taskDir, f), 'utf8').split('\n')
    const match = lines.filter(l => l.includes('[AUTH OTP]')).at(-1)
    if (match) {
      otp = (match.match(/\|\s*OTP:\s*(\d{6})/) || [])[1]
      if (otp) break
    }
  }
}
console.log(`  OTP: ${otp}`)

if (!otp) { console.log('❌ Could not extract OTP from server log'); process.exit(1) }

// Verify OTP — get session cookie
const verifyRes = await api('/api/auth/otp', {
  method: 'POST',
  body: JSON.stringify({ action: 'verify', contact: 'sunita.pawar@seva.gov.in', otp })
})
allPassed &= pass('T6  OTP verify', verifyRes.status, 200)
console.log(`  Worker: ${verifyRes.body?.worker?.name}, Role: ${verifyRes.body?.worker?.role}`)

// Extract session cookie
const rawSetCookie = verifyRes.headers.get('set-cookie') || ''
const cookieMatch = rawSetCookie.match(/seva_session=([^;]+)/)
const sessionCookie = cookieMatch?.[1]
console.log(`  Session cookie: ${sessionCookie ? `${sessionCookie.slice(0,20)}... (len=${sessionCookie.length})` : 'MISSING'}`)
allPassed &= pass('T7  Session cookie issued', sessionCookie?.length > 50 ? 200 : 0, 200)

if (sessionCookie) {
  const authHdr = { Cookie: `seva_session=${sessionCookie}` }

  // T8: ASHA reads their own patients (200)
  const t8 = await api('/api/patients', { headers: authHdr })
  console.log('T8 response:', t8.status, t8.body)
  allPassed &= pass('T8  /api/patients (ASHA auth)', t8.status, 200)
  console.log(`      Patient count: ${t8.body?.length ?? 0}`)

  // T9: ASHA blocked from /api/workers (403)
  const t9 = await api('/api/workers', { headers: authHdr })
  allPassed &= pass('T9  /api/workers (ASHA → 403)', t9.status, 403)

  // T10: ASHA blocked from /api/reports (403)
  const t10 = await api('/api/reports', { headers: authHdr })
  allPassed &= pass('T10 /api/reports (ASHA → 403)', t10.status, 403)

  // T11: ASHA can see followups (200)
  const t11 = await api('/api/followups', { headers: authHdr })
  allPassed &= pass('T11 /api/followups (ASHA auth)', t11.status, 200)

  // T12: Tampered cookie → 401
  const t12 = await api('/api/patients', { headers: { Cookie: 'seva_session=tampered.token.here' } })
  allPassed &= pass('T12 Tampered cookie → 401', t12.status, 401)

  // T13: Patient ID scoping — ASHA can't read patient that belongs to supervisor worker
  // Patient 5 belongs to worker 1 (Sunita — same ASHA, so 200)
  // Patient 10 belongs to worker 2 (Rekha), Sunita should get 403
  const t13 = await api('/api/patients/10', { headers: authHdr })
  allPassed &= pass('T13 /api/patients/10 cross-worker → 403', t13.status, 403)

  // T14: Logout clears cookie
  const logoutRes = await api('/api/auth/logout', { method: 'POST', headers: authHdr })
  allPassed &= pass('T14 POST /api/auth/logout', logoutRes.status, 200)
}

console.log(`\n═══════════════════════════════════════════════`)
console.log(`  Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`)
console.log(`═══════════════════════════════════════════════\n`)
process.exit(allPassed ? 0 : 1)
