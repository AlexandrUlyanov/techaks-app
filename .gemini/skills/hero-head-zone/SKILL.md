---
name: hero-head-zone
description: Specialist skill for building visually stunning, award-worthy HERO / HEAD sections of websites. Use this skill EVERY time the user asks to create, design, or improve a hero section, header zone, above-the-fold area, landing screen, first screen, opening section, or any "head" part of a web page.
---

# Hero / Head Zone Skill

You are a specialist in building stunning **hero sections** — the first thing a visitor sees on a website.
Your hero sections should feel like Awwwards, Apple.com, or Stripe — immediate, purposeful, jaw-dropping.

> **Scope**: This skill covers ONLY the hero/head zone (viewport height: 100vh).

---

## Hero Anatomy — Required Elements

Every hero section MUST have these layers (in z-order from back to front):

1. **Background Layer** — WebGL / Canvas / CSS gradient / video
2. **Atmospheric FX** — grain, glow blobs, fog, particles
3. **Content Layer** — nav + headline + sub + CTA buttons
4. **Foreground Detail** — floating objects, overlays, decorative elements
5. **Interaction Layer** — cursor, scroll hint, hover effects

---

## Step 1 — Clarify the Concept

Before writing any code, ask yourself (or the user):

1. **What is the product/brand?** (tech, luxury, creative, SaaS, game, etc.)
2. **What emotion should the hero evoke?** (trust, excitement, mystery, power, elegance)
3. **Does the user have content?** (headline text, logo, CTA label, brand colors?)
4. **What device priority?** (desktop-first or mobile-first?)

If the user is vague — pick a compelling concept and state your assumption.

---

## Step 2 — Choose the Background Effect

Read `references/backgrounds.md` for full code patterns. Quick decision guide:

| Vibe                 | Best Background                              |
| -------------------- | -------------------------------------------- |
| Tech / AI / SaaS     | WebGL shader (noise field, flowing gradient) |
| Luxury / Fashion     | Dark solid + grain overlay + subtle glow     |
| Creative / Agency    | Particle system or geometry mesh             |
| Startup / Product    | CSS gradient + CSS blob animation            |
| Game / Entertainment | Video loop or dynamic canvas                 |
| Editorial / Minimal  | Pure typography on dark/white, no bg effect  |

**Rule**: one strong background effect beats multiple weak ones. Less is more.

---

## Step 3 — Compose the Content Layer

### Layout Variants:

- **A) Centered Monolith** — headline centered, everything stacked.
- **B) Left-Aligned Power** — headline left, visual element right.
- **C) Full-Width Editorial** — large type fills width, minimal UI.
- **D) Split Screen** — 50/50 left text / right visual.

Read `references/typography.md` for animation patterns and font pairings.

---

## Step 4 — Entrance Animations (mandatory)

Every hero needs an entrance sequence. Use GSAP timeline.
Timing rule: full entrance sequence = 1.5–2.5 seconds total.

See `references/animations.md` for full character split, word reveal, and scroll-out patterns.

---

## Step 5 — Components

Every hero includes:

1. **Navigation Bar**: Transparent on load → frosted on scroll.
2. **CTA Buttons**: Primary + secondary pair. Consider magnetic effects for a premium feel.
3. **Scroll Indicator**: Always include a scroll hint at the bottom of the hero.
4. **Custom Cursor**: Optional, for premium feel on desktop.

See `references/components.md` for full CSS and JS patterns for these elements.

---

## Output Checklist

Before finalizing any hero section, verify:

- [ ] Background effect is purposeful and visible.
- [ ] Headline uses fluid `clamp()` sizing and tight line-height.
- [ ] Entrance animation runs on page load (GSAP timeline).
- [ ] Nav bar is present and has scroll-state transition.
- [ ] At least one CTA button with hover/magnetic effect.
- [ ] Scroll indicator at bottom of hero.
- [ ] `prefers-reduced-motion` is respected.
- [ ] Canvas/WebGL has resize handler (if used).
