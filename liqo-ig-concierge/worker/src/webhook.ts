// Meta (Instagram) webhook endpoints.
//
// The Worker is the stable public endpoint Meta talks to; the n8n DM loop
// sits behind it and is swappable via the N8N_WEBHOOK_URL secret.
//
// PRIVACY: webhook payloads contain customer message bodies. They are never
// logged here — not on success, not on error. Log status codes only.

import { Hono } from 'hono'
import type { Env } from './types'

export const webhook = new Hono<{ Bindings: Env }>()

// GET /webhook — Meta subscription verification handshake.
webhook.get('/', (c) => {
  const mode = c.req.query('hub.mode')
  const token = c.req.query('hub.verify_token')
  const challenge = c.req.query('hub.challenge') ?? ''
  if (mode === 'subscribe' && !!c.env.META_VERIFY_TOKEN && token === c.env.META_VERIFY_TOKEN) {
    return c.text(challenge, 200)
  }
  return c.text('Forbidden', 403)
})

// POST /webhook — verify the Meta signature, ack immediately, forward to n8n.
webhook.post('/', async (c) => {
  const raw = await c.req.text()
  const signature = c.req.header('x-hub-signature-256')
  const valid = await verifyMetaSignature(c.env.META_APP_SECRET, raw, signature)
  if (!valid) return c.json({ error: 'invalid signature' }, 401)

  // Forward the payload unchanged (headers included so n8n can re-verify),
  // in the background — Meta gets its 200 without waiting on n8n.
  const forward = fetch(c.env.N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'content-type': c.req.header('content-type') ?? 'application/json',
      'x-hub-signature-256': signature!,
    },
    body: raw,
  })
    .then((r) => {
      if (!r.ok) console.log(`n8n forward failed: HTTP ${r.status}`)
    })
    .catch(() => console.log('n8n forward failed: network error'))
  c.executionCtx.waitUntil(forward)

  return c.json({ ok: true })
})

// HMAC-SHA256(raw body, META_APP_SECRET) must equal the sha256=<hex> header.
// crypto.subtle.verify does the comparison in constant time.
export async function verifyMetaSignature(
  secret: string | undefined,
  rawBody: string,
  header: string | undefined,
): Promise<boolean> {
  if (!secret || !header?.startsWith('sha256=')) return false
  const hex = header.slice('sha256='.length)
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) return false
  const sig = new Uint8Array(32)
  for (let i = 0; i < 32; i++) sig[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)

  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  return crypto.subtle.verify('HMAC', key, sig, enc.encode(rawBody))
}
