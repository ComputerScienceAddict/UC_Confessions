import { checkRateLimit } from "@/lib/rateLimit";
import { NextResponse, type NextRequest } from "next/server";

// Aggressive limits: 30 req/min for API, 90/min for HTML/assets
const API_LIMIT = 30;
const PAGE_LIMIT = 90;
const WINDOW_MS = 60 * 1000;

function getClientIdentifier(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ip = forwarded?.split(",")[0]?.trim() || realIp || "anonymous";
  const ua = request.headers.get("user-agent") || "";
  return `${ip}-${ua.slice(0, 64)}`;
}

function securityHeaders(response: NextResponse) {
  const headers = response.headers;

  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-XSS-Protection", "1; mode=block");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.tile.openstreetmap.org https://cdnjs.cloudflare.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
  );
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");

  return response;
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const method = request.method;

  // Only allow GET on API routes (confession-counts is read-only)
  if (path.startsWith("/api/")) {
    if (method !== "GET") {
      return new NextResponse("Method Not Allowed", { status: 405 });
    }
  }

  const identifier = getClientIdentifier(request);
  const isApi = path.startsWith("/api/");
  const { allowed, remaining, resetAt } = checkRateLimit(
    identifier,
    isApi ? API_LIMIT : PAGE_LIMIT,
    WINDOW_MS
  );

  if (!allowed) {
    const res = new NextResponse("Too Many Requests", { status: 429 });
    res.headers.set("Retry-After", "60");
    return res;
  }

  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Limit", String(isApi ? API_LIMIT : PAGE_LIMIT));
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  response.headers.set("X-RateLimit-Reset", String(Math.ceil(resetAt / 1000)));

  return securityHeaders(response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
