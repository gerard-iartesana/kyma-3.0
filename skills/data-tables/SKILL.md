# Data Tables & Lists

Reusable patterns for building data tables with pagination, filtering, sorting, and row actions.

## DataTable Component Architecture

```
DataTable
├── TableToolbar (search + filters + bulk actions + export)
├── Table / CardList (responsive: table on desktop, cards on mobile)
│   ├── TableHeader (sortable columns)
│   └── TableRow × N (data + row actions)
├── TablePagination (page controls + count)
└── TableEmptyState (when no results)
```

## Column Definition

```typescript
interface Column<T> {
  key: keyof T & string;
  label: string;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  width?: string;
  hideOnMobile?: boolean;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
}

// Usage:
const columns: Column<Property>[] = [
  { key: "name", label: "Nombre", sortable: true },
  { key: "zone", label: "Zona", sortable: true, hideOnMobile: true },
  { key: "manager", label: "Gestor", render: (_, row) => row.manager?.name ?? "—" },
  { key: "status", label: "Estado", render: (v) => <StatusBadge status={v} />,  align: "center" },
  { key: "created_at", label: "Fecha", hideOnMobile: true, sortable: true,
    render: (v) => new Date(v).toLocaleDateString("es-ES") },
];
```

## URL-Synced Filters

Store filter state in URL search params for shareable, back-button-friendly filtering:

```typescript
"use client";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

function useTableParams() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const params = {
    page: Number(searchParams.get("page") ?? 1),
    pageSize: Number(searchParams.get("pageSize") ?? 20),
    sort: searchParams.get("sort") ?? "",
    order: (searchParams.get("order") ?? "asc") as "asc" | "desc",
    search: searchParams.get("q") ?? "",
    // Custom filters
    status: searchParams.get("status") ?? "",
    manager: searchParams.get("manager") ?? "",
  };

  const setParams = (updates: Partial<typeof params>) => {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === "" || v === null || v === undefined) sp.delete(k);
      else sp.set(k, String(v));
    }
    // Reset to page 1 when filters change
    if (!("page" in updates)) sp.set("page", "1");
    router.push(`${pathname}?${sp.toString()}`);
  };

  return { params, setParams };
}
```

## Supabase Query Builder

```typescript
async function fetchTableData<T>(
  table: string,
  params: TableParams,
  select = "*"
) {
  const supabase = createClient();
  let query = supabase
    .from(table)
    .select(select, { count: "exact" });

  // Search
  if (params.search) {
    query = query.ilike("name", `%${params.search}%`);
  }

  // Filters
  if (params.status) query = query.eq("status", params.status);
  if (params.manager) query = query.eq("manager_id", params.manager);

  // Sort
  if (params.sort) {
    query = query.order(params.sort, { ascending: params.order === "asc" });
  }

  // Pagination
  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;
  query = query.range(from, to);

  return query;
}
```

## Table Toolbar

```tsx
function TableToolbar({ params, setParams, filters, onExport }) {
  return (
    <div className="table-toolbar">
      {/* Search */}
      <div className="table-search">
        <SearchIcon />
        <input
          type="search"
          placeholder="Buscar..."
          value={params.search}
          onChange={(e) => setParams({ search: e.target.value })}
        />
      </div>

      {/* Filter chips */}
      <div className="table-filters">
        {filters.map(filter => (
          <Select key={filter.key} value={params[filter.key]}
            onValueChange={(v) => setParams({ [filter.key]: v })}>
            <SelectTrigger><SelectValue placeholder={filter.label} /></SelectTrigger>
            <SelectContent>{filter.options.map(/* ... */)}</SelectContent>
          </Select>
        ))}
      </div>

      {/* Active filter badges */}
      <div className="active-filters">
        {Object.entries(params)
          .filter(([k, v]) => v && !["page","pageSize","sort","order"].includes(k))
          .map(([k, v]) => (
            <span key={k} className="filter-badge">
              {k}: {v} <button onClick={() => setParams({ [k]: "" })}>×</button>
            </span>
          ))}
        {hasActiveFilters && (
          <button onClick={clearAllFilters}>Limpiar filtros</button>
        )}
      </div>

      {/* Export */}
      <button onClick={onExport} className="btn-secondary">
        <DownloadIcon /> Exportar
      </button>
    </div>
  );
}
```

## Row Actions

```tsx
// Dropdown menu for each row
function RowActions({ row, onEdit, onDelete }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button aria-label="Acciones"><MoreHorizontalIcon /></button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(row)}>
          <EditIcon /> Editar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onDelete(row)} className="text-destructive">
          <TrashIcon /> Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

## Pagination Component

```tsx
function TablePagination({ page, pageSize, total, onChange }) {
  const totalPages = Math.ceil(total / pageSize);
  return (
    <div className="table-pagination">
      <span className="pagination-info">
        Mostrando {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} de {total}
      </span>
      <div className="pagination-controls">
        <button disabled={page <= 1} onClick={() => onChange(page - 1)}>Anterior</button>
        {/* Show page numbers with ellipsis */}
        <button disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Siguiente</button>
      </div>
    </div>
  );
}
```

## Excel Export

```typescript
import * as XLSX from "xlsx";

function exportToExcel<T extends Record<string, unknown>>(
  data: T[],
  columns: Column<T>[],
  filename: string
) {
  const rows = data.map(row =>
    Object.fromEntries(columns.map(col => [col.label, row[col.key]]))
  );
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Datos");
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${filename}_${date}.xlsx`);
}
```

## Responsive: Table → Cards

```css
/* Desktop: table */
@media (min-width: 768px) {
  .data-table { display: table; width: 100%; }
  .data-cards { display: none; }
}
/* Mobile: cards */
@media (max-width: 767px) {
  .data-table { display: none; }
  .data-cards { display: flex; flex-direction: column; gap: var(--space-3); }
}
```

## Rules

- Always sync filters to URL params
- Always show record count
- Always show empty state when no results
- Reset to page 1 when filters change
- Numbers aligned right, text aligned left
- Sortable columns show direction indicator (▲/▼)
- Row actions via dropdown — max 4 actions visible
- Export respects current filters
