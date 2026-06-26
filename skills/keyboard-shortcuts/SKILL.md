# Keyboard Shortcuts

Patterns for implementing keyboard shortcuts for power users in Next.js apps.

## Global Shortcut Hook

```typescript
// lib/hooks/use-hotkey.ts
"use client";
import { useEffect, useCallback } from "react";

type Modifier = "ctrl" | "shift" | "alt" | "meta";

interface HotkeyConfig {
  key: string;            // "k", "n", "Escape", "Enter", etc.
  modifiers?: Modifier[];  // ["ctrl"], ["ctrl", "shift"]
  handler: (e: KeyboardEvent) => void;
  enabled?: boolean;       // default true
  preventDefault?: boolean; // default true
}

export function useHotkey({ key, modifiers = [], handler, enabled = true, preventDefault = true }: HotkeyConfig) {
  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;
    // Don't trigger in input/textarea/contenteditable
    const tag = (e.target as HTMLElement).tagName;
    const editable = (e.target as HTMLElement).isContentEditable;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(tag) || editable) {
      if (key !== "Escape") return; // Escape always works
    }

    const modMatch =
      (modifiers.includes("ctrl") === (e.ctrlKey || e.metaKey)) &&
      (modifiers.includes("shift") === e.shiftKey) &&
      (modifiers.includes("alt") === e.altKey);

    if (e.key.toLowerCase() === key.toLowerCase() && modMatch) {
      if (preventDefault) e.preventDefault();
      handler(e);
    }
  }, [key, modifiers, handler, enabled, preventDefault]);

  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onKeyDown]);
}
```

## Command Palette (Ctrl+K)

```tsx
// components/command-palette.tsx
"use client";
import { useState, useEffect, useRef } from "react";
import { useHotkey } from "@/lib/hooks/use-hotkey";
import { Search } from "lucide-react";

interface Command {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;      // Display string: "Ctrl+N"
  action: () => void;
  section?: string;        // Group: "Navegación", "Acciones"
}

export function CommandPalette({ commands }: { commands: Command[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useHotkey({ key: "k", modifiers: ["ctrl"], handler: () => setOpen(true) });
  useHotkey({ key: "Escape", handler: () => setOpen(false), enabled: open });

  useEffect(() => {
    if (open) { setQuery(""); setSelected(0); inputRef.current?.focus(); }
  }, [open]);

  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase())
  );

  const run = (cmd: Command) => { cmd.action(); setOpen(false); };

  // Navigate with arrow keys
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
    if (e.key === "Enter" && filtered[selected]) run(filtered[selected]);
  };

  if (!open) return null;
  return (
    <>
      <div className="command-backdrop" onClick={() => setOpen(false)} />
      <div className="command-palette" role="dialog" aria-label="Paleta de comandos">
        <div className="command-input-wrap">
          <Search size={16} />
          <input ref={inputRef} value={query} onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
            onKeyDown={onKeyDown} placeholder="Buscar comando..." className="command-input" />
          <kbd className="command-kbd">ESC</kbd>
        </div>
        <ul className="command-list" role="listbox">
          {filtered.map((cmd, i) => (
            <li key={cmd.id} role="option" aria-selected={i === selected}
              className={`command-item ${i === selected ? "selected" : ""}`}
              onClick={() => run(cmd)} onMouseEnter={() => setSelected(i)}>
              {cmd.icon && <span className="command-icon">{cmd.icon}</span>}
              <span className="command-label">{cmd.label}</span>
              {cmd.shortcut && <kbd className="command-shortcut">{cmd.shortcut}</kbd>}
            </li>
          ))}
          {filtered.length === 0 && <li className="command-empty">Sin resultados</li>}
        </ul>
      </div>
    </>
  );
}
```

## Standard Shortcuts

| Shortcut | Action | Scope |
|---|---|---|
| `Ctrl+K` | Open command palette | Global |
| `Ctrl+N` | New record (property, task, etc.) | List pages |
| `Ctrl+S` | Save current form | Form pages |
| `Ctrl+E` | Export current view | Tables |
| `Ctrl+F` | Focus search input | Tables |
| `Escape` | Close modal/palette/panel | Global |
| `Ctrl+Z` | Undo last action (if supported) | Forms |
| `?` | Show shortcut help | Global |

## Shortcut Help Modal

```tsx
function ShortcutHelp() {
  const [open, setOpen] = useState(false);
  useHotkey({ key: "?", modifiers: ["shift"], handler: () => setOpen(true) });

  // Render a modal listing all available shortcuts grouped by section
}
```

## CSS for Command Palette

```css
.command-backdrop {
  position: fixed; inset: 0; background: hsl(0 0% 0% / 0.4);
  z-index: 9998; backdrop-filter: blur(4px);
}
.command-palette {
  position: fixed; top: 20%; left: 50%; transform: translateX(-50%);
  width: min(560px, 90vw); background: white; border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl); z-index: 9999; overflow: hidden;
  animation: palette-in 150ms var(--ease-out);
}
@keyframes palette-in { from { opacity: 0; transform: translateX(-50%) scale(0.96); } }
.command-input-wrap {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--color-border);
}
.command-input { flex: 1; border: none; outline: none; font-size: var(--text-base); }
.command-kbd {
  font-size: 11px; padding: 2px 6px; border-radius: 4px;
  background: var(--color-neutral-100); color: var(--color-text-muted);
  border: 1px solid var(--color-neutral-200); font-family: inherit;
}
.command-list { max-height: 320px; overflow-y: auto; padding: var(--space-2); }
.command-item {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-2) var(--space-3); border-radius: var(--radius-sm);
  cursor: pointer; font-size: var(--text-sm);
}
.command-item.selected { background: var(--color-primary-50); color: var(--color-primary-700); }
.command-shortcut { margin-left: auto; }
.command-empty { padding: var(--space-8); text-align: center; color: var(--color-text-muted); }
```

## Rules

- Always skip shortcuts when focus is in input/textarea (except Escape)
- Use `Ctrl` (maps to `Cmd` on Mac via `e.metaKey` check)
- Show shortcuts as `kbd` tags next to buttons that have them
- Provide a `?` help overlay listing all available shortcuts
- Command palette is searchable — fuzzy match on label
- Arrow keys + Enter for keyboard-only navigation in palette
- Don't override browser defaults (Ctrl+T, Ctrl+W, Ctrl+L, etc.)
