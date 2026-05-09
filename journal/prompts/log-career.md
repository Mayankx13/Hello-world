---
type: log
domain: career
log_types:
  outbound:
    prompts:
      - { key: company, label: "Company", type: text }
      - { key: role, label: "Role", type: text }
      - { key: contact, label: "Contact (role only, no PII)", type: text }
      - { key: channel, label: "Channel (linkedin / referral / cold-email / job-board)", type: text }
    sections:
      - { heading: "Hook", placeholder: "Why this company, why this role." }
      - { heading: "Status", placeholder: "Reply received? Next step?" }
  interview:
    prompts:
      - { key: company, label: "Company", type: text }
      - { key: stage, label: "Stage (recruiter / phone-screen / sys-design / behavioral / take-home / onsite)", type: text }
      - { key: outcome, label: "Outcome (next_round / reject / pending / declined)", type: text }
    sections:
      - { heading: "Questions asked", placeholder: "" }
      - { heading: "Went well", placeholder: "" }
      - { heading: "Didn't", placeholder: "" }
  network:
    prompts:
      - { key: who, label: "Who (role only)", type: text }
      - { key: format, label: "Format (coffee / call / dm)", type: text }
    sections:
      - { heading: "What I learned", placeholder: "" }
---
# career log
