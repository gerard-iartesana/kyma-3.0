# Forms & Validation Patterns

Reusable patterns for building forms with validation in Next.js + React. Complements the design rules in `ui-best-practices`.

## Form Architecture

### Simple Forms: Controlled State
For forms with < 6 fields, use plain React state:

```tsx
"use client";
import { useState } from "react";

interface FormData {
  name: string;
  email: string;
  phone: string;
}

const INITIAL: FormData = { name: "", email: "", phone: "" };

export function ContactForm() {
  const [form, setForm] = useState<FormData>(INITIAL);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [loading, setLoading] = useState(false);

  const set = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
    // Clear error on change
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const validate = (): boolean => {
    const errs: typeof errors = {};
    if (!form.name.trim()) errs.name = "El nombre es obligatorio";
    if (!form.email.trim()) errs.email = "El email es obligatorio";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = "Formato de email no válido";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      // await submitData(form);
      // toast.success("Guardado correctamente");
    } catch {
      // toast.error("Error al guardar. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FormField label="Nombre" error={errors.name}>
        <input value={form.name} onChange={set("name")} />
      </FormField>
      {/* ... more fields */}
      <button type="submit" disabled={loading}>
        {loading ? "Guardando..." : "Guardar"}
      </button>
    </form>
  );
}
```

### Complex Forms: useReducer
For forms with 6+ fields, conditional sections, or multi-step flows:

```tsx
type Action =
  | { type: "SET_FIELD"; field: string; value: string }
  | { type: "SET_ERRORS"; errors: Record<string, string> }
  | { type: "CLEAR_ERROR"; field: string }
  | { type: "RESET" };

function formReducer(state: FormState, action: Action): FormState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, data: { ...state.data, [action.field]: action.value } };
    case "SET_ERRORS":
      return { ...state, errors: action.errors };
    case "CLEAR_ERROR":
      const { [action.field]: _, ...rest } = state.errors;
      return { ...state, errors: rest };
    case "RESET":
      return initialState;
  }
}
```

## Reusable FormField Component

```tsx
interface FormFieldProps {
  label: string;
  error?: string;
  helper?: string;
  required?: boolean;
  children: React.ReactNode;
}

function FormField({ label, error, helper, required, children }: FormFieldProps) {
  const id = label.toLowerCase().replace(/\s/g, "-");
  return (
    <div className="form-field">
      <label htmlFor={id}>
        {label} {required && <span className="text-error">*</span>}
      </label>
      {React.cloneElement(children as React.ReactElement, {
        id,
        "aria-invalid": !!error,
        "aria-describedby": error ? `${id}-error` : helper ? `${id}-helper` : undefined,
        className: cn("input", error && "input-error"),
      })}
      {error && <p id={`${id}-error`} className="field-error" role="alert">{error}</p>}
      {!error && helper && <p id={`${id}-helper`} className="field-helper">{helper}</p>}
    </div>
  );
}
```

## Validation Library

### Validator Factory
```tsx
type Rule<T> = (value: T, form?: Record<string, unknown>) => string | undefined;

const rules = {
  required: (msg = "Campo obligatorio"): Rule<string> =>
    (v) => (!v?.trim() ? msg : undefined),

  email: (msg = "Email no válido"): Rule<string> =>
    (v) => (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? msg : undefined),

  minLength: (n: number, msg?: string): Rule<string> =>
    (v) => (v && v.length < n ? (msg ?? `Mínimo ${n} caracteres`) : undefined),

  maxLength: (n: number, msg?: string): Rule<string> =>
    (v) => (v && v.length > n ? (msg ?? `Máximo ${n} caracteres`) : undefined),

  phone: (msg = "Teléfono no válido"): Rule<string> =>
    (v) => (v && !/^[+]?[\d\s()-]{6,}$/.test(v) ? msg : undefined),

  numeric: (msg = "Debe ser un número"): Rule<string> =>
    (v) => (v && isNaN(Number(v)) ? msg : undefined),

  match: (field: string, msg = "Los campos no coinciden"): Rule<string> =>
    (v, form) => (v !== form?.[field] ? msg : undefined),
};

function validate<T extends Record<string, string>>(
  data: T,
  schema: Partial<Record<keyof T, Rule<string>[]>>
): Partial<Record<keyof T, string>> {
  const errors: Partial<Record<keyof T, string>> = {};
  for (const [field, fieldRules] of Object.entries(schema)) {
    for (const rule of (fieldRules as Rule<string>[])) {
      const err = rule(data[field as keyof T], data);
      if (err) { errors[field as keyof T] = err; break; }
    }
  }
  return errors;
}

// Usage:
const errors = validate(formData, {
  name: [rules.required(), rules.minLength(2)],
  email: [rules.required(), rules.email()],
  phone: [rules.phone()],
});
```

## Select / Dropdown Fields

Use shadcn/ui Select for styled dropdowns:
```tsx
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

<FormField label="Gestor" error={errors.manager}>
  <Select value={form.manager} onValueChange={(v) => setField("manager", v)}>
    <SelectTrigger><SelectValue placeholder="Seleccionar gestor" /></SelectTrigger>
    <SelectContent>
      {managers.map(m => (
        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
      ))}
    </SelectContent>
  </Select>
</FormField>
```

## File Upload Pattern

```tsx
const [file, setFile] = useState<File | null>(null);
const [uploading, setUploading] = useState(false);

const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
  const f = e.target.files?.[0];
  if (!f) return;
  // Validate type and size
  const ALLOWED = ["image/jpeg", "image/png", "application/pdf"];
  const MAX_MB = 10;
  if (!ALLOWED.includes(f.type)) return setErrors({ file: "Formato no permitido (JPG, PNG, PDF)" });
  if (f.size > MAX_MB * 1024 * 1024) return setErrors({ file: `Máximo ${MAX_MB}MB` });
  setFile(f);
};

const uploadToSupabase = async (file: File, path: string) => {
  const { data, error } = await supabase.storage
    .from("attachments")
    .upload(`${path}/${Date.now()}_${file.name}`, file);
  if (error) throw error;
  return data.path;
};
```

## CSS for Forms

```css
.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}
.form-field + .form-field {
  margin-top: var(--space-4);
}
.form-field label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-text);
}
.input {
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  transition: border-color 150ms ease, box-shadow 150ms ease;
}
.input:focus {
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px hsl(var(--hue-brand) 55% 48% / 0.15);
  outline: none;
}
.input-error {
  border-color: var(--color-error);
}
.input-error:focus {
  box-shadow: 0 0 0 3px hsl(0 72% 51% / 0.15);
}
.field-error {
  font-size: var(--text-xs);
  color: var(--color-error);
}
.field-helper {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}
```

## Rules

- Always use `noValidate` on `<form>` to handle validation in JS
- Always show validation on blur AND on submit
- Focus the first error field on submit failure
- Never clear form data on failed submission
- Submit button: disable + spinner + descriptive text while loading
- File uploads: validate type + size client-side before uploading
- Error messages in Spanish, specific and actionable
