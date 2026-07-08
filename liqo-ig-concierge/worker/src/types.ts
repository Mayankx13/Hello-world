export type Env = {
  DB: D1Database

  // Secrets — set with `wrangler secret put <NAME>` (local dev: worker/.dev.vars)
  META_VERIFY_TOKEN: string // Meta webhook GET verification token (you choose it)
  META_APP_SECRET: string   // Meta (Messenger) app secret, signs X-Hub-Signature-256
  IG_APP_SECRET?: string    // Instagram app secret; webhook accepts a signature from this OR META_APP_SECRET
  N8N_WEBHOOK_URL: string   // where verified webhook payloads are forwarded
  DASH_API_KEY: string      // required in X-Api-Key on every /api/* request

  // Vars (wrangler.toml [vars])
  USD_INR?: string          // ₹ per USD for cost conversion, default 87
}

export const LEAD_STATUSES = [
  'new',
  'called',
  'visit_committed',
  'visited',
  'converted',
  'lost',
] as const

export type LeadStatus = (typeof LEAD_STATUSES)[number]

export const MATCH_METHODS = ['code', 'phone', 'manual'] as const
