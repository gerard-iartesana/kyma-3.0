# Auto Documentation

Rules for generating structured code documentation (JSDoc, comments, README) automatically.

## JSDoc: When and How

### Always Document
- Exported functions
- Component props interfaces
- Utility/helper functions
- Complex logic (more than 10 lines or non-obvious behavior)
- API route handlers
- Store definitions
- Type definitions with more than 3 fields

### JSDoc Format

```typescript
/**
 * Calcula el porcentaje de ocupación de una propiedad en un rango de fechas.
 * Excluye los días bloqueados por mantenimiento del cálculo.
 *
 * @param propertyId - ID de la propiedad en Supabase
 * @param from - Fecha de inicio (ISO string)
 * @param to - Fecha de fin (ISO string)
 * @returns Porcentaje de ocupación (0-100) o null si no hay datos
 *
 * @example
 * const rate = await getOccupancyRate("uuid-123", "2026-01-01", "2026-01-31");
 * // => 78.5
 */
async function getOccupancyRate(propertyId: string, from: string, to: string): Promise<number | null> {
```

### Component Documentation
```typescript
/**
 * Tarjeta KPI para dashboards. Muestra un valor principal con indicador
 * de cambio respecto al periodo anterior.
 *
 * @example
 * <KpiCard label="Ocupación" value="78%" change={5} />
 */
interface KpiCardProps {
  /** Etiqueta descriptiva del KPI */
  label: string;
  /** Valor principal formateado */
  value: string | number;
  /** Cambio porcentual vs periodo anterior. Positivo = verde, negativo = rojo */
  change?: number;
  /** Icono opcional (Lucide React) */
  icon?: React.ReactNode;
}
```

### API Route Documentation
```typescript
/**
 * GET /api/properties
 *
 * Lista propiedades con paginación y filtros.
 *
 * Query params:
 * - page (number, default 1)
 * - pageSize (number, default 20, max 100)
 * - q (string) — búsqueda por nombre
 * - status (string) — filtro por estado
 * - manager (string) — filtro por ID de gestor
 *
 * Response: ApiSuccess<Property[]> con meta de paginación
 */
export async function GET(req: Request) {
```

## Inline Comments

### When to Comment
```typescript
// ✅ DO: Explain WHY, not WHAT
// Usamos semicolon como separador porque Excel en español lo espera por defecto
const separator = ";";

// ✅ DO: Explain business rules
// Los operadores solo ven propiedades asignadas, los admins ven todas
const filter = isAdmin ? {} : { manager_id: userId };

// ✅ DO: Warn about non-obvious behavior
// ⚠️ Supabase .range() es inclusive en ambos extremos
query.range(from, to);

// ❌ DON'T: State the obvious
// Set name to value  ← USELESS
setName(value);
```

### Section Dividers for Long Files
```typescript
// ─────────────────────────────────────────
// Data Fetching
// ─────────────────────────────────────────

// ─────────────────────────────────────────
// Event Handlers
// ─────────────────────────────────────────

// ─────────────────────────────────────────
// Render
// ─────────────────────────────────────────
```

## TODO / FIXME / HACK Tags

```typescript
// TODO: Implementar paginación del lado del servidor
// FIXME: El cálculo de ocupación no excluye festivos
// HACK: Workaround para bug en Supabase RLS con views anidadas
```

## Migration Documentation

```sql
-- migration_023_contacts.sql
-- Description: Añade tabla de contactos asociados a propiedades
-- Author: auto-generated
-- Date: 2026-04-28
--
-- Cambios:
--   - Nueva tabla: public.contacts
--   - RLS: lectura para authenticated, escritura para admin/manager
--   - Índice: idx_contacts_property_id
```

## README for New Features

When creating a significant new feature, add a section to the project README or create a feature-specific README:

```markdown
## Módulo de Inventario

### Descripción
Gestión de inventario por propiedad con catálogo centralizado.

### Archivos principales
- `app/admin/villas/[id]/inventario/page.tsx` — Vista de inventario por villa
- `components/inventory/` — Componentes del módulo
- `lib/stores/use-inventory-store.ts` — Estado local del inventario

### Flujo principal
1. Usuario selecciona una propiedad
2. Se carga el inventario desde `inventory_stock` (join con `catalog_items`)
3. Usuario puede añadir/eliminar items y ajustar cantidades
4. Cambios se guardan en Supabase con upsert
```

## Rules

- Document exported functions with JSDoc — always
- Document component props interfaces — always
- Use `@example` for non-obvious usage
- Inline comments explain WHY, never WHAT
- Use TODO/FIXME/HACK tags for pending work
- SQL migrations: header comment with description and changes list
- Section dividers in files longer than 150 lines
- Keep comments in the same language as the code (English), except for user-facing descriptions (Spanish)
- Update existing comments when modifying documented code — never leave stale docs
