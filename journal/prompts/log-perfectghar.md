---
type: log
domain: perfectghar
log_types:
  experiment:
    prompts:
      - { key: channel, label: "Channel (meta_ads / google / whatsapp / referral / organic)", type: text }
      - { key: spend_inr, label: "Spend (INR)", type: int }
      - { key: leads, label: "Leads generated", type: int }
      - { key: qualified, label: "Qualified leads", type: int }
    sections:
      - { heading: "Hypothesis", placeholder: "What were you testing?" }
      - { heading: "Result", placeholder: "What happened? CAC?" }
      - { heading: "Next", placeholder: "Continue / kill / iterate." }
  interview:
    prompts:
      - { key: persona, label: "Persona (buyer / broker / seller)", type: text }
      - { key: budget_band, label: "Budget band", type: text }
      - { key: timeline, label: "Decision timeline", type: text }
    sections:
      - { heading: "Top pain points", placeholder: "Verbatim if possible." }
      - { heading: "Insights", placeholder: "" }
  call:
    prompts:
      - { key: lead_id, label: "Lead identifier (no PII)", type: text }
      - { key: outcome, label: "Outcome (interested / not_now / reject / handoff)", type: text }
    sections:
      - { heading: "Notes", placeholder: "" }
---
# perfectghar log
