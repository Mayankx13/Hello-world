---
type: log
domain: growth
log_types:
  build:
    prompts:
      - { key: project, label: "Project name", type: text }
      - { key: stack, label: "Stack (claude-api / agents-sdk / mcp / other)", type: text }
      - { key: time_min, label: "Time spent (minutes)", type: int }
    sections:
      - { heading: "What I built", placeholder: "" }
      - { heading: "What I learned", placeholder: "" }
  read:
    prompts:
      - { key: source, label: "Source (book / paper / blog / video)", type: text }
      - { key: title, label: "Title", type: text }
    sections:
      - { heading: "One takeaway", placeholder: "Worth using how?" }
  visa_step:
    prompts:
      - { key: step, label: "Step (DS-160 / docs / slot / interview / other)", type: text }
      - { key: status, label: "Status (in-progress / done / blocked)", type: text }
    sections:
      - { heading: "Notes (no PII)", placeholder: "Document specifics go to private bucket." }
---
# growth log
