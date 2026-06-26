# Git Conventions

Standard commit messages and branching strategy.

## Commit Messages: Conventional Commits

```
<type>(<scope>): <description>

[optional body]
```

### Types

| Type | When |
|---|---|
| `feat` | New feature or functionality |
| `fix` | Bug fix |
| `style` | UI/CSS changes (no logic change) |
| `refactor` | Code restructuring (no feature/fix) |
| `perf` | Performance improvement |
| `docs` | Documentation only |
| `chore` | Build, deps, config, tooling |
| `test` | Adding or updating tests |
| `db` | Database migrations or schema changes |

### Scope (optional)
Use the feature area: `auth`, `properties`, `inventory`, `tasks`, `api`, `ui`

### Examples
```
feat(properties): add calendar icon to search results
fix(inventory): correct stock count on delete
style(dashboard): improve card spacing on mobile
db: add migration 023 for contacts table
chore: update Next.js to 14.2.5
refactor(api): standardize error response format
```

### Rules
- Lowercase everything
- No period at the end
- Imperative mood: "add feature" not "added feature"
- Max 72 characters for the first line
- Body for context when needed (wrap at 80 chars)

## Branch Naming

```
<type>/<short-description>

feat/calendar-search-icon
fix/inventory-stock-count
style/mobile-dashboard
```

## Workflow

```
main (production)
  └── feat/new-feature (develop here)
        └── PR → main (review + merge)
```

- Always pull latest `main` before creating a branch
- Commit often with small, focused commits
- Squash merge to main for clean history
