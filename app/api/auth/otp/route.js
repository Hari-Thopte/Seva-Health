/**
 * /api/auth/otp — OTP send & verify
 *
 * Security fixes applied:
 *  ✅ crypto.randomInt instead of Math.random()
 *  ✅ OTP stored as SHA-256 hash (never plain-text)
 *  ✅ devOtp only returned when NODE_ENV !== 'production' AND ALLOW_DEV_TEST_OTP=1
 *  ✅ Rate limiting: 5 sends / 15 min, 5 verify attempts max
 *  ✅ Removed phone-overwrite on new numbers (no more silent account hijack)
 *  ✅ Removed alias shortcuts (sunita / demo) — requires real registered contact
 *  ✅ GET endpoint no longer exposes worker contact list
 *  ✅ Session cookie issued on successful verify
 */
import { getDb } from '@/lib/db'
import { NextResponse } from 'next/server'
import { sendRealSMS } from '@/lib/sms'
import { createSession, setSessionCookie } from '@/lib/session'
import { checkSendRate, checkVerifyRate, clearVerifyAttempts } from '@/lib/rateLimit'
import { createHash, randomInt } from 'crypto'

/** Hash an OTP with SHA-256 before storing */
function hashOtp(otp) {
  return createHash('sha256').update(otp).digest('hex')
}

export async function POST(request) {
  try {
    const db = getDb()
    const body = await request.json()
    const { action = 'send', contact = '', otp = '', role = 'asha', name = '' } = body

    // Convert any Marathi digits (०-९) to standard ASCII digits (0-9)
    const marathiDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९']
    const cleanContact = contact.trim().replace(/[०-९]/g, (d) => marathiDigits.indexOf(d))
    const cleanName = typeof name === 'string' ? name.trim() : ''

    if (!cleanContact) {
      return NextResponse.json(
        { error: 'कृपया वैध मोबाईल नंबर किंवा ईमेल आयडी प्रविष्ट करा.' },
        { status: 400 }
      )
    }

    // ── Rate-limit check ──────────────────────────────────────────────────────
    if (action === 'send') {
      const { allowed, retryAfterMs } = checkSendRate(cleanContact)
      if (!allowed) {
        const mins = Math.ceil(retryAfterMs / 60000)
        return NextResponse.json(
          { error: `खूप जास्त प्रयत्न. ${mins} मिनिटांनंतर पुन्हा प्रयत्न करा.` },
          { status: 429 }
        )
      }
    }

    if (action === 'verify') {
      const { allowed } = checkVerifyRate(cleanContact)
      if (!allowed) {
        return NextResponse.json(
          { error: 'जास्त चुकीचे OTP प्रयत्न. कृपया नवीन OTP मागवा.' },
          { status: 429 }
        )
      }
    }

    // ── Look up or auto-register worker ───────────────────────────────────────
    const isEmail = cleanContact.includes('@')
    const isDigitsOnly = /^\d+$/.test(cleanContact.replace(/[\s+-]/g, ''))
    const normalizedDigits = cleanContact.replace(/\D/g, '').slice(-10)

    let worker = null
    if (isEmail) {
      worker = db.prepare('SELECT * FROM workers WHERE LOWER(email) = LOWER(?)').get(cleanContact)
      if (!worker && action === 'send') {
        const selectedRole = role === 'supervisor' ? 'supervisor' : 'asha'
        const defaultName = cleanName || cleanContact.split('@')[0]
        const info = db.prepare(`
          INSERT INTO workers (name, email, village, block, role)
          VALUES (?, ?, ?, ?, ?)
        `).run(defaultName, cleanContact.toLowerCase(), 'आंबेगाव', 'जुन्नर', selectedRole)
        worker = db.prepare('SELECT * FROM workers WHERE id = ?').get(info.lastInsertRowid)
      }
    } else if (isDigitsOnly && normalizedDigits.length >= 10) {
      worker = db.prepare('SELECT * FROM workers WHERE phone LIKE ?').get(`%${normalizedDigits}%`)
      if (!worker && action === 'send') {
        const selectedRole = role === 'supervisor' ? 'supervisor' : 'asha'
        const workerName = cleanName || (selectedRole === 'supervisor' ? 'पर्यवेक्षक' : 'आरोग्य सेविका')
        const info = db.prepare(`
          INSERT INTO workers (name, phone, village, block, role)
          VALUES (?, ?, ?, ?, ?)
        `).run(workerName, normalizedDigits, 'आंबेगाव', 'जुन्नर', selectedRole)
        worker = db.prepare('SELECT * FROM workers WHERE id = ?').get(info.lastInsertRowid)

        // Seed sample patients for newly registered ASHA so dashboard has live content
        if (selectedRole === 'asha') {
          try {
            const samplePatients = db.prepare('SELECT * FROM patients WHERE worker_id = 1').all()
            const insertP = db.prepare(`
              INSERT INTO patients (name, age, phone, village, category, weeks_pregnant, children_count, risk_level, worker_id, last_visit, next_followup, notes)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `)
            for (const sp of samplePatients) {
              insertP.run(sp.name, sp.age, sp.phone, sp.village, sp.category, sp.weeks_pregnant, sp.children_count, sp.risk_level, worker.id, sp.last_visit, sp.next_followup, sp.notes)
            }
          } catch (e) {}
        }
      }
    }

    // Name fallback only for exact registered names
    if (!worker) {
      worker = db.prepare('SELECT * FROM workers WHERE LOWER(name) = LOWER(?)').get(cleanContact)
    }

    if (!worker) {
      return NextResponse.json(
        {
          error: 'कृपया वैध १०-अंकी मोबाईल नंबर प्रविष्ट करा.',
          hint: 'उदा. ९८७६५४३२१० किंवा sunita.pawar@seva.gov.in'
        },
        { status: 400 }
      )
    }

    // Update worker's name if provided by user
    if (worker && cleanName && cleanName !== worker.name) {
      try {
        db.prepare('UPDATE workers SET name = ? WHERE id = ?').run(cleanName, worker.id)
        worker.name = cleanName
      } catch (e) {}
    }

    // Sync role if user switched role tab in modal
    if (worker && role && (role === 'asha' || role === 'supervisor') && worker.role !== role) {
      try {
        db.prepare('UPDATE workers SET role = ? WHERE id = ?').run(role, worker.id)
        worker.role = role
      } catch (e) {}
    }

    // ── ACTION: SEND OTP ──────────────────────────────────────────────────────
    if (action === 'send') {
      // Generate cryptographically secure 6-digit OTP
      const generatedOtp = randomInt(100000, 1000000).toString()

      // Hash before storing — the plain-text OTP is never persisted
      const otpHash = hashOtp(generatedOtp)
      const expiresAtIso = new Date(Date.now() + 10 * 60 * 1000).toISOString()

      db.prepare(`
        UPDATE workers
        SET otp = ?, otp_expires_at = ?
        WHERE id = ?
      `).run(otpHash, expiresAtIso, worker.id)

      const targetDestination = isEmail
        ? (worker.email || cleanContact)
        : (worker.phone || cleanContact)

      let smsResult = null
      if (!isEmail) {
        smsResult = await sendRealSMS({
          phone: targetDestination,
          otp: generatedOtp,
          workerName: worker.name
        })
      }

      // Server-side log only (never sent to client in production)
      console.log(
        `\n\x1b[36m[AUTH OTP]\x1b[0m Worker: ${worker.name} | Target: ${targetDestination} | OTP: ${generatedOtp}\n`
      )

      const isGatewaySent = smsResult && !smsResult.isSimulated

      // devOtp is ONLY included when both flags are true — gate it tightly
      const isDev = process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_TEST_OTP === '1'

      return NextResponse.json({
        success: true,
        message: isEmail
          ? `आपल्या ${targetDestination} या ईमेलवर OTP पाठवण्यात आला आहे.`
          : (smsResult?.message || `आपल्या +91 ${targetDestination} या मोबाईल क्रमांकावर OTP पाठवला आहे.`),
        target: targetDestination,
        isEmail,
        workerName: worker.name,
        role: worker.role,
        // Expose devOtp only in explicit dev mode — stripped in production builds
        ...(isDev && !isGatewaySent ? { devOtp: generatedOtp } : {}),
        gatewayNotice: smsResult?.gatewayMessage || null,
        gatewayCode: smsResult?.statusCode || null
      })
    }

    // ── ACTION: DEMO LOGIN (LOCAL DEV ONLY) ──────────────────────────────────
    if (action === 'demo_login') {
      const isDev = process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_TEST_OTP === '1'
      if (!isDev) {
        return NextResponse.json({ error: 'Demo login is disabled in production.' }, { status: 403 })
      }
      const { password, otp: _, otp_expires_at, ...safeWorker } = worker
      const token = await createSession(safeWorker)
      const response = NextResponse.json({ success: true, worker: safeWorker })
      return setSessionCookie(response, token)
    }

    // ── ACTION: VERIFY OTP ────────────────────────────────────────────────────
    if (action === 'verify') {
      const cleanOtp = String(otp).trim()
      if (!cleanOtp) {
        return NextResponse.json({ error: 'कृपया आलेला ६-अंकी OTP प्रविष्ट करा.' }, { status: 400 })
      }

      // Expiry check
      if (worker.otp_expires_at) {
        const expiresAt = new Date(worker.otp_expires_at).getTime()
        if (Date.now() > expiresAt) {
          return NextResponse.json({
            error: 'हा OTP कालबाह्य (expired) झाला आहे. कृपया नवीन OTP मागवा.'
          }, { status: 400 })
        }
      }

      if (!worker.otp) {
        return NextResponse.json({ error: 'OTP आढळला नाही. कृपया नवीन OTP मागवा.' }, { status: 400 })
      }

      // Compare hash — plain-text OTP is never read from DB
      const inputHash = hashOtp(cleanOtp)

      // Optional CI bypass: ALLOW_DEV_TEST_OTP must match the submitted OTP AND env flag set
      const allowEnvDemo =
        process.env.NODE_ENV !== 'production' &&
        process.env.ALLOW_DEV_TEST_OTP === '1' &&
        cleanOtp === process.env.ALLOW_DEV_TEST_OTP_VALUE

      const isMatch = worker.otp === inputHash || allowEnvDemo

      if (!isMatch) {
        return NextResponse.json(
          { error: 'चुकीचा OTP! कृपया अचूक OTP प्रविष्ट करा.' },
          { status: 400 }
        )
      }

      // Clear OTP on success (prevent replay)
      db.prepare('UPDATE workers SET otp = NULL, otp_expires_at = NULL WHERE id = ?').run(worker.id)
      clearVerifyAttempts(cleanContact)

      // Issue JWT session cookie
      const { password, otp: _, otp_expires_at, ...safeWorker } = worker
      const token = await createSession(safeWorker)

      const response = NextResponse.json({ success: true, worker: safeWorker })
      return setSessionCookie(response, token)
    }

    return NextResponse.json({ error: 'अवैध विनंती.' }, { status: 400 })

  } catch (error) {
    console.error('OTP त्रुटी:', error)
    return NextResponse.json({ error: 'सर्व्हर त्रुटी. कृपया पुन्हा प्रयत्न करा.' }, { status: 500 })
  }
}

/** Health-check endpoint — no contact data exposed */
export async function GET() {
  return NextResponse.json({
    message: 'OTP सेवा कार्यरत आहे',
    status: 'ok'
  })
}
