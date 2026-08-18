# Tarka Design Config

Personality: calm, exam-room-serious but not cold — this is a test-taking tool, clarity beats decoration. No purple gradients, no glassmorphism, no generic AI-startup look.

## Colors

| Role | Token | Value | Usage |
|------|-------|-------|-------|
| Primary | --color-primary | #2b5fd9 | Primary buttons, links, active nav, focus rings |
| Primary hover | --color-primary-hover | #234db3 | Hover state on primary buttons/links |
| Ink | --color-ink | #1a1d23 | Headings, primary text |
| Body text | --color-body | #3c4149 | Paragraphs, labels |
| Muted | --color-muted | #6b7280 | Secondary text, hints, timestamps |
| Border | --color-border | #dde1e6 | Card/input borders, dividers |
| Surface | --color-surface | #ffffff | Card backgrounds |
| Background | --color-bg | #f4f5f7 | Page background |
| Success | --color-success | #1a7f4e | Correct answers, approved, released |
| Success bg | --color-success-bg | #e6f6ee | Success badges/backgrounds |
| Danger | --color-danger | #b00020 | Errors, denied, time's up |
| Danger bg | --color-danger-bg | #fbe9eb | Error/danger badges/backgrounds |
| Warning | --color-warning | #9a6700 | Pending states, low-time warnings |
| Warning bg | --color-warning-bg | #fff3d6 | Warning badges/backgrounds |

## Typography

- Font family: system font stack (`-apple-system, "Segoe UI", Roboto, sans-serif`) — no webfont loading, keep it fast/simple.
- Scale: h1 28px/700, h2 20px/600, h3 16px/600, body 15px/400, caption 13px/400.
- Line height: 1.5 for body text, 1.25 for headings.

## Spacing

Base unit 4px. Scale: xs=4px, sm=8px, md=16px, lg=24px, xl=32px, 2xl=48px.

## Radius

- Cards/panels: 10px
- Buttons/inputs: 6px
- Badges/pills: 999px (fully rounded)

## Shadows

- sm (cards): `0 1px 2px rgba(16, 24, 40, 0.06), 0 1px 3px rgba(16, 24, 40, 0.08)`
- md (modals/dialogs): `0 4px 8px rgba(16, 24, 40, 0.1), 0 2px 4px rgba(16, 24, 40, 0.06)`

## Interaction

- All buttons/links/rows get a hover state (background or border shift, never color-only) and a visible focus ring (`box-shadow: 0 0 0 3px rgba(43, 95, 217, 0.25)`) for keyboard accessibility.
- Transitions: 150ms ease on color/background/border/shadow changes — subtle, not bouncy.
- Every list/table needs loading, empty, and error states — not just the happy path.
