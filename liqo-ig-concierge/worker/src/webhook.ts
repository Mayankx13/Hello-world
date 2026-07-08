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
  // Accept a signature from either the Messenger or the Instagram app secret;
  // the two Meta apps can sign X-Hub-Signature-256 with different secrets.
  const valid = await verifyMetaSignature([c.env.META_APP_SECRET, c.env.IG_APP_SECRET], raw, signature)
  if (!valid) return c.json({ error: 'invalid signature' }, 401)

  // Forward the payload unchanged (headers included so n8n can re-verify),
  // in the background — Meta gets its 200 without waiting on n8n. When
  // N8N_WEBHOOK_URL is unset (e.g. an infrastructure deploy before the DM
  // loop is wired), skip forwarding rather than fetch an undefined URL.
  const target = c.env.N8N_WEBHOOK_URL
  if (target) {
    const forward = fetch(target, {
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
  } else {
    console.log('n8n forwarding skipped: N8N_WEBHOOK_URL not set')
  }

  return c.json({ ok: true })
})

// HMAC-SHA256(raw body, app secret) must equal the sha256=<hex> header.
// Accepts one secret or a list, and passes if ANY candidate validates the
// signature — the Instagram and Messenger apps may sign with different app
// secrets. Empty/undefined candidates are skipped; with none left it fails
// closed. crypto.subtle.verify does each comparison in constant time.
export async function verifyMetaSignature(
  secrets: string | Array<string | undefined> | undefined,
  rawBody: string,
  header: string | undefined,
): Promise<boolean> {
  if (!header?.startsWith('sha256=')) return false
  const hex = header.slice('sha256='.length)
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) return false
  const candidates = (Array.isArray(secrets) ? secrets : [secrets]).filter((s): s is string => !!s)
  if (candidates.length === 0) return false

  const sig = new Uint8Array(32)
  for (let i = 0; i < 32; i++) sig[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  const body = new TextEncoder().encode(rawBody)

  for (const secret of candidates) {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    if (await crypto.subtle.verify('HMAC', key, sig, body)) return true
  }
  return false
}
