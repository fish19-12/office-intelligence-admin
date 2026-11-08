import { NextRequest } from "next/server";
import { createAdminSession, getAdminCredentials, isSameOrigin, setSessionCookie, verifyAdminPassword } from "@/lib/auth";
import { json } from "@/lib/http";

const failures = new Map<string, { count: number; resetAt: number }>();

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return json({ error: "Invalid request origin." }, 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Enter your administrator email and password." }, 400);
  }
  if (
    !body ||
    typeof body !== "object" ||
    !("email" in body) ||
    !("password" in body) ||
    typeof body.email !== "string" ||
    typeof body.password !== "string" ||
    body.email.length > 254 ||
    body.password.length > 1024
  ) {
    return json({ error: "Enter your administrator email and password." }, 400);
  }

  let credentials: ReturnType<typeof getAdminCredentials>;
  try {
    credentials = getAdminCredentials();
  } catch (error) {
    console.error("Office Intelligence admin login is not configured:", error);
    return json({ error: "Administrator login is not configured. Check the server setup guide." }, 503);
  }

  const email = body.email.trim().toLowerCase();
  const key = `${request.headers.get("x-forwarded-for") || "local"}:${email}`;
  const current = failures.get(key);
  if (current && current.resetAt > Date.now() && current.count >= 8) {
    return json({ error: "Too many sign-in attempts. Try again in 15 minutes." }, 429);
  }

  let validPassword = false;
  try {
    validPassword = await verifyAdminPassword(body.password, credentials.passwordHash);
  } catch (error) {
    console.error("Office Intelligence admin password configuration is invalid:", error);
    return json({ error: "Administrator password configuration is invalid." }, 503);
  }
  if (email !== credentials.email || !validPassword) {
    const count = current && current.resetAt > Date.now() ? current.count + 1 : 1;
    failures.set(key, { count, resetAt: Date.now() + 15 * 60_000 });
    return json({ error: "Invalid email or password." }, 401);
  }

  failures.delete(key);
  try {
    const response = json({ success: true });
    setSessionCookie(response, createAdminSession(credentials.email));
    return response;
  } catch (error) {
    console.error("Office Intelligence admin session could not be created:", error);
    return json({ error: "Admin session signing is not configured." }, 503);
  }
}
