# Nalana Design System

## Overview

**nalana** is a standalone, AI-native 3D creation software for individual creators. You talk to it — by voice or text — and it builds. It is not a Blender plugin or a Blender skin. It is its own software, built on Blender's rendering and geometry engine the way Android is built on Linux. The interface is gone. The friction is gone. You just create.

**Core product promise:** Speak your imagination into reality. No menus. No shortcuts. Just your voice.

**Founder:** Clarence Keith, USC Iovine and Young Academy — 6+ years Blender experience, 120+ students taught.

---

## Sources

This design system was assembled from:

- **Figma — Nalana rebrand (Copy).fig** — 99 pitch/brand frames. Primary source for slide layouts, color usage, typography, logo usage.  
  *(Figma link not provided; contact team to access original)*
- **Figma — Nalana — IDE Chat Panel.fig** — 12 frames for the in-app IDE chat panel (Frame 113 is the primary reference).  
  *(Figma link not provided)*
- **Figma — nalana demo banner.fig** — 1 banner frame.  
  *(Figma link not provided)*
- **Figma — New Nalana Pitch Deck.fig** — 137 slides for the full investor pitch deck.  
  *(Figma link not provided)*
- **GitHub — cekeith999/Nalana-site** — Marketing website source (`index.html`). Full CSS + JS. Live at nalana.io.
- **GitHub — Nalanaio/Nalana-Fork-IDE** (private) — The core application — a fork of the Blender engine with a `source/blender/nalana/` module containing telemetry C code. The IDE UI code is not in this repo slice.
- **Uploaded assets** — `NALANA.svg`, `Nalana Black.png`, `Nalana N.png`, `Nalana Off-White.png`, `Nalana White.png`, `nalana (1).svg`

---

## Products

| Product | Description | Source |
|---|---|---|
| **nalana.io marketing site** | Landing page with hero, features, waitlist/reserve CTA | cekeith999/Nalana-site |
| **nalana IDE** | The standalone 3D creation app — Blender engine + AI chat panel overlay | Nalanaio/Nalana-Fork-IDE + Figma IDE Panel |
| **Pitch Deck** | Investor presentation — 16:9 slides, light/off-white bg | New Nalana Pitch Deck.fig |

---

## CONTENT FUNDAMENTALS

### Voice & Tone
- **Short. Declarative. Confident.** Sentences land like punches. "Speak it. Watch it build." Not "Our AI-powered platform enables users to create."
- **Transformative, not technical.** This changes how you create — not what features you get. Lead with feeling.
- **Creative tool, not productivity tool.** It's for artists. Speak to the feeling of making, not the efficiency.
- **No startup jargon.** Never "revolutionize," "disrupt," "leverage," or "empower." Avoid "the future of X."
- **No em dashes.** Use periods. Short sentences.
- **Lowercase brand name.** Always "nalana" — never "Nalana" in logotype. (Exception: sentence-start in body copy.)

### Casing
- Brand name: always lowercase — `nalana`
- Section headers: Title Case
- Eyebrow labels/pills: ALL CAPS, tight tracking
- CTAs: Sentence case ("Reserve Founding Spot — $1 →")

### Person
- Second person ("you," "your") in all user-facing copy
- First person plural ("we") sparingly, only in founder-adjacent contexts
- No third-person marketing ("users can…")

### Tone Examples (from actual copy)
- "Speak it. Watch it build." — hero tagline
- "Speak It Into Existence." — section header (bold, large)
- "The fastest way from idea to 3D model." — tagline variant
- "3D creation, reimagined." — section title
- "Built by a creator, for creators." — about section
- "Nalana Does What No Single Competitor Can" — competitive slide

### Emoji & Special Chars
- **No emoji** in product UI or formal copy
- `✦` (✦) used sparingly as a decorative bullet/accent in success messages and metric callouts on the site
- Arrow characters (`→`) used in CTAs

---

## VISUAL FOUNDATIONS

### Color System

| Token | Value | Usage |
|---|---|---|
| `--color-bg` | `#fafafa` | Page/app background |
| `--color-bg-off-white` | `#f1f1f1` | Slide backgrounds, secondary surfaces |
| `--color-primary` | `#1085EF` | Primary blue — CTAs, links, logo, highlights |
| `--color-primary-alt` | `#1286EF` | Slight variant of primary used in fills |
| `--color-salmon` | `#FF8C69` | Accent — logo shadow layer, hover accents |
| `--color-salmon-alt` | `#FF7E7E` | Warmer salmon variant used in illustrations |
| `--color-lavender` | `#A78ADE` | Secondary accent — shadows, glows |
| `--color-sunshine` | `#F8D06C` | Tertiary accent — callout highlights |
| `--color-ink` | `#343434` | Primary text color (slides/deck) |
| `--color-ink-deep` | `#0a0a0a` | Deepest text — headings on site |
| `--color-ink-body` | `#1a1a1a` | Body text |
| `--color-muted` | `#767676` | Muted/secondary text, strokes |
| `--color-border` | `#e4e4e7` | UI borders |
| `--color-white` | `#ffffff` | Pure white |

**Color vibe:** Clean off-white canvas with a single strong blue primary. Salmon/orange is a warm counterpart to the cool blue — used for the logo's depth shadow layer and as an illustration accent. Lavender is a subtle third accent for glows/shadows. Sunshine yellow appears in data callouts. The overall palette reads "precise and alive," not sterile.

### Typography

**Display / Headings:** `Amulya` (Fontshare — weights 400/500/600/700)  
**Body / UI:** `Inter` (Google Fonts — weights 400/500/600/700)  
**Pitch Deck headings:** `Helvetica Neue` (Bold/Light/Regular/Medium/Thin) — used throughout the pitch deck Figma  
**Secondary deck body:** `DM Sans` (Medium/Regular/Bold)  

**Type scale (site):**
- Hero headline: `clamp(48px, 7vw, 88px)`, weight 700, tracking −0.02em, Amulya
- Section title: `40px`, weight 700, Amulya
- Quote text: `32px`, weight 600, Amulya
- Body: `16px` / `15px`, weight 400/500, Inter
- Caption/eyebrow: `12px`, weight 600, ALL CAPS, tracking +0.05em, Inter

**Type scale (deck):**
- Giant header: `80px`, Helvetica Neue Bold
- Section title: `40px`, Helvetica Neue Bold
- Body: `30px`, Helvetica Neue Light/Regular
- Small UI: `20px`, Helvetica Neue Medium

### Backgrounds
- Site: `#fafafa` — flat off-white, almost white. Alive with the animated dot grid and 3D Three.js blob.
- Slides: `#f1f1f1` — slightly deeper off-white. Clean, no textures.
- App/IDE: Dark background — deep charcoal/near-black (from IDE panel Figma context)
- No full-bleed photography. No heavy texture patterns.
- Iridescent radial glows used as decorative blobs (blue/purple/pink gradient, blurred, low opacity, `mix-blend-mode: multiply`)

### Animation
- **Fade up on scroll:** `opacity 0 → 1`, `translateY(30px → 0)`, `0.8s ease`
- **Bubble warp:** Organic border-radius morphing, `5s ease-in-out infinite` on voice command bubble
- **Glow pulse:** Opacity oscillation `0.65–0.85`, `5s` — iridescent glow layers
- **Text fade rotate:** `fadeOut (0.4s)` → swap content → `fadeIn (0.4s)` for voice command cycling
- **3D blob:** Three.js IcosahedronGeometry with vertex noise, slow continuous rotation
- **Cursor ring:** Lerp-follow custom cursor (`0.15` lerp factor)
- No heavy bounces. Motion is smooth, organic, premium. Not playful — alive.

### Hover States
- Buttons: `translateY(-1px) scale(1.02)` + intensified box-shadow
- Nav links: soft background fill `rgba(244,244,245,0.8)`
- Cards: subtle lift (implicit via box-shadow transition)
- Glass CTA button: shadow deepens + gradient darkens

### Press/Active States
- Buttons scale down slightly (implicit CSS active)
- No explicit shrink animations in current codebase

### Borders
- UI borders: `1px solid rgba(228,228,231,0.5)` — very subtle
- Glass cards: `1px solid rgba(255,255,255,0.4)` border + `1px solid rgba(255,255,255,0.9)` top highlight
- Pill/capsule shapes: `border-radius: 100px` for nav, CTAs, stats bar
- Feature cards: `border-radius: 40px`
- Larger content cards: `border-radius: 50px`
- Input fields: `border-radius: 100px`

### Cards
- **Glass card system:** `background: rgba(255,255,255,0.4)`, `backdrop-filter: blur(16px)`, multi-layer `box-shadow` with inner top highlight + outer drop
- Inner top highlight: `inset 0px 6px 12px rgba(255,255,255,0.8)` — gives the "glass top sheen"
- Outer shadow: `0px 15px 35px rgba(0,0,0,0.1)` — soft lift
- `::before` pseudo-element: white radial gradient at top for glass glare effect
- Glass border light `::after`: diagonal gradient border via mask — top-left bright, fades around

### Shadows
- Drop: `0 15px 35px rgba(0,0,0,0.1)`
- Blue glow (CTA): `0px 8px 24px rgba(16,133,239,0.3)` → hover `0px 12px 32px rgba(16,133,239,0.45)`
- Lavender glow (logo): drop-shadow with `rgb(167,138,222)` — seen in Figma logo usage

### Spacing
- Section padding: `100px 0`
- Content max-width: `1200px`, `padding: 0 5%`
- Grid gap: `32px` (feature cards), `24px` (metrics)
- Component padding: `40px 32px` (feature card), `64px` (quote card), `48px` (form card)

### Transparency & Blur
- Blur used heavily for the glass system (`backdrop-filter: blur(16px–24px)`)
- Nav: `blur(24px)` on capsule
- Cards: `blur(16px)`
- Iridescent glows: `blur(40px)` on background blobs

### Imagery
- No photography on site. 3D renders used in pitch deck (Blender renders).
- Logo mark: The "N" — a custom S-curve letterform — blue with salmon edge shadow. 3D-rendered feel.
- Color vibe of imagery: Cool-to-warm (blue dominant, warm salmon accent). Not grain, not b&w.

### Corner Radii System
| Context | Value |
|---|---|
| Pills / nav / inputs / CTAs | `100px` |
| Feature cards | `40px` |
| Large content cards | `50px` |
| Footers | `100px` |
| Stats bar | `50px` |
| Small UI chips/tags | `100px` |

---

## ICONOGRAPHY

### Approach
- **No dedicated icon library.** The site uses inline SVG icons — simple, `stroke="currentColor"`, 2px stroke weight, Lucide-style (24×24 viewBox).
- Feature icons are minimal line icons for microphone, sun/rays, document, lightning, monitor, people.
- **No icon font, no sprite sheet.** Pure inline SVG.
- **No emoji** in any UI context.
- The "N" logomark is the brand's primary visual icon. It is a custom S-curve letterform rendered with depth.

### Logo Assets (in `assets/`)
| File | Usage |
|---|---|
| `assets/Nalana-N.png` | N mark on white bg — general use |
| `assets/Nalana-Black.png` | N mark on black bg — dark contexts |
| `assets/Nalana-Off-White.png` | N mark on off-white bg — slide/deck use |
| `assets/Nalana-White.png` | N mark on white bg — site use |
| `assets/nalana-logo-salmon.png` | Logo salmon/orange layer |
| `assets/nalana-logo-blue.png` | Logo blue layer |
| `assets/nalana-logotype-dark.png` | Full wordmark "NALANA" dark |
| `assets/nalana-logotype-light.png` | Full wordmark "NALANA" light |

### Icon Usage Rules
- Feature/UI icons: Lucide-style, stroke only, `color: #1085EF`
- Arrow CTAs: Unicode `→`
- Accent star: `✦` (used sparingly for success states / metrics)
- Logo mark should always appear with the blue-forward color — never grayscale in product contexts

---

## Quick Start

When using this design system as an agent skill:

1. **Brand a new artifact** — Import `colors_and_type.css`, use the CSS vars, load Amulya from Fontshare + Inter from Google Fonts. Copy logo SVG inline from site source or reference `assets/`.
2. **Recreate a site page** — Reference `ui_kits/nalana-site/index.html` for component patterns: glass cards, nav pill, hero layout, voice bubble, stats bar.
3. **Recreate the IDE** — Reference `ui_kits/nalana-ide/index.html` for the dark app shell: sidebar, chat messages, input row, hint chips.
4. **Make a slide** — Reference `slides/index.html` for the 16:9 deck layout, typography scale, logo placement, footer pattern.

---

## File Index

```
README.md                          ← This file (master reference)
SKILL.md                           ← Agent skill entry point
colors_and_type.css                ← CSS custom properties: colors, type, spacing, shadows
assets/                            ← All logo/brand assets
  Nalana-N.png                     ← N mark (white bg)
  Nalana-Black.png                 ← N mark (black bg)
  Nalana-Off-White.png             ← N mark (off-white bg)
  Nalana-White.png                 ← N mark (white bg)
  nalana-logo-salmon.png           ← Logo salmon layer
  nalana-logo-blue.png             ← Logo blue layer
  nalana-logotype-dark.png         ← Wordmark dark
  nalana-logotype-light.png        ← Wordmark light
preview/                           ← Design system card previews
  colors-primary.html
  colors-neutral.html
  colors-semantic.html
  type-display.html
  type-body.html
  type-scale.html
  spacing-tokens.html
  border-radius.html
  shadows.html
  glass-card.html
  buttons.html
  forms.html
  nav.html
  voice-bubble.html
  logo-brand.html
ui_kits/
  nalana-site/                     ← Marketing website UI kit
    index.html
  nalana-ide/                      ← IDE chat panel UI kit
    index.html
slides/                            ← Pitch deck slide templates
  index.html
```
