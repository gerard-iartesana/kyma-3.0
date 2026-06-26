# Design System Creation from Scratch

Skill for creating cohesive, premium design systems when no Figma reference exists. Apply this whenever building a new UI from scratch.

## Color Palette Generation

Never use raw CSS named colors (red, blue, green). Build palettes with intention.

### Method: HSL-Based Harmony
Pick a brand hue, then derive the full palette:

```css
:root {
  /* Brand — pick ONE hero hue */
  --hue-brand: 230;

  /* Primary scale (brand hue) */
  --color-primary-50:  hsl(var(--hue-brand) 70% 97%);
  --color-primary-100: hsl(var(--hue-brand) 65% 92%);
  --color-primary-200: hsl(var(--hue-brand) 60% 82%);
  --color-primary-300: hsl(var(--hue-brand) 55% 70%);
  --color-primary-400: hsl(var(--hue-brand) 55% 58%);
  --color-primary-500: hsl(var(--hue-brand) 55% 48%);  /* main */
  --color-primary-600: hsl(var(--hue-brand) 58% 40%);
  --color-primary-700: hsl(var(--hue-brand) 60% 32%);
  --color-primary-800: hsl(var(--hue-brand) 62% 24%);
  --color-primary-900: hsl(var(--hue-brand) 65% 16%);

  /* Accent — complementary or analogous hue */
  --hue-accent: calc(var(--hue-brand) + 150);

  /* Neutrals — desaturated brand hue for cohesion */
  --color-neutral-50:  hsl(var(--hue-brand) 10% 98%);
  --color-neutral-100: hsl(var(--hue-brand) 8% 94%);
  --color-neutral-200: hsl(var(--hue-brand) 8% 86%);
  --color-neutral-300: hsl(var(--hue-brand) 6% 72%);
  --color-neutral-400: hsl(var(--hue-brand) 5% 56%);
  --color-neutral-500: hsl(var(--hue-brand) 4% 42%);
  --color-neutral-600: hsl(var(--hue-brand) 5% 32%);
  --color-neutral-700: hsl(var(--hue-brand) 6% 22%);
  --color-neutral-800: hsl(var(--hue-brand) 8% 14%);
  --color-neutral-900: hsl(var(--hue-brand) 10% 8%);

  /* Semantic */
  --color-success: hsl(152 55% 42%);
  --color-warning: hsl(38 92% 50%);
  --color-error:   hsl(0 72% 51%);
  --color-info:    hsl(205 78% 52%);
}
```

### Curated Palettes by Industry

| Sector | Brand Hue | Accent Hue | Mood |
|---|---|---|---|
| Legal / Finance | 220–235 | 38–45 (gold) | Trust, authority |
| Real Estate / Hospitality | 160–180 | 30–40 (warm) | Elegance, calm |
| Health / Wellness | 155–170 | 340–350 (rose) | Freshness, care |
| Tech / SaaS | 250–270 | 160–175 (teal) | Innovation, modernity |
| Food / Lifestyle | 15–30 | 140–160 (green) | Warmth, appetite |
| Creative / Design | 280–310 | 50–60 (gold) | Bold, expressive |

### Dark Mode Strategy
```css
[data-theme="dark"] {
  --color-bg:       var(--color-neutral-900);
  --color-surface:  var(--color-neutral-800);
  --color-border:   var(--color-neutral-700);
  --color-text:     var(--color-neutral-100);
  --color-text-muted: var(--color-neutral-400);
  /* Primary stays vibrant but shift lightness up */
  --color-primary:  hsl(var(--hue-brand) 60% 65%);
}
```

## Typography System

### Font Pairing Rules
Always use 2 fonts max. Pair a distinctive heading font with a readable body font.

| Style | Heading | Body | Use case |
|---|---|---|---|
| Elegant | Playfair Display | Inter | Legal, luxury, hospitality |
| Modern Clean | Outfit | Inter | SaaS, tech, dashboards |
| Professional | DM Serif Display | DM Sans | Finance, corporate |
| Friendly | Bricolage Grotesque | Nunito Sans | Startups, apps |
| Bold Editorial | Clash Display | Satoshi | Creative, portfolio |
| Minimal | Geist | Geist Mono | Dev tools, minimal |

### Fluid Type Scale
```css
:root {
  --text-xs:   clamp(0.75rem, 0.7rem + 0.15vw, 0.8rem);
  --text-sm:   clamp(0.8rem, 0.76rem + 0.2vw, 0.9rem);
  --text-base: clamp(0.95rem, 0.88rem + 0.25vw, 1.06rem);
  --text-lg:   clamp(1.1rem, 1rem + 0.4vw, 1.3rem);
  --text-xl:   clamp(1.35rem, 1.15rem + 0.65vw, 1.7rem);
  --text-2xl:  clamp(1.7rem, 1.35rem + 1.1vw, 2.25rem);
  --text-3xl:  clamp(2.1rem, 1.6rem + 1.6vw, 3rem);
  --text-4xl:  clamp(2.6rem, 1.85rem + 2.4vw, 4rem);

  --leading-tight:  1.2;
  --leading-normal: 1.5;
  --leading-relaxed: 1.7;

  --tracking-tight:  -0.02em;
  --tracking-normal:  0;
  --tracking-wide:    0.05em;
}
```

### Google Fonts Import Pattern
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
```

## Spacing & Layout

### Spacing Scale (8px base)
```css
:root {
  --space-1:  0.25rem;  /* 4px */
  --space-2:  0.5rem;   /* 8px */
  --space-3:  0.75rem;  /* 12px */
  --space-4:  1rem;     /* 16px */
  --space-5:  1.25rem;  /* 20px */
  --space-6:  1.5rem;   /* 24px */
  --space-8:  2rem;     /* 32px */
  --space-10: 2.5rem;   /* 40px */
  --space-12: 3rem;     /* 48px */
  --space-16: 4rem;     /* 64px */
  --space-20: 5rem;     /* 80px */
  --space-24: 6rem;     /* 96px */
  --space-32: 8rem;     /* 128px */
}
```

### Section Spacing
```css
.section {
  padding-block: var(--space-20);  /* generous vertical breathing */
}
.section + .section {
  padding-top: 0;  /* collapse between consecutive sections */
}
.container {
  max-width: 1200px;
  margin-inline: auto;
  padding-inline: var(--space-6);
}
```

## Elevation & Depth

### Shadow Scale
```css
:root {
  --shadow-xs:  0 1px 2px hsl(var(--hue-brand) 10% 20% / 0.05);
  --shadow-sm:  0 1px 3px hsl(var(--hue-brand) 10% 20% / 0.08),
                0 1px 2px hsl(var(--hue-brand) 10% 20% / 0.04);
  --shadow-md:  0 4px 6px -1px hsl(var(--hue-brand) 10% 20% / 0.08),
                0 2px 4px -2px hsl(var(--hue-brand) 10% 20% / 0.04);
  --shadow-lg:  0 10px 15px -3px hsl(var(--hue-brand) 10% 20% / 0.08),
                0 4px 6px -4px hsl(var(--hue-brand) 10% 20% / 0.04);
  --shadow-xl:  0 20px 25px -5px hsl(var(--hue-brand) 10% 20% / 0.1),
                0 8px 10px -6px hsl(var(--hue-brand) 10% 20% / 0.04);
}
```

### Glassmorphism
```css
.glass {
  background: hsl(0 0% 100% / 0.6);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid hsl(0 0% 100% / 0.3);
  border-radius: var(--radius-lg);
}
[data-theme="dark"] .glass {
  background: hsl(var(--hue-brand) 15% 12% / 0.7);
  border-color: hsl(0 0% 100% / 0.08);
}
```

### Border Radius Scale
```css
:root {
  --radius-sm:   6px;
  --radius-md:   10px;
  --radius-lg:   16px;
  --radius-xl:   24px;
  --radius-full: 9999px;
}
```

## Gradient Recipes

```css
/* Subtle brand gradient for hero backgrounds */
.gradient-hero {
  background: linear-gradient(
    135deg,
    hsl(var(--hue-brand) 60% 52%) 0%,
    hsl(calc(var(--hue-brand) + 30) 65% 48%) 100%
  );
}

/* Mesh gradient (CSS only) */
.gradient-mesh {
  background-color: hsl(var(--hue-brand) 55% 50%);
  background-image:
    radial-gradient(at 20% 80%, hsl(calc(var(--hue-brand) + 40) 70% 60%) 0, transparent 50%),
    radial-gradient(at 80% 20%, hsl(calc(var(--hue-brand) - 20) 65% 55%) 0, transparent 50%),
    radial-gradient(at 50% 50%, hsl(var(--hue-brand) 40% 65%) 0, transparent 60%);
}

/* Text gradient */
.text-gradient {
  background: linear-gradient(135deg, var(--color-primary-400), var(--color-primary-600));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Border gradient */
.border-gradient {
  border: 2px solid transparent;
  background-clip: padding-box;
  background-origin: border-box;
  background-image:
    linear-gradient(var(--color-bg), var(--color-bg)),
    linear-gradient(135deg, var(--color-primary-400), var(--color-accent));
}
```

## Rules

- ALWAYS derive neutrals from the brand hue — never use pure gray
- ALWAYS use fluid `clamp()` for font sizes — never fixed px
- ALWAYS pair maximum 2 fonts
- Shadows should be tinted with the brand hue, not pure black
- Generous whitespace beats dense content — let designs breathe
- Accent color used sparingly: CTAs, badges, highlights only
