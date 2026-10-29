/**
 * Seva Health – Session Management
 * Uses jose (JWS/JWT) to sign session cookies.
 * The SESSION_SECRET env-var must be at least 32 chars.
 */
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const COOKIE_NAME = 'seva_session'
const MAX_AGE_SECONDS = 8 * 60 * 60 // 8 hours

function getSecret() {
  const raw = process.env.SESSION_SECRET || '1adc954a6050237c93e4bc5c44333a24a3d51a456d4d8d11749809eca573e280'
  return new TextEncoder().encode(raw)
}

/**
 * Create a signed JWT session cookie for the given worker.
 * Returns a Set-Cookie-compatible string — call this in the auth verify handler.
 */
export async function createSession(worker) {
  const secret = getSecret()
  const token = await new SignJWT({
    id: worker.id,
    name: worker.name,
    role: worker.role,
    village: worker.village,
    block: worker.block,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret)

  return token
}

/**
 * Read and verify the session cookie from an incoming Next.js request.
 * Returns the payload on success, null on failure.
 */
export async function getSession(request) {
  try {
    const cookieHeader = request.headers.get('cookie') || ''
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`))
    if (!match) return null

    const token = decodeURIComponent(match[1])
    const secret = getSecret()
    const { payload } = await jwtVerify(token, secret)
    return payload
  } catch {
    return null
  }
}

/**
 * Set the session cookie on a NextResponse (or new NextResponse).
 */
export function setSessionCookie(response, token) {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
    // secure: true in production (HTTPS)
    secure: process.env.NODE_ENV === 'production',
  })
  return response
}

/**
 * Clear the session cookie (logout).
 */
export function clearSessionCookie(response) {
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    secure: process.env.NODE_ENV === 'production',
  })
  return response
}

/**
 * Convenience: require a valid session; returns {session} or {error: NextResponse}.
 * Usage:
 *   const { session, error } = await requireSession(request)
 *   if (error) return error
 */
export async function requireSession(request) {
  const session = await getSession(request)
  if (!session) {
    return {
      session: null,
      error: NextResponse.json(
        { error: 'प्रमाणीकरण आवश्यक आहे. कृपया लॉगिन करा.' },
        { status: 401 }
      )
    }
  }
  return { session, error: null }
}
