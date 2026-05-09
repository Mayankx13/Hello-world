---
type: log
domain: body
log_types:
  workout:
    prompts:
      - { key: session, label: "Session (Upper A / Lower A / Upper B / Lower B / mobility / cardio)", type: text }
      - { key: top_lift, label: "Top lift (e.g. 'OHP 50kg x 5x5')", type: text }
      - { key: rpe, label: "Top set RPE (1-10)", type: int, min: 1, max: 10 }
      - { key: joint_dryness, label: "Joint dryness flag", type: choice, options: ["none", "mild", "moderate", "high"] }
    sections:
      - { heading: "Notes", placeholder: "Asymmetry, pump, anything off." }
  meal:
    prompts:
      - { key: kcal_estimate, label: "Estimated kcal", type: int }
      - { key: protein_g, label: "Protein (g)", type: int }
    sections:
      - { heading: "What I ate", placeholder: "" }
  supplement:
    prompts:
      - { key: stack, label: "Stack (creatine/omega3/mag/B12/zinc/milk_thistle/derma_rx)", type: text }
      - { key: timing, label: "Timing", type: text }
    sections:
      - { heading: "Notes", placeholder: "" }
  labs:
    prompts:
      - { key: panel, label: "Panel (lipids / LFT / HbA1c / vit-D / B12 / other)", type: text }
      - { key: trend, label: "Vs. last", type: choice, options: ["improved", "stable", "worse", "n/a"] }
    sections:
      - { heading: "Values", placeholder: "Key numbers." }
      - { heading: "Action", placeholder: "What changes from this result?" }
  skin:
    prompts:
      - { key: severity, label: "Severity (1-10)", type: int, min: 1, max: 10 }
      - { key: trigger_suspected, label: "Suspected trigger", type: text }
    sections:
      - { heading: "Notes", placeholder: "" }
---
# body log
