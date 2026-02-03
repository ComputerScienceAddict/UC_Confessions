# Security Measures (uc-confessions)

## Implemented Protections

### 1. Rate limiting (DDoS / abuse)
- **Middleware** (`src/middleware.ts`): Every request is rate-limited by IP + User-Agent.
- **API routes**: 30 requests per minute per client.
- **Pages / assets**: 90 requests per minute per client.
- Responses include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
- 429 Too Many Requests with `Retry-After: 60` when limit exceeded.
- Rate limiter is in-memory; for multi-instance production use Redis (e.g. Upstash) or Vercel KV.

### 2. Security headers
- **Middleware + next.config**: Applied on all matching routes.
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`: camera, microphone, geolocation disabled.
- `Strict-Transport-Security`: HSTS with long max-age and preload.
- **Content-Security-Policy**: Restricts scripts, styles, images, and connect-src to your app, Supabase, and OpenStreetMap.

### 3. API hardening
- **confession-counts**: GET only; other methods return 405.
- Response size capped via Supabase `.limit()` to avoid huge payloads.
- Short cache (`s-maxage=30`) to reduce load while keeping counts fresh.

### 4. Input validation
- **Confession detail** (`/confession/[id]`): `id` must be a valid UUID; invalid IDs show “Post not found” without hitting Supabase.
- **Security helpers** (`src/lib/security.ts`): `isValidUuid`, `isValidSchoolId`, `MAX_BODY_LENGTH` for reuse.

### 5. Supabase
- All mutations (insert/update) go through Supabase with RLS; app uses anon key only.
- Schema uses RLS policies and `security definer` RPCs for views/likes.

## Recommendations for production

1. **Rate limit storage**: Replace in-memory rate limiter with Redis (Upstash) or Vercel KV for multi-instance and persistence.
2. **WAF**: Use Vercel Firewall or Cloudflare in front for additional DDoS and bot protection.
3. **Monitoring**: Log 429s and failed validations; set alerts on high error or request rates.
4. **Secrets**: Keep `NEXT_PUBLIC_SUPABASE_ANON_KEY` and URL in env only; never commit.
