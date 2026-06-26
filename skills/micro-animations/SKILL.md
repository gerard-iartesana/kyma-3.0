# Micro-Animations & Interactions

Skill for adding polished micro-animations and interactive feedback that make UIs feel alive and premium.

## Core Transition Defaults

```css
:root {
  --ease-out:    cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-bounce: cubic-bezier(0.68, -0.6, 0.32, 1.6);

  --duration-fast:   150ms;
  --duration-normal: 250ms;
  --duration-slow:   400ms;
  --duration-slower:  600ms;
}

/* Respect user preference */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Button Interactions

```css
.btn {
  transition: all var(--duration-normal) var(--ease-out);
  transform-origin: center;
}
.btn:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}
.btn:active {
  transform: translateY(0) scale(0.98);
  transition-duration: var(--duration-fast);
}

/* Shine effect on hover */
.btn-shine {
  position: relative;
  overflow: hidden;
}
.btn-shine::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    105deg,
    transparent 40%,
    hsl(0 0% 100% / 0.2) 45%,
    hsl(0 0% 100% / 0.3) 50%,
    hsl(0 0% 100% / 0.2) 55%,
    transparent 60%
  );
  transform: translateX(-100%);
  transition: transform 0.6s var(--ease-out);
}
.btn-shine:hover::after {
  transform: translateX(100%);
}
```

## Card Interactions

```css
.card {
  transition: transform var(--duration-normal) var(--ease-out),
              box-shadow var(--duration-normal) var(--ease-out);
}
.card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-xl);
}

/* Subtle border glow */
.card-glow {
  position: relative;
}
.card-glow::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  background: linear-gradient(135deg, var(--color-primary-400), var(--color-accent));
  opacity: 0;
  transition: opacity var(--duration-normal) var(--ease-out);
  z-index: -1;
}
.card-glow:hover::before {
  opacity: 1;
}
```

## Scroll-Triggered Entrances (CSS-only)

```css
/* Use with IntersectionObserver or scroll-timeline */
.reveal {
  opacity: 0;
  transform: translateY(30px);
  transition: opacity var(--duration-slow) var(--ease-out),
              transform var(--duration-slow) var(--ease-out);
}
.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}

/* Staggered children */
.reveal-stagger > * {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity var(--duration-slow) var(--ease-out),
              transform var(--duration-slow) var(--ease-out);
}
.reveal-stagger.visible > *:nth-child(1) { transition-delay: 0ms; }
.reveal-stagger.visible > *:nth-child(2) { transition-delay: 80ms; }
.reveal-stagger.visible > *:nth-child(3) { transition-delay: 160ms; }
.reveal-stagger.visible > *:nth-child(4) { transition-delay: 240ms; }
.reveal-stagger.visible > *:nth-child(5) { transition-delay: 320ms; }
.reveal-stagger.visible > *:nth-child(6) { transition-delay: 400ms; }
.reveal-stagger.visible > * {
  opacity: 1;
  transform: translateY(0);
}
```

### Minimal IntersectionObserver
```html
<script>
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal, .reveal-stagger').forEach(el => observer.observe(el));
</script>
```

## Loading & Skeleton States

```css
/* Skeleton shimmer */
.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-neutral-200) 25%,
    var(--color-neutral-100) 50%,
    var(--color-neutral-200) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: var(--radius-sm);
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Spinner */
.spinner {
  width: 20px; height: 20px;
  border: 2.5px solid var(--color-neutral-200);
  border-top-color: var(--color-primary-500);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
```

## Navigation

```css
/* Underline slide-in on hover */
.nav-link {
  position: relative;
}
.nav-link::after {
  content: '';
  position: absolute;
  bottom: -2px; left: 0;
  width: 100%; height: 2px;
  background: var(--color-primary-500);
  transform: scaleX(0);
  transform-origin: right;
  transition: transform var(--duration-normal) var(--ease-out);
}
.nav-link:hover::after,
.nav-link[aria-current="page"]::after {
  transform: scaleX(1);
  transform-origin: left;
}

/* Mobile menu slide */
.mobile-nav {
  transform: translateX(100%);
  transition: transform var(--duration-slow) var(--ease-out);
}
.mobile-nav.open {
  transform: translateX(0);
}
```

## Tooltips & Popovers

```css
.tooltip {
  opacity: 0;
  transform: translateY(4px);
  pointer-events: none;
  transition: opacity var(--duration-fast) var(--ease-out),
              transform var(--duration-fast) var(--ease-out);
}
[data-tooltip]:hover .tooltip {
  opacity: 1;
  transform: translateY(0);
}
```

## Rules

- ALWAYS add `prefers-reduced-motion` media query
- ALWAYS use CSS transitions over JS animations when possible
- Keep durations under 600ms — fast UI feels responsive
- Use `will-change` sparingly and only on elements that animate
- Transform + opacity are GPU-accelerated — prefer them over layout props
- Stagger delays: 60–100ms between siblings looks natural
- Never animate width/height directly — use transform: scale instead
- Every interactive element needs visible hover AND focus states
