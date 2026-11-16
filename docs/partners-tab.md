# Partners tab (Ledgerline)

Read-only operator view of partner accounts created through Ledgerline `/partnership/signup`.

## Access

Uses the same deployment portal auth as Bookings:

- Microsoft Entra sign-in
- `ALLOWED_EMAILS` allowlist
- Portal BFF route `GET /api/partners` calls `requireApiAuth()`

The browser never receives `LEDGERLINE_PARTNERS_ADMIN_TOKEN` or the SQLite path.

## Upstream

```
Browser (Entra session cookie)
  → GET /api/partners                 [requireApiAuth]
  → GET {LEDGERLINE_PARTNERS_API_BASE}/api/partners/admin/list
       Authorization: Bearer {LEDGERLINE_PARTNERS_ADMIN_TOKEN}
  → Ledgerline PHP + SQLite (read-only projection)
```

Displayed fields: name, work email, firm, country, partner type, signup date.  
Never shown: passwords, password hashes, session identifiers.

## Configuration (not applied by this PR)

| Variable | Where | Purpose |
|---|---|---|
| `PARTNER_ADMIN_TOKEN` | Ledgerline Hostinger PHP env | Authorizes admin list |
| `LEDGERLINE_PARTNERS_API_BASE` | Portal Vercel | Origin only, e.g. `https://www.quantumledgerline.com` |
| `LEDGERLINE_PARTNERS_ADMIN_TOKEN` | Portal Vercel | Same secret as `PARTNER_ADMIN_TOKEN` |

Bookings (`BOOKINGS_*`) and `/book-demo` are unchanged.

## Local development

1. Run Ledgerline with `PARTNER_ADMIN_TOKEN=dev-shared-secret` and `npm run partner-api` / `npm run dev`.
2. In the portal `.env.local`:

```env
LEDGERLINE_PARTNERS_API_BASE=http://127.0.0.1:5173
LEDGERLINE_PARTNERS_ADMIN_TOKEN=dev-shared-secret
```

(Or point `LEDGERLINE_PARTNERS_API_BASE` at `http://127.0.0.1:8791` if calling PHP directly.)
