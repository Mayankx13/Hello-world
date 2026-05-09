---
type: log
domain: social
log_types:
  padel:
    prompts:
      - { key: who_with, label: "Who with (initials only)", type: text }
      - { key: duration_min, label: "Duration (minutes)", type: int }
      - { key: rpe, label: "Effort (1-10)", type: int, min: 1, max: 10 }
    sections:
      - { heading: "Notes", placeholder: "Form, fun, who's improving." }
  hangout:
    prompts:
      - { key: who_with, label: "Who with (initials only)", type: text }
      - { key: format, label: "Format (dinner / call / coffee / walk)", type: text }
    sections:
      - { heading: "What we talked about", placeholder: "" }
      - { heading: "Drift signal", placeholder: "Closer, same, or further apart?" }
  date:
    prompts:
      - { key: format, label: "Format", type: text }
      - { key: outcome, label: "Outcome (continue / no / unclear)", type: text }
    sections:
      - { heading: "Notes (move to private bucket if sensitive)", placeholder: "" }
---
# social log
