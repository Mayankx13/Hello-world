// liqo-ig-concierge Worker — public Meta webhook endpoint + dashboard API.
//
// Security layers on /api/*:
//   1. Cloudflare Access on the zone (configured in Zero Trust, outside this repo)
//   2. X-Api-Key header must equal the DASH_API_KEY secret (enforced here),
//      so the API stays closed even if Access is misconfigured.
// The /webhook path is public by design (Meta must reach it) and is protected
// by the Meta signature check instead.
//
// PRIVACY: no request/response bodies are ever logged in this Worker.

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from './types'
import { webhook } from './webhook'
import { api } from './api'

const app = new Hono<{ Bindings: Env }>()

app.get('/', (c) => c.json({ ok: true, service: 'liqo-ig-concierge' }))

app.route('/webhook', webhook)

// CORS first so OPTIONS preflights (which never carry custom headers) succeed;
// the api-key gate then covers every real request.
app.use(
  '/api/*',
  cors({
    origin: (origin) =>
      origin === 'https://command.amaflip.in' ||
      origin.startsWith('http://localhost:') ||
      origin.startsWith('http://127.0.0.1:')
        ? origin
        : '',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'X-Api-Key'],
    maxAge: 86400,
  }),
)

app.use('/api/*', async (c, next) => {
  const expected = c.env.DASH_API_KEY
  const got = c.req.header('x-api-key')
  // Fail closed if the secret is missing; constant-time comparison via digests.
  if (!expected || !got || !(await timingSafeEqual(got, expected))) {
    return c.json({ error: 'unauthorized' }, 401)
  }
  await next()
})

app.route('/api', api)

app.notFound((c) => c.json({ error: 'not found' }, 404))
app.onError((err, c) => {
  console.log(`unhandled error on ${c.req.method} ${new URL(c.req.url).pathname}: ${err.name}`)
  return c.json({ error: 'internal error' }, 500)
})

// Compare SHA-256 digests so the comparison cost is independent of where the
// strings differ (and of their lengths).
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder()
  const [da, db] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ])
  const va = new Uint8Array(da)
  const vb = new Uint8Array(db)
  let diff = 0
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i]
  return diff === 0
}

export default app
