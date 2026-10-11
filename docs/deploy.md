# Deploying

_Skeleton from W0; the platform lane completes it._

- Vercel, Node 24, npm. Every page is static.
- Previews (`VERCEL_ENV=preview`) show HOLDs; production (`VERCEL_ENV=production`) shows
  fallbacks, hides proof, and returns 404 for `/kit` and `/punch-list`.
- `STRICT_HOLDS=1` in the Production environment fails the build while any essential HOLD or
  pending CONFIRM remains. Set it only when you are ready to launch.
- Never Instant-Rollback to a build made before the HOLDs were filled.
- The full list of environment variables and settings is in `PLACEHOLDERS.md`
  (generated from `.env.example`).
