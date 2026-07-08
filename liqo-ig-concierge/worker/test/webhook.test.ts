// Acceptance criteria 1–2 ground truth: the Meta signature verifier.
// verifyMetaSignature is pure WebCrypto, so it runs identically under
// Node's globalThis.crypto and workerd.

import { describe, expect, it } from 'vitest'
import { verifyMetaSignature } from '../src/webhook'

const SECRET = 'test-app-secret-abc'
const BODY = JSON.stringify({ object: 'instagram', entry: [{ id: '123' }] })

async function sign(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ])
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(body)))
  return `sha256=${[...mac].map((b) => b.toString(16).padStart(2, '0')).join('')}`
}

describe('verifyMetaSignature', () => {
  it('accepts a genuine Meta signature', async () => {
    expect(await verifyMetaSignature(SECRET, BODY, await sign(SECRET, BODY))).toBe(true)
  })

  it('rejects a signature over a tampered body', async () => {
    const sig = await sign(SECRET, BODY)
    expect(await verifyMetaSignature(SECRET, BODY.replace('123', '999'), sig)).toBe(false)
  })

  it('rejects a signature made with the wrong secret', async () => {
    expect(await verifyMetaSignature(SECRET, BODY, await sign('attacker-secret', BODY))).toBe(false)
  })

  it('rejects a forged constant signature', async () => {
    expect(await verifyMetaSignature(SECRET, BODY, `sha256=${'a'.repeat(64)}`)).toBe(false)
  })

  it('rejects missing/malformed headers and empty secret', async () => {
    expect(await verifyMetaSignature(SECRET, BODY, undefined)).toBe(false)
    expect(await verifyMetaSignature(SECRET, BODY, 'sha1=abcd')).toBe(false)
    expect(await verifyMetaSignature(SECRET, BODY, 'sha256=nothex')).toBe(false)
    expect(await verifyMetaSignature(SECRET, BODY, 'sha256=abc')).toBe(false)
    expect(await verifyMetaSignature('', BODY, await sign(SECRET, BODY))).toBe(false)
  })

  it('is case-insensitive on the hex digest', async () => {
    const sig = await sign(SECRET, BODY)
    expect(await verifyMetaSignature(SECRET, BODY, sig.toUpperCase().replace('SHA256=', 'sha256='))).toBe(true)
  })
})

// The webhook passes a [META_APP_SECRET, IG_APP_SECRET] candidate list so a
// DM signed by either Meta app is accepted.
describe('verifyMetaSignature — either app secret', () => {
  const META = 'meta-app-secret'
  const IG = 'ig-app-secret'
  const BOTH = [META, IG]

  it('accepts a signature made with META_APP_SECRET', async () => {
    expect(await verifyMetaSignature(BOTH, BODY, await sign(META, BODY))).toBe(true)
  })

  it('accepts a signature made with IG_APP_SECRET', async () => {
    expect(await verifyMetaSignature(BOTH, BODY, await sign(IG, BODY))).toBe(true)
  })

  it('rejects a signature made with neither secret', async () => {
    expect(await verifyMetaSignature(BOTH, BODY, await sign('some-other-secret', BODY))).toBe(false)
  })

  it('rejects a tampered body regardless of which secret signed it', async () => {
    const tampered = BODY.replace('123', '999')
    expect(await verifyMetaSignature(BOTH, tampered, await sign(META, BODY))).toBe(false)
    expect(await verifyMetaSignature(BOTH, tampered, await sign(IG, BODY))).toBe(false)
  })

  it('skips undefined/empty candidates but still matches a real one', async () => {
    expect(await verifyMetaSignature([undefined, IG, ''], BODY, await sign(IG, BODY))).toBe(true)
    expect(await verifyMetaSignature([undefined, ''], BODY, await sign(IG, BODY))).toBe(false)
  })
})
