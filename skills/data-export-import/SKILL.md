# Data Export & Import

Patterns for exporting tables to Excel/CSV and importing bulk data.

## Export: Excel

```typescript
import * as XLSX from "xlsx";

interface ExportColumn {
  key: string;
  label: string;
  format?: (value: unknown) => string | number;
}

function exportToExcel(
  data: Record<string, unknown>[],
  columns: ExportColumn[],
  filename: string
) {
  const rows = data.map((row) =>
    Object.fromEntries(columns.map((c) => [c.label, c.format ? c.format(row[c.key]) : row[c.key] ?? ""]))
  );
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = columns.map((c) => ({
    wch: Math.max(c.label.length, ...data.map((r) => String(r[c.key] ?? "").length)) + 2,
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Datos");
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
```

## Export: CSV

```typescript
function exportToCSV(data: Record<string, unknown>[], columns: ExportColumn[], filename: string) {
  const sep = ";"; // semicolon for Spanish Excel
  const header = columns.map((c) => `"${c.label}"`).join(sep);
  const rows = data.map((row) =>
    columns.map((c) => `"${String(row[c.key] ?? "").replace(/"/g, '""')}"`).join(sep)
  );
  const bom = "\uFEFF"; // UTF-8 BOM
  const blob = new Blob([bom + [header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
}
```

## Import: Parse File

```typescript
async function parseFile(file: File): Promise<Record<string, unknown>[]> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
}
```

## Import: Validate Rows

```typescript
interface ImportColumn {
  key: string;
  label: string;
  required?: boolean;
  validate?: (val: unknown) => string | undefined;
  transform?: (val: unknown) => unknown;
}

function validateRows(rows: Record<string, unknown>[], columns: ImportColumn[]) {
  const valid: Record<string, unknown>[] = [];
  const errors: string[] = [];

  rows.forEach((row, i) => {
    const rowNum = i + 2;
    const mapped: Record<string, unknown> = {};
    let ok = true;
    for (const col of columns) {
      let val = row[col.label] ?? row[col.key];
      if (col.required && !val) { errors.push(`Fila ${rowNum}: "${col.label}" obligatorio`); ok = false; continue; }
      if (val && col.validate) { const e = col.validate(val); if (e) { errors.push(`Fila ${rowNum}: ${e}`); ok = false; continue; } }
      mapped[col.key] = col.transform ? col.transform(val) : val;
    }
    if (ok) valid.push(mapped);
  });
  return { valid, errors };
}
```

## Import: Bulk Insert

```typescript
async function bulkInsert(table: string, rows: Record<string, unknown>[], batchSize = 100) {
  const supabase = createClient();
  let inserted = 0, failed = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const { error } = await supabase.from(table).insert(rows.slice(i, i + batchSize));
    if (error) failed += batchSize; else inserted += Math.min(batchSize, rows.length - i);
  }
  return { inserted, failed };
}
```

## Import UI Flow

1. User clicks "Importar" → show modal
2. Offer "Descargar plantilla" button (empty Excel with correct headers)
3. User selects .xlsx or .csv file
4. Parse and validate ALL rows
5. Show preview: N valid rows, M errors (list errors)
6. User confirms → bulk insert with progress
7. Show result: "X importados, Y errores"

## Rules

- CSV: semicolon `;` separator for Spanish Excel
- CSV: always include UTF-8 BOM (`\uFEFF`)
- Excel: auto-fit column widths
- Export respects current filters — user exports what they see
- Export has no pagination limit — export ALL matching records
- Import: always provide downloadable template
- Import: validate ALL rows before inserting any
- Import: batch inserts (100/batch) to avoid timeouts
- Filenames: `{resource}_{YYYY-MM-DD}.xlsx`
