# 🧠 Agent Skills

Colección de skills para Antigravity AI — optimizadas para desarrollo web y apps de gestión interna.

## Stack Principal

- **Framework**: Next.js 14 (App Router) + Astro 6
- **UI**: TailwindCSS + shadcn/ui + Vanilla CSS
- **Database**: Supabase (PostgreSQL + Auth + Storage + Realtime)
- **State**: Zustand + SWR
- **Deploy**: Firebase Hosting + GitHub Actions

## Skills Disponibles (29)

### 🔧 Desarrollo Base
| Skill | Descripción |
|---|---|
| `nextjs-supabase-management-app` | Stack, estructura y convenciones para apps Next.js + Supabase |
| `astro-landing-page` | Landings SEO-first con Astro y CSS vanilla |
| `supabase-database` | Migraciones, RLS, Storage, queries |
| `api-standardization` | Formato de respuestas `{ ok, data, error }`, error codes |
| `global-state-management` | Stores Zustand por dominio (auth, UI, filters) |
| `cache-mutations` | SWR con optimistic updates y rollback |

### 🎨 Diseño & UI
| Skill | Descripción |
|---|---|
| `design-system-creation` | Paletas HSL, tipografía, spacing, gradientes, dark mode |
| `micro-animations` | Transiciones, hover effects, scroll reveal, skeletons |
| `landing-page-layouts` | Wireframes de hero, features, testimonios, pricing |
| `ui-best-practices` | Jerarquía visual, empty states, modales, tablas |
| `figma-to-code` | Workflow Figma MCP → código pixel-perfect |
| `accessibility` | ARIA, focus trap, contraste WCAG AA, semántica |

### 📊 Datos & Tablas
| Skill | Descripción |
|---|---|
| `data-tables` | Tablas con filtros URL, paginación, acciones, responsive |
| `forms-validation` | FormField reutilizable, validator factory, file upload |
| `data-export-import` | Export Excel/CSV, import con validación y bulk insert |
| `charts-dashboards` | Recharts: line, bar, donut, area + KPI cards |
| `search-debounce` | useDebounce hook, SearchInput, full-text search |

### 🔒 Seguridad & Calidad
| Skill | Descripción |
|---|---|
| `security-rbac` | Roles, RLS por rol, middleware, permission hooks |
| `audit-logs` | Registro de "quién hizo qué y cuándo" + diff viewer |
| `error-boundaries` | ErrorBoundary + error.tsx + telemetría Sentry |
| `testing` | Vitest + Testing Library, mocks Supabase |
| `auto-documentation` | JSDoc, inline comments, migration headers |

### 🔔 UX Avanzada
| Skill | Descripción |
|---|---|
| `notifications-toasts` | Toast store, container, mensajes estándar, timings |
| `keyboard-shortcuts` | useHotkey hook, command palette (Ctrl+K) |
| `i18n` | next-intl, message files, naming convention |
| `realtime-collaboration` | Supabase Realtime, presence, indicadores de edición |

### 🚀 DevOps
| Skill | Descripción |
|---|---|
| `firebase-deployment` | firebase.json, headers de caché |
| `ci-cd` | GitHub Actions deploy + preview, Docker multi-stage |
| `git-conventions` | Conventional commits, branch naming |

## Uso

Estas skills se activan automáticamente en Antigravity cuando el contexto de tu petición coincide con alguna de ellas. No necesitas invocarlas manualmente.
