# Deploying

The site is static: every page is built once, at deploy time. What a build shows (HOLD
placeholders or production fallbacks) is decided then, never per request.

## 1. The Vercel project

- Import the repository as a Next.js project. Framework preset: Next.js. Node.js version:
  24.x. Install command `npm ci`; build command `npm run build` (the defaults).
- Production branch: `main`. Every other branch gets a preview deployment.
- Turn on **Skew Protection** (Settings, Advanced). A visitor in the middle of a sheet
  change then keeps loading files from the build they started on.
- Add the domain `actualengineer.com` (and `www`, redirecting to the apex). `site.url` in
  `src/content/site.ts` must match the production domain: the sitemap, canonical links,
  Open Graph images and JSON-LD all come from it.

## 2. Environment variables

The list lives in `.env.example`, with one comment per variable. `npm run punchlist --
--write` copies it into the "Deployment settings" section of `PLACEHOLDERS.md`.

| Variable                                                 | Where                     | Notes                                                                                                                                   |
| -------------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `VERCEL_ENV`                                             | set by Vercel             | `production` hides HOLDs and proof, 404s `/kit` and `/punch-list`, and makes pages indexable. Set it locally only to test.              |
| `SHOW_HOLDS`                                             | optional                  | `1` shows HOLD clouds, `0` shows the fallbacks. Defaults to `0` only in production.                                                     |
| `STRICT_HOLDS`                                           | Production, at launch     | `1` fails the build while any essential HOLD or pending CONFIRM remains.                                                                |
| `CSP_MODE`                                               | first preview only        | `report` sends the policy as report-only. Leave it unset everywhere else.                                                               |
| `RESEND_API_KEY`                                         | Production and Preview    | A "sending access" key limited to the verified domain. Unset locally: messages are logged, not sent.                                    |
| `CONTACT_TO_EMAIL`                                       | Production and Preview    | The inbox (or comma list) that receives enquiries.                                                                                      |
| `CONTACT_FROM_EMAIL`                                     | Production and Preview    | A sender on the verified domain, for example `Actual Engineer <contact@mail.actualengineer.com>`.                                       |
| `FORM_TOKEN_SECRET`                                      | Production (required)     | Signs the form's time token. Make one with `openssl rand -base64 32`. Keep it the same across deployments.                              |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | optional, both or neither | Cloudflare Turnstile on the contact form. Adding the site key also adds Cloudflare to the CSP.                                          |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`     | optional                  | A shared rate limit for the form (`KV_REST_API_*` from the Vercel marketplace also work). Without them each instance limits on its own. |

Never commit a real value. `.env*` files stay out of git (only `.env.example` is tracked).

## 3. Email (Resend)

1. In Resend, add a sending subdomain, for example `mail.actualengineer.com`.
2. Add the DNS records Resend shows (DKIM, SPF and the return-path record) at your DNS host,
   and wait for Resend to mark the domain verified.
3. Create an API key with "sending access" limited to that domain; put it in
   `RESEND_API_KEY`.
4. Set `CONTACT_FROM_EMAIL` to an address on that domain and `CONTACT_TO_EMAIL` to your
   inbox.
5. On a preview, send the contact form once and check the message arrives (and not in spam).

## 4. The booking link (Cal.com)

1. In Cal.com, create the intro-call event. Its length must match `site.callLength` in
   `src/content/site.ts`.
2. Paste the event's public link into `site.scheduler.url` in `src/content/site.ts`,
   replacing the `hold()`.
3. The Content-Security-Policy is built from that link at build time, so redeploy after any
   change.
4. Ship the first preview with `CSP_MODE=report`, make a real test booking, and check the
   browser console for CSP reports. When it is clean, remove `CSP_MODE` (the policy then
   enforces).

## 5. Previews and production

- **Previews** show every HOLD as a dashed cloud and every pending CONFIRM with a mark.
  `/punch-list` lists what is still open; `/kit` shows the design system. Previews send
  `X-Robots-Tag: noindex`.
- **Production** shows the fallback text instead of HOLDs, leaves pending CONFIRMs and the
  proof section out, returns 404 for `/kit` and `/punch-list`, and is the only indexable
  build.
- "Promote to Production" on a preview rebuilds with the production settings, which is
  safe.

## 6. Launch

1. Fill every essential HOLD (`npm run punchlist` lists them) and confirm or cut every
   pending CONFIRM.
2. Set `STRICT_HOLDS=1` in the Production environment. Only now: before launch it would
   block every production build.
3. Deploy. A strict build that fails lists exactly the items still open.
4. On a real iPhone (Safari) and a mid-range Android phone, check: the hero plays and
   pauses, Book a call, the contact form, the booking widget, and a sheet change.

## 7. Rollbacks

- **Never Instant-Rollback to a build made before the HOLDs were filled.** Instant Rollback
  and staged promotes reuse an old build as it was, placeholders and all. Redeploy the
  older commit instead, so it builds again with today's content and settings.
- After changing an environment variable, redeploy: values are read at build time.
