---
version: alpha
name: Krineo
description: "A quiet, evidence-first visual system for accountable AI market reasoning."
colors:
  primary: "#0F1115"
  onPrimary: "#FFFFFF"
  secondary: "#7C828C"
  tertiary: "#7ED957"
  onTertiary: "#0F1115"
  neutral: "#FFFFFF"
  surface: "#FFFFFF"
  surfaceSubtle: "#FAFAFA"
  heroBlue: "#DCEBFA"
  gridLine: "#E3EEF9"
  border: "#E4E4E7"
  primaryHover: "#24262B"
  positive: "#7ED957"
  positiveSoft: "#EAF8E4"
  caution: "#8A5A00"
  cautionSoft: "#FFF4D6"
  veto: "#B42318"
  onVeto: "#FFFFFF"
  info: "#2F5FA7"
  onInfo: "#FFFFFF"
  phoneFrame: "#0F1115"
  evidenceLavender: "#E8E4FB"
  evidenceTeal: "#6FCFA8"
  evidenceGold: "#F6C84C"
  evidenceBlue: "#3D7DE0"
typography:
  h1:
    fontFamily: "General Sans"
    fontSize: 42px
    fontWeight: 700
    lineHeight: 46px
    letterSpacing: "-0.5px"
  h1-editorial:
    fontFamily: "Playfair Display"
    fontSize: 42px
    fontWeight: 500
    lineHeight: 46px
    letterSpacing: "0px"
    fontVariation: "ital 1"
  h2:
    fontFamily: "General Sans"
    fontSize: 28px
    fontWeight: 700
    lineHeight: 32px
    letterSpacing: "-0.25px"
  h3:
    fontFamily: "General Sans"
    fontSize: 20px
    fontWeight: 700
    lineHeight: 24px
    letterSpacing: "0px"
  body-lg:
    fontFamily: "General Sans"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 24px
    letterSpacing: "0px"
  body-md:
    fontFamily: "General Sans"
    fontSize: 15px
    fontWeight: 400
    lineHeight: 22px
    letterSpacing: "0px"
  nav-label:
    fontFamily: "General Sans"
    fontSize: 15px
    fontWeight: 500
    lineHeight: 20px
    letterSpacing: "0px"
  button:
    fontFamily: "General Sans"
    fontSize: 15px
    fontWeight: 600
    lineHeight: 20px
    letterSpacing: "0px"
  phone-ui:
    fontFamily: "General Sans"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 18px
    letterSpacing: "0px"
  evidence-label:
    fontFamily: "General Sans"
    fontSize: 12px
    fontWeight: 600
    lineHeight: 16px
    letterSpacing: "0.06em"
  receipt-figure:
    fontFamily: "General Sans"
    fontSize: 28px
    fontWeight: 700
    lineHeight: 32px
    letterSpacing: "-0.5px"
rounded:
  sm: 10px
  md: 18px
  lg: 24px
  phone: 36px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 64px
  hero: 96px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.onPrimary}"
    rounded: "{rounded.sm}"
    padding: "14px 24px"
    height: 48px
  button-primary-hover:
    backgroundColor: "{colors.primaryHover}"
    textColor: "{colors.onPrimary}"
    rounded: "{rounded.sm}"
    padding: "14px 24px"
    height: 48px
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    padding: "14px 24px"
    height: 48px
  button-secondary-hover:
    backgroundColor: "{colors.surfaceSubtle}"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    padding: "14px 24px"
    height: 48px
  evidence-card:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 24px
  evidence-card-hover:
    backgroundColor: "{colors.surfaceSubtle}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 24px
  hero-field:
    backgroundColor: "{colors.heroBlue}"
    textColor: "{colors.primary}"
  hero-texture:
    backgroundColor: "{colors.gridLine}"
  divider:
    backgroundColor: "{colors.border}"
  provenance-badge:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.full}"
    padding: "8px 16px"
  status-supportive:
    backgroundColor: "{colors.positiveSoft}"
    textColor: "{colors.primary}"
    rounded: "{rounded.full}"
    padding: "6px 10px"
  status-eligible:
    backgroundColor: "{colors.positive}"
    textColor: "{colors.onTertiary}"
    rounded: "{rounded.full}"
    padding: "6px 10px"
  status-caution:
    backgroundColor: "{colors.cautionSoft}"
    textColor: "{colors.caution}"
    rounded: "{rounded.full}"
    padding: "6px 10px"
  status-veto:
    backgroundColor: "{colors.veto}"
    textColor: "{colors.onVeto}"
    rounded: "{rounded.full}"
    padding: "6px 10px"
  status-unknown:
    backgroundColor: "{colors.surfaceSubtle}"
    textColor: "{colors.primary}"
    rounded: "{rounded.full}"
    padding: "6px 10px"
  status-info:
    backgroundColor: "{colors.info}"
    textColor: "{colors.onInfo}"
    rounded: "{rounded.full}"
    padding: "6px 10px"
  receipt-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 24px
  floating-evidence-badge:
    backgroundColor: "{colors.evidenceLavender}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    width: 72px
    height: 72px
  floating-evidence-badge-risk:
    backgroundColor: "{colors.evidenceTeal}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    width: 72px
    height: 72px
  floating-evidence-badge-alternatives:
    backgroundColor: "{colors.evidenceGold}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    width: 72px
    height: 72px
  floating-evidence-badge-abstain:
    backgroundColor: "{colors.evidenceBlue}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    width: 72px
    height: 72px
  phone-shell:
    backgroundColor: "{colors.phoneFrame}"
    textColor: "{colors.surface}"
    rounded: "{rounded.phone}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    height: 48px
    padding: "0px 16px"
---

# Krineo Design System

## Overview

Krineo is a quiet evidence instrument: a market-reasoning workspace that turns live research into a thesis that can be compared, challenged, committed and revisited. The visual system should feel calm, precise and intellectually confident—not like a casino, a neon trading terminal or generic AI software.

The system deliberately preserves the supplied reference’s formal substrate:

- Soft blue-to-white hero gradient.
- Faint hero-only grid texture.
- Bold General Sans for structure.
- One Playfair Display serif-italic line for a single headline moment.
- Centered, spacious hero composition.
- Three realistic phone mockups showing the product rather than abstract technology imagery.
- Flat UI chrome, thin borders, restrained radii and generous whitespace.
- White card surfaces with compact, information-dense product UI.
- A recurring gray sentence with bold black inline emphasis.

The category meaning changes completely. Payment screens, coin badges, transaction history and “accepting payments” language become market evidence, opportunity comparison, KillSwitch review and Thesis Receipt surfaces.

### Visual territory: Quiet Evidence in a Soft Field

The soft blue field creates a calm stage for black typography and a single green decision signal. The interface then earns attention through hierarchy, evidence status and structured comparison—not through glow, noise or excessive colour.

### Core visual asset: Evidence Receipt Spine

The **Evidence Receipt Spine** is a thin, repeatable line-and-record structure connecting:

```text
EVIDENCE → COMPARISON → CHALLENGE → DECISION → RECEIPT → DIFF
```

It has a functional job. It appears in the hero as a quiet background motif, in the research-stage timeline, inside the Thesis Receipt, in Strategy Diff, in the archive/history view and in shareable proof assets. It makes the product’s accountability loop recognisable without becoming a decorative chain, generic progress bar or blockchain cliché.

### Preserve, replace, reinterpret

| Reference layer | Decision for Krineo |
|---|---|
| Soft blue-to-white hero gradient | **Preserve.** Use only in the hero so it remains a distinctive stage rather than a global background effect. |
| Faint grid texture | **Preserve.** Use at low opacity to suggest measured analysis, never as a technical wallpaper. |
| General Sans + one Playfair Display italic line | **Preserve.** The typographic contrast becomes evidence versus judgement, not payments versus crypto. |
| Centered hero and generous whitespace | **Preserve.** The calm composition gives the decision room to be understood. |
| Three-phone product visual | **Preserve and reinterpret.** Show Agent Workspace, Opportunity Comparison and Thesis Receipt. |
| White bordered cards and compact pill controls | **Preserve.** Apply them to evidence records, statuses and receipts. |
| Four glossy floating coin badges | **Replace in meaning.** Use four evidence tiles: `SIGNAL`, `RISK`, `ALTERNATIVES`, `ABSTAIN`. Keep the rounded tile, soft gradient and independent rotation. |
| Account/balance hub screen | **Reinterpret.** It becomes the Agent Workspace with research progress and current decision state. |
| Transaction history screen | **Reinterpret.** It becomes the append-only Thesis Receipt and its evidence record. |
| Positive balance green | **Reinterpret.** Green means supportive evidence or an eligible action—not a promise of gain. |
| Payment trust bar | **Replace.** Use a restrained proof strip: `LIVE RYO EVIDENCE · OPPORTUNITY COST · KILLSWITCH · APPEND-ONLY RECEIPTS`. |

### Product rule

> **Every decorative element must point back to a state, a decision or a piece of evidence.**

## Colors

Colour meaning is contextual, not universal. In Krineo’s context, the retained soft blue field reduces visual temperature and gives the evidence system room to breathe. Ink establishes authority and legibility. Green is a controlled signal for supportive evidence, an eligible action or positive practice-state context. Amber, red and blue are reserved for semantic status and always paired with explicit text.

### Palette and roles

| Token | HEX | RGB | Role |
|---|---|---|---|
| `primary` | `#0F1115` | `rgb(15, 17, 21)` | Headlines, primary text, primary CTA, receipt figures, phone frames. |
| `onPrimary` | `#FFFFFF` | `rgb(255, 255, 255)` | Text on ink surfaces. |
| `secondary` | `#7C828C` | `rgb(124, 130, 140)` | Nav links, metadata and quiet explanatory text. |
| `neutral` / `surface` | `#FFFFFF` | `rgb(255, 255, 255)` | Page base, evidence cards and phone screens. |
| `surfaceSubtle` | `#FAFAFA` | `rgb(250, 250, 250)` | Hover surfaces, inactive table bands and subtle grouping. |
| `heroBlue` | `#DCEBFA` | `rgb(220, 235, 250)` | Start of the hero gradient. |
| `gridLine` | `#E3EEF9` | `rgb(227, 238, 249)` | Low-opacity hero grid texture. |
| `border` | `#E4E4E7` | `rgb(228, 228, 231)` | Card borders, input borders and secondary controls. |
| `primaryHover` | `#24262B` | `rgb(36, 38, 43)` | Hover state for the ink CTA. |
| `tertiary` / `positive` | `#7ED957` | `rgb(126, 217, 87)` | Supportive evidence, eligible state and active primary action where appropriate. |
| `positiveSoft` | `#EAF8E4` | `rgb(234, 248, 228)` | Supportive status surface. |
| `caution` | `#8A5A00` | `rgb(138, 90, 0)` | AA-safe caution label and elevated-risk text on a light caution surface. |
| `cautionSoft` | `#FFF4D6` | `rgb(255, 244, 214)` | Caution surface. |
| `veto` | `#B42318` | `rgb(180, 35, 24)` | KillSwitch veto, invalidation and critical failure. Use with white text and a text label. |
| `info` | `#2F5FA7` | `rgb(47, 95, 167)` | Provenance or informational status when needed. |
| `phoneFrame` | `#0F1115` | `rgb(15, 17, 21)` | Device bezel. |
| `evidenceLavender` | `#E8E4FB` | `rgb(232, 228, 251)` | Decorative `SIGNAL` evidence tile. |
| `evidenceTeal` | `#6FCFA8` | `rgb(111, 207, 168)` | Decorative `RISK` evidence tile. |
| `evidenceGold` | `#F6C84C` | `rgb(246, 200, 76)` | Decorative `ALTERNATIVES` evidence tile. |
| `evidenceBlue` | `#3D7DE0` | `rgb(61, 125, 224)` | Decorative `ABSTAIN` evidence tile. |

### Distribution

Use the reference’s restrained visual balance rather than turning the palette into a dashboard rainbow:

- **60%** white and soft surfaces.
- **30%** ink, blue hero field and structural neutrals.
- **10%** signal and semantic accents.

The four evidence tile colours are decorative recognition cues. They do not independently communicate decision state. The state must also appear as a word, icon, pattern or structural change.

### Gradient rules

- Hero only: `#DCEBFA → #FFFFFF`, soft diagonal direction.
- Evidence tiles: small, restrained glossy gradients derived from their tile base colour; no neon bloom.
- Product UI: prefer flat fills and surface contrast. Do not carry the hero gradient into every card.
- No purple-blue AI glow, glassmorphism haze, animated mesh or ornamental gradient behind evidence.

### Accessibility

- Use `primary` on `surface` for normal text and high-emphasis content.
- Use `primary` on `positiveSoft`, `cautionSoft` and `surfaceSubtle`.
- Use `onVeto` on `veto`.
- Use explicit text labels for `SUPPORTIVE`, `CAUTION`, `VETO`, `UNKNOWN`, `ACTIVE`, `WEAKENED` and `INVALIDATED`.
- Never make green versus red the only distinction between direction or outcome.
- Test real text combinations with WCAG tooling before shipping; the formal tokens are starting values, not an excuse to skip component-level testing.

## Typography

### Font families

**Primary display and interface:** `General Sans`

Fallback: `Inter Tight`, `Inter`, `sans-serif`.

Use General Sans for the wordmark, navigation, body, controls, headings and product UI. Weight—not a second sans-serif family—creates most of the hierarchy.

**Editorial accent:** `Playfair Display`

Fallback: `Times New Roman`, `serif`.

Use Playfair Display italic for exactly one line of the hero headline. The serif moment expresses judgement and reflection against the system’s direct sans structure.

### Hero headline

Use:

```text
Market decisions
with receipts.
```

- `Market decisions` uses `General Sans` bold.
- `with receipts.` uses `Playfair Display` italic.
- The editorial treatment appears only in this one hero line on the primary landing page.

Do not use the serif italic in product UI, body copy, buttons, nav, evidence labels or secondary headings.

### Type hierarchy

| Role | Family | Desktop size | Mobile size | Weight | Line height | Tracking | Use |
|---|---|---:|---:|---:|---:|---:|---|
| Display 1 | General Sans | 42px | 28px | 700 | 46px / 32px | -0.5px | First hero line. |
| Display 1 editorial | Playfair Display italic | 42px | 28px | 500 | 46px / 32px | 0px | One hero line only. |
| H2 | General Sans | 28px | 24px | 700 | 32px / 30px | -0.25px | Major page and section heading. |
| H3 | General Sans | 20px | 18px | 700 | 24px / 22px | 0px | Card and product-section heading. |
| Body large | General Sans | 16px | 16px | 400 | 24px | 0px | Hero subhead and explanatory copy. |
| Body medium | General Sans | 15px | 15px | 400 | 22px | 0px | Supporting page and product copy. |
| Nav label | General Sans | 15px | 14px | 500 | 20px / 20px | 0px | Navigation and utility links. |
| Button | General Sans | 15px | 15px | 600 | 20px | 0px | CTA and primary controls. |
| Phone UI | General Sans | 13–14px | 13px | 400–600 | 18px | 0px | Phone screen rows, states and labels. |
| Evidence label | General Sans | 12px | 11px | 600 | 16px | 0.06em | Uppercase tool, source and status labels. |
| Receipt figure | General Sans | 28px | 24px | 700 | 32px / 28px | -0.5px | Score, coverage and decision figures. |

### Copy emphasis device

Use muted gray regular text with bold ink emphasis when a sentence needs to highlight one to three important words without changing size:

> Krineo shows **what changed** before it tells you what to do.

This pattern belongs in the landing-page subhead, trust/proof strip, receipt explanations and product microcopy. Do not bold whole paragraphs.

### Numeric and technical content

- Use General Sans with tabular numerals for scores, percentages, prices and timestamps.
- Keep tool identifiers, reason codes and hashes compact and visually subordinate.
- Never enlarge raw data until it competes with the decision.
- Use an explicit label for simulated P&L so it cannot be mistaken for proof of strategy quality.

### Performance and accessibility

- Use `font-display: swap`.
- Preload only the weights used above the fold.
- Test General Sans licensing for web, app, presentation and generated assets before public launch.
- Body copy remains at least 16px on marketing surfaces where possible.
- Support 200% text resizing and user text-spacing overrides.
- Never use italic for body text or small evidence labels.

## Layout

### Base grid

- Base unit: `4px`.
- Max content width: `1200px`, centred.
- Standard desktop side padding: `40px`.
- Mobile side padding: `20px`.
- Use a calm single-column hero before the product visual; do not force an early split layout.

### Spacing scale

| Token | Value | Use |
|---|---:|---|
| `xs` | 4px | Phone micro-spacing, icon gaps and small row padding. |
| `sm` | 8px | Pill gaps, badge padding and compact label spacing. |
| `md` | 16px | Standard component gutter and evidence-item spacing. |
| `lg` | 24px | Card padding, button horizontal rhythm and nav spacing. |
| `xl` | 32px | Heading-to-supporting-copy gap and larger card groups. |
| `xxl` | 48px | Subhead-to-CTA and major internal separation. |
| `section` | 64px | Section-to-section rhythm. |
| `hero` | 96px | Hero top padding and separation from proof/product visual. |

### Landing-page composition

1. Transparent nav: wordmark left, links centred, secondary and primary actions right.
2. Small provenance badge: `RYO READ-ONLY RESEARCH` or an equivalent truthful label.
3. Centred headline with one editorial italic line.
4. Hero subhead using gray body copy and bold ink emphasis.
5. Primary and secondary CTA pair.
6. Four floating evidence tiles around the text column.
7. Three-phone row below the text: Agent Workspace in the centre, Comparison and Receipt on the sides.
8. Proof strip in muted grayscale or ink text, not a logo wall pretending to be social proof.

### Product information hierarchy

Product screens follow this order:

```text
QUESTION → RESEARCH STATE → EVIDENCE → ALTERNATIVES
→ CHALLENGE → DECISION → INVALIDATION CONDITIONS
```

Keep the main decision, evidence coverage, conflict, freshness and next action visible. Raw provider data belongs behind progressive disclosure.

### Evidence Receipt Spine layout

Use a stable horizontal or vertical spine with records attached to it:

- Small timestamp or stage label.
- Evidence title.
- Source and freshness.
- Supporting/contradicting/unknown state.
- Short reason code.
- Optional expanded raw evidence.

The spine is not a percentage-complete indicator. It represents an auditable sequence.

### Three-phone row

- Centre phone is largest and slightly raised.
- Flanking phones are smaller, angled slightly and cropped at the bottom edge.
- All devices share the same frame, status bar, corner treatment and screen density.
- The centre phone shows Agent Workspace.
- The left phone shows Opportunity Comparison.
- The right phone shows Thesis Receipt or Strategy Diff.
- The devices show real interface structures, not oversized marketing copy.

### Whitespace

Generous space is structural. It separates the decision from supporting evidence and keeps the hero calm despite the four tiles and three phones. Do not use empty space to conceal weak content; every major gap should reinforce hierarchy.

### Responsive behaviour

| Breakpoint | Width | Behaviour |
|---|---:|---|
| Mobile | 375–599px | Centre phone only; two evidence tiles may remain; nav collapses; hero type reduces to 28px. |
| Tablet | 600–1023px | Three phones remain at reduced scale; tiles shrink and move closer to the text column. |
| Desktop | 1024–1439px | Full three-phone composition and four-tile arrangement. |
| Wide | 1440px+ | Keep content at 1200px; allow additional blue gradient bleed, not extra content density. |

Responsive priority is semantic, not merely geometric:

1. Decision and status.
2. Primary action.
3. Evidence summary.
4. Alternatives and contradiction.
5. Raw detail.
6. Decorative tile and device framing.

Minimum touch target: `44px × 44px`. Phone action controls remain `48px × 48px`.

## Elevation & Depth

Krineo uses a small shadow budget. The UI should feel considered through surface contrast, borders, spacing and typography—not floating cards everywhere.

| Level | Treatment | Use |
|---|---|---|
| Flat | No shadow | Nav, buttons, body text, evidence tables and most cards. |
| Floating | `0px 12px 24px rgba(0, 0, 0, 0.12)` | Four evidence tiles that need to read as physical objects above the hero. |
| Device | Natural realistic device depth | Phone mockups only. |

### Rules

- Buttons and navigation remain shadow-free.
- Evidence cards use a thin border rather than a drop shadow.
- Thesis Receipt cards may use a slightly stronger surface contrast, never a glossy shadow stack.
- Do not apply the floating tile shadow to every status pill.
- Do not use glow to communicate importance; use hierarchy and explicit labels.

## Shapes

### Radius scale

| Token | Value | Use |
|---|---:|---|
| `sm` | 10px | Buttons, inputs and compact controls. |
| `md` | 18px | Evidence cards, receipt cards and floating evidence tiles. |
| `lg` | 24px | Large grouped surfaces when the content needs a softer frame. |
| `phone` | 36px | Realistic phone shell. |
| `full` | 9999px | Provenance badges, status pills, tabs and avatar-like marks. |

### Card styling

The default Krineo card retains the reference’s quiet white surface:

- Background: `#FFFFFF`.
- Border: `1px solid #E4E4E7`.
- Radius: `18px`.
- Padding: `24px` on desktop; `16px` on mobile when space is constrained.
- Shadow: none.
- Header: title, state and source aligned before the body.
- Footer: timestamp, provenance and next action separated by a thin rule when needed.

Do not turn every section into a rounded container. Use flat page bands and open tables to preserve hierarchy.

### Pill rules

- Full pill is reserved for status, provenance, filters and compact metadata.
- Status pills always contain a readable status word.
- Do not use pills as decorative buttons or for every piece of body copy.

## Components

### Navigation

- Transparent background over the white/blue hero field.
- Wordmark on the left.
- Centre links: `How it reasons`, `Thesis Receipts`, `For builders`.
- Secondary action: `Explore receipts`.
- Primary action: `Find an opportunity ↗`.
- Desktop padding: `24px 40px`.
- Link colour: `#7C828C`; hover colour: `#0F1115`.
- Collapse to a hamburger below `768px` while keeping the wordmark and primary action available.

### Primary button

- Ink fill `#0F1115`.
- White text.
- `48px` height.
- `14px 24px` padding.
- `10px` radius.
- No border and no shadow.
- Small arrow suffix `↗` is permitted.
- Hover: `#24262B`.
- Use one high-emphasis primary action per screen.

Recommended labels:

- `Find a defensible opportunity ↗`
- `Start a research run ↗`
- `Commit thesis ↗`

Avoid `Trade now`, `Buy`, `Win`, `Get alpha` or other language that overstates the product.

### Secondary button

- White fill.
- Ink text.
- `1px solid #E4E4E7`.
- `48px` height.
- `14px 24px` padding.
- `10px` radius.
- No shadow.
- Hover: `#FAFAFA`.

Recommended labels:

- `Explore a Thesis Receipt`
- `See how it reasons`
- `Review the evidence`

### Provenance badge

Replaces the reference’s certification badge with truthful research provenance:

```text
[small source mark] RYO read-only research
```

- White fill.
- `1px solid #E4E4E7`.
- Full pill.
- `8px 16px` padding.
- Bold the product/source name; keep the descriptor regular.
- Never use “certified” unless an actual certification exists.

### Evidence card

Use for one normalised evidence item or one evidence family.

Required order:

1. Dimension label.
2. State: `SUPPORTIVE`, `CONTRADICTING`, `NEUTRAL` or `UNKNOWN`.
3. Plain-language finding.
4. Source/tool.
5. Observation time and freshness.
6. Optional reason code.

Use white surface, thin border, `18px` radius and no shadow. Supporting and contradicting evidence must be distinguishable through text, iconography and layout—not colour alone.

### Evidence status pills

- `SUPPORTIVE`: positive-soft fill, ink text, supportive icon/label.
- `CAUTION`: caution-soft fill, ink text, caution icon/label.
- `VETO`: veto fill, white text, explicit veto label.
- `UNKNOWN`: subtle white/gray fill, ink text, question or unavailable icon.

Do not style `UNKNOWN` as a muted form of `NEUTRAL`; it means the evidence could not be established.

### Floating evidence tiles

These preserve the reference’s glossy rounded-square devices while changing their meaning:

| Tile | Suggested label | Tile colour | Job |
|---|---|---|---|
| 1 | `SIGNAL` | Lavender `#E8E4FB` | Directional and technical evidence. |
| 2 | `RISK` | Teal `#6FCFA8` | Risk, safety and volatility context. |
| 3 | `ALTERNATIVES` | Gold `#F6C84C` | Opportunity Cost and rejected candidates. |
| 4 | `ABSTAIN` | Blue `#3D7DE0` | The right to decline a weak or unclear decision. |

- Size: `72px × 72px` desktop; `56px × 56px` mobile.
- Radius: `18px`.
- Independent rotation: `-8°` to `8°`.
- Soft shadow: `0px 12px 24px rgba(0, 0, 0, 0.12)`.
- Use simple typographic or line-art glyphs, not coin logos or generic AI symbols.
- Keep the tiles outside the text flow so the hero remains calm.

### Agent Workspace phone

The centre phone is the product hub.

- Same realistic dark phone frame and standard status bar treatment.
- Header: `Research workspace`, asset or universe selector, notification/status icon.
- Main block: current research question, stage status and evidence coverage.
- Supporting block: current market context and a compact green supportive-state marker.
- Action row: `Research`, `Compare`, `Challenge`, `More`.
- Keep UI text dense and authentic at `13–14px`.
- Do not show a fake account balance or imply live execution.

### Opportunity Comparison phone

The left phone translates the reference’s chart/list role into a decision comparison surface.

- Header: `Opportunity cost` plus current universe.
- Main block: ranked candidates with score, coverage and conflict.
- Include `ABSTAIN` as a visible candidate/outcome.
- Use a small comparison line or rank marker, not a chart wall.
- Filter pills may be `All`, `Strongest`, `Risk`, `Unknown` or time windows.
- Rejected alternatives remain readable.

### Thesis Receipt phone

The right phone shows the durable proof artifact.

- Header: `Thesis Receipt` plus version label.
- Main block: asset, `LONG`, `SHORT` or `ABSTAIN`, Thesis Strength and lifecycle status.
- Evidence spine: supporting, contradicting and unknown items.
- Footer: strategy version, timestamp, freshness and receipt hash excerpt.
- A refresh should read as a new version, never an overwritten screen.

### Strategy Diff treatment

- Use a two-column or stacked `THEN → NOW` structure.
- Show only meaningful changes first: direction, regime, risk, coverage, conflict and narrative state.
- Use a thin connector line from the changed evidence to the outcome.
- Copy should state causality: `Regime mismatch triggered invalidation.`
- Avoid animation that suggests the result is being calculated when it is already known.

### Inputs and forms

- White surface.
- `1px solid #E4E4E7`.
- `10px` radius.
- `48px` height.
- `0px 16px` horizontal padding.
- Ink focus border; visible focus ring must not rely on colour alone.
- Placeholder copy is specific: `Ask Krineo to find a defensible opportunity`.
- Error copy states what failed and what the user can do next.

### Filter pills and tabs

- Full pill, `6px 10px` padding.
- Active tab uses ink text and a clearly differentiated surface or border.
- Do not use the green accent on every active tab; reserve it for a meaningful positive/eligible state.
- Keyboard focus must remain visible.

### Trust/proof strip

Replace unverifiable “trusted by” logos with product proof:

```text
LIVE RYO EVIDENCE · OPPORTUNITY COST · KILLSWITCH · APPEND-ONLY RECEIPTS · STRATEGY DIFF
```

Use muted grayscale or ink text. Never imply customers, certifications or partnerships that do not exist.

## Do's and Don'ts

### Do

- Preserve the soft blue-to-white hero gradient and faint grid texture, but contain both to the hero.
- Keep General Sans as the structural family and Playfair Display italic for exactly one hero line.
- Use the centred hero, generous whitespace and three-phone composition to let the product UI sell the product.
- Turn the four floating tiles into `SIGNAL`, `RISK`, `ALTERNATIVES` and `ABSTAIN` evidence cues.
- Use the Evidence Receipt Spine across research, receipt, diff and share surfaces.
- Keep evidence cards white, bordered, modestly rounded and shadow-free.
- Use gray body copy with bold ink emphasis for high-value phrases.
- Keep phone UI small and information-dense so it reads as a real product.
- Make live, stale, partial, unavailable and simulated states explicit.
- Pair every semantic colour with a word, icon or structural cue.
- Keep the primary CTA calm and specific: `Find a defensible opportunity`.
- Use the green accent sparingly for supportive evidence and eligible action.
- Let `ABSTAIN` appear as a designed outcome, not an error state.

### Don't

- Do not carry payment terminology, account balances, transaction history or coin logos into Krineo.
- Do not use a generic neon trading-terminal aesthetic, purple-blue AI glow or glassmorphism.
- Do not apply the Playfair italic treatment to UI text, body copy or multiple headings.
- Do not use a gradient behind every card or make every section a floating container.
- Do not make green mean “profit” or red mean “loss” without an explicit state label.
- Do not imply that paper P&L proves reasoning quality.
- Do not hide rejected alternatives, contradictions, stale evidence or `UNKNOWN` states.
- Do not use “certified,” “trusted by,” “guaranteed,” “accurate,” “alpha” or “autonomous trading” without evidence and approval.
- Do not use coin, robot, brain, rocket, shield, candlestick or generic network symbols as the primary brand mark.
- Do not let decorative evidence tiles overlap critical copy or touch targets.
- Do not place more than one dominant CTA on a screen.
- Do not use colour as the sole indicator of direction, confidence, risk or lifecycle state.

## Implementation Notes

### Landing-page copy for the adapted hero

```text
ACCOUNTABLE AI MARKET REASONING

Market decisions
with receipts.

Krineo turns live market research into a thesis you can compare, challenge and revisit. Every decision shows its evidence, its contradictions and what would make it change.

[Find a defensible opportunity ↗] [Explore a Thesis Receipt]
```

### Brand/product boundary

The design system is an adaptation of a supplied visual reference, not a claim that Krineo owns the reference’s original brand, imagery or assets. Implement the visual mechanics with original Krineo copy, iconography, phone screens and evidence content.

### Build tokens

- Keep component definitions token-referenced as shown in the frontmatter.
- Keep semantic states separate from decorative evidence-tile colours.
- Use the same card mechanics across marketing and product, but let product evidence remain more information-dense.
- When a component requires a new colour, add and document a token before using it.
- Validate actual text/background pairings with `@google/design.md` and a browser-level accessibility check.

## Source boundary

The formal visual substrate is adapted from the supplied reference `DESIGN.md`; the product meaning, copy, evidence states and Krineo-specific visual asset are original to this system. RYO read-only research language follows the [official RYO-CHAN Hackathon 2026 page](https://ryobuild.com/hackathon). No trademark, domain, certification, customer or partnership claim is implied.
