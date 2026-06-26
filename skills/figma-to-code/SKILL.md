# Figma to Code Workflow

Skill for converting Figma designs to production code using the Figma MCP integration.

## Prerequisites

- Figma MCP server must be connected and authenticated
- Figma file URL or file key must be provided by the user

## Workflow

### Step 1: Analyze the Design
```
Use: mcp_figma_get_figma_data
- Extract the fileKey from the Figma URL
- Get the full node tree to understand the page structure
- Identify sections, components, and repeated patterns
```

### Step 2: Extract Design Tokens
From the Figma data, extract:
- **Colors**: All fill colors → CSS variables
- **Typography**: Font families, sizes, weights, line heights → CSS variables
- **Spacing**: Padding, gaps, margins → CSS spacing scale
- **Border radius**: Corner radius values
- **Shadows**: Box shadow values
- **Breakpoints**: Frame widths for responsive design

### Step 3: Download Assets
```
Use: mcp_figma_download_figma_images
- Download all images (backgrounds, photos) as PNG at 2x scale
- Download all icons as SVG for crisp rendering
- Save to public/images/ or public/icons/
- Use descriptive filenames: hero-background.png, icon-phone.svg
```

### Step 4: Build Component Map
Map Figma frames to code components:
```
Figma Frame: "Hero Section"     → components/Hero.astro (or .tsx)
Figma Frame: "Services Grid"    → components/Services.astro
Figma Frame: "Testimonials"     → components/Testimonials.astro
Figma Frame: "Contact Form"     → components/Contact.astro
Figma Frame: "Footer"           → components/Footer.astro
```

### Step 5: Implement
- Build CSS variables file first (design tokens)
- Create base layout with proper HTML structure
- Build each component matching Figma pixel-by-pixel
- Use actual content from Figma (text, images) — NOT placeholders
- Implement responsive behavior based on Figma's auto-layout hints

## Translation Rules: Figma → CSS

| Figma Property | CSS Property |
|---|---|
| Auto Layout (horizontal) | `display: flex; flex-direction: row;` |
| Auto Layout (vertical) | `display: flex; flex-direction: column;` |
| Gap | `gap: Xpx;` |
| Padding | `padding: T R B L;` |
| Fill (solid) | `background-color: #hex;` |
| Fill (gradient) | `background: linear-gradient(...)` |
| Fill (image) | `background-image: url(...)` |
| Corner radius | `border-radius: Xpx;` |
| Stroke | `border: Wpx solid #hex;` |
| Drop shadow | `box-shadow: X Y B S #hex;` |
| Opacity | `opacity: X;` |
| Clip content | `overflow: hidden;` |
| Fixed size | `width: Xpx; height: Ypx;` |
| Hug contents | `width: fit-content;` |
| Fill container | `width: 100%; flex: 1;` |
| Text Auto | `width: auto;` |

## Typography Translation

```css
/* From Figma: Font "Inter", Weight 600, Size 48, Line Height 56, Letter Spacing -0.02em */
font-family: 'Inter', sans-serif;
font-weight: 600;
font-size: 48px;        /* Convert to clamp() for responsiveness */
line-height: 56px;      /* Or use unitless: 1.167 */
letter-spacing: -0.02em;
```

## Responsive Strategy

1. Design is typically provided at desktop width (1440px or 1200px)
2. If mobile design is provided, implement both breakpoints exactly
3. If only desktop is provided:
   - Stack horizontal layouts vertically on mobile
   - Reduce font sizes proportionally
   - Full-width sections on mobile
   - Hamburger menu for navigation
   - Min breakpoints: 320px (mobile), 768px (tablet), 1024px (desktop)

## Quality Checklist

- [ ] Colors match Figma exactly (use color picker to verify)
- [ ] Typography matches (font, size, weight, line-height, letter-spacing)
- [ ] Spacing matches (padding, margins, gaps)
- [ ] Images are crisp (exported at 2x, properly sized)
- [ ] Icons are SVG and match Figma design
- [ ] Hover states implemented (even if not in Figma, add subtle ones)
- [ ] Responsive layout works on mobile/tablet/desktop
- [ ] All text content matches Figma (no lorem ipsum)
- [ ] Interactive elements have proper cursor styles

## Don'ts

- ❌ Don't guess colors — extract them from Figma data
- ❌ Don't use placeholder text if real content exists in the design
- ❌ Don't skip downloading assets — use the Figma MCP tools
- ❌ Don't approximate spacing — match Figma values precisely
- ❌ Don't forget hover/focus states for interactive elements
