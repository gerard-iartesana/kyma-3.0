# Firebase Deployment

Skill for deploying web apps to Firebase Hosting.

## Deployment Steps

1. Build: `npm run build`
2. Deploy: `firebase deploy --only hosting`
3. Preview: `firebase hosting:channel:deploy preview-name`

## firebase.json (Static - Astro)
```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }],
    "headers": [
      {
        "source": "**/*.@(jpg|jpeg|png|svg|webp|js|css)",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
      }
    ]
  }
}
```

## Rules

- Always build before deploying
- Use `--only hosting` to avoid deploying other services
- Never commit Firebase service account keys or `.env.local`
- Use `NEXT_PUBLIC_` prefix for client-side env vars in Next.js
- Check build errors before deploying
