# Internationalization (i18n)

Patterns for multi-language support in Next.js apps using next-intl.

## Setup

```bash
npm install next-intl
```

## File Structure

```
messages/
  es.json           # Spanish (default)
  en.json           # English
  de.json           # German (etc.)
i18n/
  request.ts        # next-intl config
  routing.ts        # locale routing
```

## Message Files

```json
// messages/es.json
{
  "common": {
    "save": "Guardar",
    "cancel": "Cancelar",
    "delete": "Eliminar",
    "edit": "Editar",
    "create": "Crear",
    "search": "Buscar...",
    "loading": "Cargando...",
    "noResults": "No se encontraron resultados",
    "confirm": "¿Estás seguro?",
    "yes": "Sí",
    "no": "No"
  },
  "auth": {
    "login": "Iniciar sesión",
    "logout": "Cerrar sesión",
    "email": "Correo electrónico",
    "password": "Contraseña"
  },
  "properties": {
    "title": "Propiedades",
    "create": "Nueva propiedad",
    "name": "Nombre",
    "zone": "Zona",
    "manager": "Gestor",
    "status": "Estado",
    "saved": "Propiedad guardada correctamente",
    "deleted": "Propiedad eliminada",
    "count": "Mostrando {from}–{to} de {total}"
  },
  "errors": {
    "required": "{field} es obligatorio",
    "invalidEmail": "El formato del email no es válido",
    "networkError": "Error de conexión. Comprueba tu red.",
    "permissionDenied": "No tienes permisos para esta acción",
    "generic": "Algo salió mal. Inténtalo de nuevo."
  }
}
```

```json
// messages/en.json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "create": "Create",
    "search": "Search...",
    "loading": "Loading...",
    "noResults": "No results found",
    "confirm": "Are you sure?",
    "yes": "Yes",
    "no": "No"
  }
}
```

## Configuration

```typescript
// i18n/request.ts
import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = await requestLocale || "es";
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
```

## Usage in Components

```tsx
// Server Component
import { useTranslations } from "next-intl";

export default function PropertiesPage() {
  const t = useTranslations("properties");
  return <h1>{t("title")}</h1>;
  // Renders: "Propiedades" (es) or "Properties" (en)
}

// With interpolation
<p>{t("count", { from: 1, to: 20, total: 156 })}</p>
// Renders: "Mostrando 1–20 de 156"

// Client Component
"use client";
import { useTranslations } from "next-intl";

function SaveButton() {
  const t = useTranslations("common");
  return <button>{t("save")}</button>;
}
```

## Key Naming Convention

```
{namespace}.{context}.{key}

common.save           → Generic actions
properties.title      → Page-specific
errors.required       → Error messages
```

- Namespace = feature area or `common`
- Keys in camelCase
- Keep flat (max 2 levels deep)
- Group by page/feature, not by component

## Migration Strategy (Existing Hardcoded Text)

When refactoring existing Spanish-only code:

1. Find hardcoded strings: `grep -r '"[A-ZÁÉÍÓÚ]' --include="*.tsx" app/ components/`
2. Extract to message files grouped by feature
3. Replace strings with `t("key")` calls
4. Verify all pages render correctly

## Rules

- NEVER hardcode user-facing text — always use translation keys
- Default locale: `es` (Spanish)
- Fallback: if key missing in current locale, show Spanish
- Dates/numbers: use `Intl.DateTimeFormat` and `Intl.NumberFormat` with locale
- Validation messages use interpolation for field names: `t("errors.required", { field: t("properties.name") })`
- Toast messages also use i18n keys
- Keep message files sorted alphabetically
- Add new keys to ALL locale files (even if translation is pending — use Spanish as placeholder)
