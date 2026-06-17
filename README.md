This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Environment variables (Vercel / production)

Auth and deployment require these variables. Set them in the Vercel project **Settings → Environment Variables** (Production, Preview, and Development as needed).

| Variable | Description |
|----------|-------------|
| `AUTH_SECRET` | Random secret for session encryption. Generate with `openssl rand -base64 32`. |
| `AUTH_URL` | Canonical app URL (Auth.js v5). Example: `https://webdeployment.highvolt.tech` |
| `NEXTAUTH_URL` | Legacy alias; used if `AUTH_URL` is unset. Same value as `AUTH_URL` on Vercel. |
| `AUTH_MICROSOFT_ENTRA_ID_ID` | Azure app registration **Application (client) ID** |
| `AUTH_MICROSOFT_ENTRA_ID_SECRET` | Azure client secret |
| `AUTH_MICROSOFT_ENTRA_ID_ISSUER` | e.g. `https://login.microsoftonline.com/{tenant-id}/v2.0` |
| `ALLOWED_EMAILS` | Comma-separated allowlist, lowercase recommended. e.g. `user@company.com,admin@company.com` |
| `GITHUB_TOKEN` | GitHub PAT for Actions API (deploy/status) |
| `GITHUB_OWNER` | Optional; defaults to `HighVolt-Analytics` |

**Microsoft redirect URI** (Azure portal):  
`https://webdeployment.highvolt.tech/api/auth/callback/microsoft-entra-id`

Auth configuration lives in [`auth.ts`](./auth.ts) at the project root. Production sign-in logs (Vercel **Functions** / runtime logs) include resolved Microsoft email candidates when debugging `AccessDenied`.
