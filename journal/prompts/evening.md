---
type: evening
prompts:
  - { key: energy, label: "Energy today (1-10)", type: int, min: 1, max: 10 }
  - { key: sleep_hours, label: "Sleep last night (hours)", type: float }
  - { key: training_status, label: "Training today", type: choice, options: ["done", "partial", "skipped", "rest_day"] }
  - { key: derma_status, label: "Skin / derma side-effects today", type: choice, options: ["none", "mild", "moderate", "flag"] }
sections:
  - { heading: "Wins", placeholder: "What actually worked? Be specific." }
  - { heading: "Friction", placeholder: "What got in the way?" }
  - { heading: "Avoided", placeholder: "What did I dodge today (and why)?" }
  - { heading: "Who I spent time with", placeholder: "Real time, not just slack/text." }
  - { heading: "Lesson", placeholder: "One sentence worth keeping." }
---
# Evening reflection
