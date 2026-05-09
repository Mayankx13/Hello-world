---
type: log
domain: finance
log_types:
  filing:
    prompts:
      - { key: kind, label: "Kind (TDS / ITR / LLP / GST / other)", type: text }
      - { key: status, label: "Status (drafted / submitted / acknowledged / closed)", type: text }
    sections:
      - { heading: "Notes", placeholder: "Reference numbers go to private bucket." }
  decision:
    prompts:
      - { key: amount_band, label: "Amount band (small / medium / large)", type: text }
      - { key: category, label: "Category (sip / insurance / spend / loan / sip-paused)", type: text }
    sections:
      - { heading: "Decision", placeholder: "" }
      - { heading: "Rationale", placeholder: "" }
  sip:
    prompts:
      - { key: action, label: "Action (started / paused / changed_amount / changed_fund)", type: text }
    sections:
      - { heading: "Allocation rationale", placeholder: "" }
---
# finance log
