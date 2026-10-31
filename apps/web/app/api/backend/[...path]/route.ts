import { NextResponse, type NextRequest } from 'next/server'

import { serverApiBase } from '@/lib/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_METHODS = new Set(['GET', 'POST'])
const FORWARDED_RESPONSE_HEADERS = ['content-type', 'location', 'x-request-id']

function failure(status: number, code: string, message: string) {
  return NextResponse.json({ statusCode: status, code, message }, { status })
}

/**
 * Same-origin auth proxy. Vercel and Render are different sites, so a cookie
 * set by the API directly would be third-party. Forwarding Set-Cookie through
 * this handler keeps `sb_session` first-party on the web origin; only auth
 * routes are exposed, never the whole API.
 */
async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  if (path[0] !== 'auth' || !ALLOWED_METHODS.has(request.method)) {
    return failure(404, 'NOT_FOUND', 'Not found.')
  }

  const target = `${serverApiBase()}/${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`
  const headers = new Headers()
  for (const name of ['cookie', 'content-type', 'accept', 'x-request-id']) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }

  let upstream: Response
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === 'POST' ? await request.text() : undefined,
      redirect: 'manual',
      cache: 'no-store',
    })
  } catch {
    return failure(502, 'SERVICE_UNAVAILABLE', 'Authentication service is unavailable.')
  }

  const responseHeaders = new Headers()
  for (const cookie of upstream.headers.getSetCookie()) {
    responseHeaders.append('set-cookie', cookie)
  }
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name)
    if (value) responseHeaders.set(name, value)
  }

  if (upstream.status === 204 || upstream.status === 304) {
    return new NextResponse(null, { status: upstream.status, headers: responseHeaders })
  }

  return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders })
}

export { proxy as GET, proxy as POST }
