# UI Best Practices

Cross-cutting usability and UX rules. Apply these in EVERY project regardless of framework or design system.

## Visual Hierarchy

### The 3-Level Rule
Every screen should have exactly 3 levels of visual importance:
1. **Primary**: ONE element that grabs attention first (headline, key metric, CTA)
2. **Secondary**: Supporting content that explains or contextualizes
3. **Tertiary**: Metadata, labels, fine print

Achieve hierarchy through:
- **Size**: Primary text 2–3× larger than body
- **Weight**: Bold (600–700) for headings, regular (400) for body
- **Color**: High contrast for primary, muted for tertiary
- **Whitespace**: More space around important elements

### Never Compete
```
❌ Three equally-sized bold headings side by side
✅ One large heading, two smaller subheadings below
```

## Accessibility (Non-Negotiable)

### Contrast
- Body text: minimum **4.5:1** contrast ratio against background
- Large text (18px+ bold or 24px+): minimum **3:1**
- Interactive elements (buttons, links): minimum **3:1** against adjacent colors
- Use https://webaim.org/resources/contrastchecker/ to verify

### Focus States
```css
/* Every interactive element MUST have a visible focus style */
:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}
/* Remove default outline only when providing custom focus */
:focus:not(:focus-visible) {
  outline: none;
}
```

### Keyboard Navigation
- All functionality must be reachable via keyboard
- Tab order must follow visual order (avoid positive tabindex values)
- Modal focus trapping: Tab cycles within the modal when open
- Escape key closes modals, dropdowns, and popovers

### ARIA Essentials
```html
<!-- Buttons that look like icons MUST have labels -->
<button aria-label="Cerrar menú">
  <svg>...</svg>
</button>

<!-- Loading states -->
<div aria-live="polite" aria-busy="true">Cargando...</div>

<!-- Current page in navigation -->
<a href="/dashboard" aria-current="page">Dashboard</a>

<!-- Expandable sections -->
<button aria-expanded="false" aria-controls="panel-1">Sección</button>
<div id="panel-1" role="region" hidden>...</div>
```

### Semantic HTML Checklist
- `<nav>` for navigation blocks
- `<main>` for primary content (one per page)
- `<header>` / `<footer>` for page or section headers/footers
- `<section>` with `aria-labelledby` for content sections
- `<article>` for self-contained content (blog posts, cards)
- `<button>` for actions, `<a>` for navigation — never swap them
- `<ul>` / `<ol>` for lists of items

## Forms

### Field Design
```
Label (always visible, above field)
┌──────────────────────────────┐
│ Placeholder (hint, not label)│
└──────────────────────────────┘
Helper text below (optional)
Error message below (replaces helper)
```

Rules:
- Labels ALWAYS visible — never use placeholder as the only label
- Group related fields visually (name + surname, city + postal code)
- Limit width: full-name fields ~400px max, email ~360px, phone ~200px
- Use correct input types: `type="email"`, `type="tel"`, `type="number"`
- Add `inputmode` for mobile keyboards: `inputmode="numeric"` for codes
- Add `autocomplete` attributes: `autocomplete="name"`, `autocomplete="email"`

### Validation
```
❌ Validate only on submit (user fills 10 fields, gets 5 errors)
✅ Validate on blur (field loses focus) + on submit
❌ "Error in field" (what error?)
✅ "El email debe tener formato nombre@dominio.com"
```

- Show errors inline, next to the field, in red/error color
- Keep the error message visible until the user fixes it
- On submit with errors, scroll to and focus the first error field
- Never clear the form on validation error

### Buttons
- Primary action on the RIGHT (or bottom): "Guardar", "Enviar"
- Secondary/cancel on the LEFT: "Cancelar", "Volver"
- Loading state on submit: disable button + show spinner + change text ("Guardando...")
- Never use "Submit" — use descriptive labels: "Crear propiedad", "Enviar mensaje"

## Empty States

Never show a blank screen. Every list/table needs an empty state:

```
┌─────────────────────────────────────┐
│                                     │
│         (illustration/icon)         │
│                                     │
│    No hay propiedades todavía       │
│    Añade tu primera propiedad       │
│    para empezar.                    │
│                                     │
│    [+ Añadir propiedad]             │
│                                     │
└─────────────────────────────────────┘
```

## Error States

### API/Network Errors
```
┌─────────────────────────────────────┐
│                                     │
│         (error illustration)        │
│                                     │
│    No se pudo cargar los datos      │
│    Comprueba tu conexión e          │
│    inténtalo de nuevo.              │
│                                     │
│    [Reintentar]                     │
│                                     │
└─────────────────────────────────────┘
```

### Toast / Notification Rules
- **Success**: green, auto-dismiss after 3–4 seconds
- **Error**: red, persist until dismissed (user may need to read it)
- **Warning**: amber, auto-dismiss after 5 seconds
- Position: top-right for desktop, top-center for mobile
- Max 3 toasts visible at once — queue the rest

## Tables & Data

### Responsive Tables
```
Desktop: full table with columns
Tablet:  hide less important columns, add horizontal scroll
Mobile:  convert to card layout
```

### Table Best Practices
- Align numbers to the right
- Align text to the left
- Fixed header on scroll (sticky header)
- Zebra striping OR subtle border — not both
- Clickable rows: add `cursor: pointer` and hover background
- Always show record count: "Mostrando 1–20 de 156"

### Filters & Search
- Search input at the top, always visible
- Active filters shown as removable chips/badges
- "Clear all filters" button when any filter is active
- Show result count updating in real-time as filters change
- Persist filter state in URL params (shareable, back-button friendly)

## Modals & Dialogs

### When to Use What
| Pattern | Use for |
|---|---|
| Toast | Success confirmations, non-critical info |
| Inline alert | Validation errors, contextual warnings |
| Modal dialog | Confirmations that need user decision |
| Full-screen modal | Complex forms, multi-step flows on mobile |
| Slide-over panel | Detail views, secondary forms on desktop |

### Modal Rules
- Always have a close button (X) in top-right corner
- Click outside or press Escape to close (unless destructive action pending)
- Trap focus inside the modal
- Prevent body scroll when modal is open
- Destructive actions: require explicit confirmation, make the destructive button RED and secondary style
- Max width: 480px for simple confirms, 640px for forms, 800px for complex content

### Destructive Confirmation Pattern
```
┌───────────────────────────────────┐
│  ⚠️ Eliminar propiedad           │
│                                   │
│  Esta acción no se puede deshacer.│
│  Se eliminarán todos los datos    │
│  asociados a "Villa Aurora".      │
│                                   │
│         [Cancelar]  [Eliminar]    │
│                      (red btn)    │
└───────────────────────────────────┘
```

## Touch & Mobile

- Touch targets: minimum **44×44px** (iOS) / **48×48px** (Material)
- Spacing between touch targets: minimum **8px**
- No hover-dependent content on mobile (tooltips → tap to reveal)
- Pull-to-refresh for list views
- Swipe gestures: only for common actions (delete, archive) and always with visual cue
- Bottom navigation bar for 3–5 primary actions
- FAB (Floating Action Button) for single primary action

## Loading States

| Duration | What to show |
|---|---|
| < 300ms | Nothing (avoid flash) |
| 300ms–2s | Spinner or progress indicator |
| > 2s | Skeleton screen with shimmer |
| > 5s | Skeleton + "Esto puede tardar..." message |
| Timeout | Error state with retry button |

```css
/* Delay showing spinner to avoid flash on fast connections */
.loading-spinner {
  opacity: 0;
  animation: fadeIn 0s ease-in 300ms forwards;
}
@keyframes fadeIn {
  to { opacity: 1; }
}
```

## Microcopy

- Use active voice: "Guardar cambios" not "Los cambios serán guardados"
- Be specific: "Añadir propiedad" not "Añadir"
- Be human: "Algo salió mal" not "Error 500"
- Button labels = verb + noun: "Crear tarea", "Enviar informe", "Descargar PDF"
- Confirmation messages acknowledge the action: "Propiedad guardada correctamente"
- Error messages tell what to do: "El nombre es obligatorio" not "Campo inválido"
