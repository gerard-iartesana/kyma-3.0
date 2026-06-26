# Landing Page Layout Patterns

Skill with proven section layouts and compositions for building landing pages from scratch without a design reference.

## Hero Sections

### 1. Split Hero (text left + image/visual right)
```
┌──────────────────────────────────────────┐
│  Nav: logo .............. links    CTA   │
├──────────────────────────────────────────┤
│                                          │
│  Overline tag                  ┌───────┐ │
│  Big Headline that              │       │ │
│  grabs attention               │ IMAGE │ │
│  Subtext paragraph             │       │ │
│  [Primary CTA] [Secondary]    └───────┘ │
│  Social proof / logos                    │
│                                          │
└──────────────────────────────────────────┘
```
Best for: SaaS, professional services, apps with screenshots.

### 2. Centered Hero (full-width)
```
┌──────────────────────────────────────────┐
│  Nav: logo .............. links    CTA   │
├──────────────────────────────────────────┤
│                                          │
│              Badge / tagline             │
│        Big Centered Headline             │
│     Supporting paragraph text            │
│       [Primary CTA]  [Link →]           │
│                                          │
│        ┌────────────────────┐            │
│        │   Product Preview  │            │
│        │   or Illustration  │            │
│        └────────────────────┘            │
└──────────────────────────────────────────┘
```
Best for: Product launches, creative agencies, single-product focus.

### 3. Hero with Background Visual
```
┌──────────────────────────────────────────┐
│  Nav (transparent): logo ... links  CTA  │
├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┤
│ ░░░░░░░░░ FULL BACKGROUND IMAGE ░░░░░░░ │
│ ░░░░░░░░░ with dark overlay     ░░░░░░░ │
│ ░░                                   ░░░ │
│ ░░   Large White Headline            ░░░ │
│ ░░   Description text                ░░░ │
│ ░░   [CTA Button]                    ░░░ │
│ ░░                                   ░░░ │
└──────────────────────────────────────────┘
```
Best for: Hospitality, real estate, restaurants, law firms.

## Content Sections

### Features Grid (3-column)
```
  ┌──────┐    ┌──────┐    ┌──────┐
  │ Icon │    │ Icon │    │ Icon │
  │Title │    │Title │    │Title │
  │ Text │    │ Text │    │ Text │
  └──────┘    └──────┘    └──────┘
```
CSS: `display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--space-8);`

### Alternating Feature Rows
```
  Text block ←→ Image
  Image ←→ Text block
  Text block ←→ Image
```
CSS: Use `flex-direction: row` and `:nth-child(even) { flex-direction: row-reverse; }`

### Stats / Numbers Bar
```
  ┌─────────────────────────────────────────┐
  │   150+          98%          24/7        │
  │  Clientes    Satisfacción   Soporte     │
  └─────────────────────────────────────────┘
```
Animate numbers on scroll with a counter effect.

### Testimonial Carousel
```
  ┌─────────────────────────────────────┐
  │  "Quote text that is compelling     │
  │   and builds trust..."             │
  │                                     │
  │  ○ Avatar   Name                   │
  │             Company / Role          │
  │                                     │
  │         ● ○ ○  (dots)              │
  └─────────────────────────────────────┘
```

### Pricing Cards
```
  ┌─────────┐  ┌══════════╗  ┌─────────┐
  │  Basic  │  ║ Popular  ║  │  Pro    │
  │  €X/mo  │  ║ €Y/mo    ║  │  €Z/mo  │
  │ ✓ feat  │  ║ ✓ feat   ║  │ ✓ feat  │
  │ ✓ feat  │  ║ ✓ feat   ║  │ ✓ feat  │
  │  [CTA]  │  ║  [CTA]   ║  │  [CTA]  │
  └─────────┘  ╚══════════╝  └─────────┘
```
Highlight the middle/recommended plan with elevation + accent border.

### CTA Section (pre-footer)
```
  ┌─────────────────────────────────────────┐
  │ ░░░ gradient or accent background ░░░░ │
  │ ░░                                 ░░░ │
  │ ░░   Ready to get started?         ░░░ │
  │ ░░   Compelling call to action     ░░░ │
  │ ░░   [Big Primary Button]          ░░░ │
  │ ░░                                 ░░░ │
  └─────────────────────────────────────────┘
```

## Footer

```
  ┌─────────────────────────────────────────┐
  │ Logo            Links Col 1   Col 2     │
  │ Brief tagline   Link          Link      │
  │                 Link          Link      │
  │ Social icons    Link          Link      │
  ├─────────────────────────────────────────┤
  │ © 2026 Company. Privacidad · Legal      │
  └─────────────────────────────────────────┘
```

## Page Flow Best Practices

Recommended section order for a landing page:

1. **Hero** — hook in 3 seconds
2. **Social proof** — logos / trust badges
3. **Problem** — describe the pain point
4. **Solution / Features** — how you solve it
5. **How it works** — 3-step process
6. **Testimonials** — build trust
7. **Pricing** — if applicable
8. **FAQ** — objection handling
9. **Final CTA** — last conversion push
10. **Footer** — links, legal, contact

## Responsive Breakpoints

```css
/* Mobile first */
@media (min-width: 640px)  { /* sm: large phones */ }
@media (min-width: 768px)  { /* md: tablets */ }
@media (min-width: 1024px) { /* lg: laptops */ }
@media (min-width: 1280px) { /* xl: desktops */ }
```

### Mobile Adaptations
- Split hero → stack vertically (text top, image bottom)
- Multi-column grids → single column
- Nav → hamburger menu
- Stats bar → 2×2 grid
- Pricing → horizontal scroll or stack

## Rules

- Every section needs generous vertical padding (80–120px desktop)
- Use visual hierarchy: ONE big headline per section, then supporting text
- CTAs must have high contrast against their background
- Never place two text-heavy sections consecutively — alternate with visuals
- Keep paragraphs short: max 3 lines on desktop
- Use real content when available — avoid lorem ipsum
