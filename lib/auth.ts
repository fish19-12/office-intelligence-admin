import { createHmac, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { NextRequest, NextResponse } from "next/server";

const scrypt = promisify(scryptCallback);
export const sessionCookieName = "office_intelligence_admin_session";
const sessionLifetimeSeconds = 8 * 60 * 60;
const serviceTokenLifetimeSeconds = 60;

type SessionClaims = {
  iss: "office-intelligence-admin";
  aud: "office-intelligence-admin-session";
  sub: string;
  email: string;
  iat: number;
  exp: number;
};

function readSecret(name: string, minimumBytes = 32): string {
  const value = process.env[name];
  if (!value || Buffer.byteLength(value, "utf8") < minimumBytes) {
    throw new Error(`${name} must be configured with at least ${minimumBytes} bytes.`);
  }
  return value;
}

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sign(input: string, secret: string): string {
  return createHmac("sha256", secret).update(input).digest("base64url");
}

function createToken(claims: Record<string, unknown>, secret: string): string {
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode(claims);
  const input = `${header}.${payload}`;
  return `${input}.${sign(input, secret)}`;
}

function verifyToken<T extends Record<string, unknown>>(token: string, secret: string): T | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, signature] = parts;
  const input = `${headerPart}.${payloadPart}`;
  const expected = Buffer.from(sign(input, secret));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const header = JSON.parse(Buffer.from(headerPart, "base64url").toString("utf8"));
    const claims = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
    if (
      header?.alg !== "HS256" ||
      header?.typ !== "JWT" ||
      typeof claims?.exp !== "number" ||
      claims.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return claims as T;
  } catch {
    return null;
  }
}

export function getAdminCredentials() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !passwordHash) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD_HASH must be configured.");
  }
  return { email, passwordHash };
}

export async function verifyAdminPassword(password: string, encodedHash: string): Promise<boolean> {
  const [algorithm, saltPart, digestPart] = encodedHash.split("$");
  if (
    algorithm !== "scrypt" ||
    !/^[A-Za-z0-9_-]{22,}$/.test(saltPart || "") ||
    !/^[A-Za-z0-9_-]{80,}$/.test(digestPart || "")
  ) {
    throw new Error("ADMIN_PASSWORD_HASH has an invalid format.");
  }
  const expected = Buffer.from(digestPart, "base64url");
  const actual = (await scrypt(password, Buffer.from(saltPart, "base64url"), expected.length)) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createAdminSession(email: string): string {
  const now = Math.floor(Date.now() / 1000);
  const claims: SessionClaims = {
    iss: "office-intelligence-admin",
    aud: "office-intelligence-admin-session",
    sub: email,
    email,
    iat: now,
    exp: now + sessionLifetimeSeconds,
  };
  return createToken(claims, readSecret("ADMIN_SESSION_SECRET"));
}

export function getAdminSession(request: NextRequest): SessionClaims | null {
  const token = request.cookies.get(sessionCookieName)?.value;
  return getAdminSessionFromToken(token);
}

export function getAdminSessionFromToken(token: string | undefined): SessionClaims | null {
  if (!token) return null;
  const claims = verifyToken<SessionClaims>(token, readSecret("ADMIN_SESSION_SECRET"));
  if (
    claims?.iss !== "office-intelligence-admin" ||
    claims.aud !== "office-intelligence-admin-session" ||
    typeof claims.email !== "string" ||
    claims.sub !== claims.email
  ) {
    return null;
  }
  return claims;
}

export function createAdminServiceToken(email: string): string {
  const now = Math.floor(Date.now() / 1000);
  return createToken(
    {
      iss: "denbegnaye-admin-console",
      aud: "denbegnaye-admin-api",
      sub: email,
      email,
      scope: "admin",
      iat: now,
      exp: now + serviceTokenLifetimeSeconds,
    },
    readSecret("ADMIN_SERVICE_TOKEN_SECRET")
  );
}

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(sessionCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: sessionLifetimeSeconds,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(sessionCookieName, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  if (origin === request.nextUrl.origin) return true;
  if (process.env.NODE_ENV === "production") return false;

  try {
    const supplied = new URL(origin);
    const target = request.nextUrl;
    const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
    return (
      supplied.protocol === target.protocol &&
      supplied.port === target.port &&
      loopback.has(supplied.hostname) &&
      loopback.has(target.hostname)
    );
  } catch {
    return false;
  }
}
