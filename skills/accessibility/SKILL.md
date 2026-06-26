# Accessibility (a11y) — Strict

Mandatory accessibility rules for every component. Apply always, even on internal tools.

## ARIA Roles & Labels

### Every Interactive Element Needs a Label
```tsx
// ✅ Button with visible text — no extra ARIA needed
<button>Guardar cambios</button>

// ✅ Icon-only button — MUST have aria-label
<button aria-label="Eliminar propiedad"><TrashIcon /></button>

// ✅ Link that opens in new tab
<a href="/doc.pdf" target="_blank" rel="noopener noreferrer"
   aria-label="Descargar contrato (abre en nueva pestaña)">
  Contrato
</a>

// ❌ NEVER: icon button without label
<button><TrashIcon /></button>
```

### Form Fields
```tsx
// ✅ Always associate label with input
<label htmlFor="email">Email</label>
<input id="email" type="email" aria-required="true"
  aria-invalid={!!error} aria-describedby={error ? "email-error" : undefined} />
{error && <p id="email-error" role="alert">{error}</p>}

// ✅ Required fields
<label htmlFor="name">Nombre <span aria-hidden="true">*</span></label>
<input id="name" aria-required="true" />

// ❌ NEVER: placeholder as only label
<input placeholder="Nombre" />
```

### Dynamic Content
```tsx
// Loading state
<div aria-live="polite" aria-busy={isLoading}>
  {isLoading ? "Cargando..." : content}
</div>

// Toast notifications
<div role="status" aria-live="polite">{toastMessage}</div>

// Error alerts
<div role="alert">{errorMessage}</div>

// Live counters
<span aria-live="polite" aria-atomic="true">{count} resultados</span>
```

## Keyboard Navigation

### Focus Management
```css
/* Always visible focus ring */
:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}

/* Remove outline only when using mouse */
:focus:not(:focus-visible) {
  outline: none;
}

/* Skip to main content link */
.skip-link {
  position: absolute;
  top: -100%;
  left: var(--space-4);
  z-index: 10000;
  padding: var(--space-2) var(--space-4);
  background: var(--color-primary-500);
  color: white;
  border-radius: var(--radius-sm);
  text-decoration: none;
}
.skip-link:focus {
  top: var(--space-4);
}
```

```tsx
// Add to layout.tsx
<body>
  <a href="#main-content" className="skip-link">Saltar al contenido principal</a>
  <nav>...</nav>
  <main id="main-content" tabIndex={-1}>
    {children}
  </main>
</body>
```

### Tab Order Rules
- Natural DOM order = tab order (never use `tabindex > 0`)
- `tabindex="0"` → add to tab order (for custom interactive elements)
- `tabindex="-1"` → focusable via JS only (for focus management)
- Modal open → trap focus inside modal
- Modal close → return focus to trigger element

### Modal Focus Trap
```typescript
function useFocusTrap(ref: React.RefObject<HTMLElement>, active: boolean) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const el = ref.current;
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    first?.focus();

    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };

    el.addEventListener("keydown", trap);
    return () => el.removeEventListener("keydown", trap);
  }, [active, ref]);
}
```

## Color & Contrast

### Minimum Ratios (WCAG AA)
| Element | Ratio | Tool |
|---|---|---|
| Body text (< 18px) | 4.5:1 | webaim.org/resources/contrastchecker |
| Large text (≥ 18px bold / 24px) | 3:1 | |
| UI components (borders, icons) | 3:1 | |
| Focus indicator | 3:1 against background | |

### Never Rely on Color Alone
```tsx
// ❌ Status shown only by color
<span style={{ color: "green" }}>Activo</span>

// ✅ Color + text/icon
<span className="status-active"><CheckCircle size={14} /> Activo</span>
```

## Images & Media

```tsx
// Informative image — descriptive alt
<img src="/villa.jpg" alt="Vista exterior de Villa Aurora al atardecer" />

// Decorative image — empty alt
<img src="/pattern.svg" alt="" role="presentation" />

// Icon next to text — hide icon from screen readers
<button><TrashIcon aria-hidden="true" /> Eliminar</button>

// Complex image — extended description
<figure>
  <img src="/chart.png" alt="Gráfico de ocupación mensual" aria-describedby="chart-desc" />
  <figcaption id="chart-desc">Ocupación media del 78% en Q1 2026, con pico del 92% en marzo.</figcaption>
</figure>
```

## Semantic Landmarks

Every page MUST have these landmarks:
```html
<header role="banner">         <!-- Site header, once per page -->
<nav role="navigation">        <!-- Primary navigation -->
<main role="main">             <!-- Primary content, once per page -->
<aside role="complementary">   <!-- Sidebar, secondary content -->
<footer role="contentinfo">    <!-- Site footer -->
```

Multiple `<nav>` elements: label each one:
```html
<nav aria-label="Navegación principal">...</nav>
<nav aria-label="Navegación de pie de página">...</nav>
```

## Tables

```html
<table>
  <caption>Listado de propiedades activas</caption>
  <thead>
    <tr>
      <th scope="col">Nombre</th>
      <th scope="col">Zona</th>
      <th scope="col">Estado</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Villa Aurora</td>
      <td>Norte</td>
      <td>Activa</td>
    </tr>
  </tbody>
</table>
```

## Testing Checklist

Before any deployment, verify:
- [ ] Tab through entire page — all interactive elements reachable
- [ ] Escape closes all modals/popovers/dropdowns
- [ ] Screen reader announces page title on navigation
- [ ] All images have appropriate alt text
- [ ] Form errors announced via `role="alert"`
- [ ] Color contrast passes WCAG AA
- [ ] No content only accessible via hover (mobile fallback exists)
- [ ] Skip link works and targets main content

## Rules

- Every `<button>` or `<a>` without visible text MUST have `aria-label`
- Every `<input>` MUST have an associated `<label>` (via `htmlFor`/`id`)
- Every icon next to text: `aria-hidden="true"` on the icon
- Every modal: focus trap + Escape to close + return focus on close
- Every page: skip link + landmarks (header, nav, main, footer)
- Every status change: `aria-live` region for screen reader announcement
- Never remove `:focus-visible` outline without replacement
- Never use `tabindex` > 0
- Never convey information by color alone
