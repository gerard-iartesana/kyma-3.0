# Automated Testing

Patterns for generating unit and integration tests with Vitest in Next.js projects.

## Setup

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    css: false,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

```typescript
// vitest.setup.ts
import "@testing-library/jest-dom/vitest";
```

```json
// package.json
{ "scripts": { "test": "vitest", "test:run": "vitest run", "test:coverage": "vitest run --coverage" } }
```

## File Convention

```
component.tsx          → component.test.tsx
lib/utils.ts           → lib/utils.test.ts
lib/validators.ts      → lib/validators.test.ts
```

Place test files next to the source file, not in a separate `__tests__` directory.

## Utility Function Tests

```typescript
// lib/validators.test.ts
import { describe, it, expect } from "vitest";
import { validateEmail, formatCurrency } from "./validators";

describe("validateEmail", () => {
  it("accepts valid emails", () => {
    expect(validateEmail("user@example.com")).toBeUndefined();
    expect(validateEmail("name.surname@domain.es")).toBeUndefined();
  });

  it("rejects invalid emails", () => {
    expect(validateEmail("")).toBe("El email es obligatorio");
    expect(validateEmail("not-an-email")).toBe("Email no válido");
    expect(validateEmail("missing@domain")).toBe("Email no válido");
  });
});

describe("formatCurrency", () => {
  it("formats euros correctly", () => {
    expect(formatCurrency(1234.5)).toBe("1.234,50 €");
    expect(formatCurrency(0)).toBe("0,00 €");
  });
});
```

## Component Tests

```typescript
// components/KpiCard.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KpiCard } from "./KpiCard";

describe("KpiCard", () => {
  it("renders label and value", () => {
    render(<KpiCard label="Propiedades" value={42} />);
    expect(screen.getByText("Propiedades")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("shows positive change in green", () => {
    render(<KpiCard label="Test" value={10} change={5} />);
    const change = screen.getByText(/5%/);
    expect(change).toHaveClass("positive");
  });

  it("shows negative change in red", () => {
    render(<KpiCard label="Test" value={10} change={-3} />);
    const change = screen.getByText(/3%/);
    expect(change).toHaveClass("negative");
  });
});
```

## Interactive Component Tests

```typescript
// components/SearchInput.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchInput } from "./SearchInput";

describe("SearchInput", () => {
  it("calls onChange with debounced value", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SearchInput onChange={onChange} placeholder="Buscar..." />);

    const input = screen.getByPlaceholderText("Buscar...");
    await user.type(input, "villa");

    expect(onChange).toHaveBeenCalledWith("villa");
  });

  it("clears input when clear button is clicked", async () => {
    const user = userEvent.setup();
    render(<SearchInput onChange={vi.fn()} value="test" />);

    await user.click(screen.getByLabelText("Limpiar búsqueda"));
    expect(screen.getByRole("searchbox")).toHaveValue("");
  });
});
```

## Mocking Supabase

```typescript
// test/mocks/supabase.ts
import { vi } from "vitest";

export const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: vi.fn(),
  })),
  auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
  storage: { from: vi.fn() },
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabase,
}));
```

## What to Test

| Always test | Skip testing |
|---|---|
| Validation functions | Simple pass-through components |
| Data transformers / formatters | CSS / layout |
| Permission logic (can/cannot) | Third-party library wrappers |
| Conditional rendering | Static content |
| Form submission flow | Supabase SDK internals |
| Error state display | |

## When to Generate Tests

Generate tests automatically when creating:
- Validation schemas or rule functions
- Utility/helper functions
- Components with conditional logic or computed display
- Permission checks
- Data transformation pipelines

## Rules

- Test file next to source: `component.test.tsx`
- Use `describe` blocks grouped by function/component
- Test names in English, describe behavior: "shows error when email is invalid"
- Use `screen.getByRole` / `getByText` over `getByTestId` when possible
- Mock external deps (Supabase, fetch) — never hit real APIs
- `vi.fn()` for callbacks, `vi.mock()` for modules
- Run `npm test` before committing critical changes
