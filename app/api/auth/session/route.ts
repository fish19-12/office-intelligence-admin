import { NextRequest } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { json } from "@/lib/http";

export function GET(request: NextRequest) {
  try {
    const session = getAdminSession(request);
    return session ? json({ authenticated: true, email: session.email }) : json({ authenticated: false }, 401);
  } catch (error) {
    console.error("Office Intelligence admin session check failed:", error);
    return json({ error: "Admin session signing is not configured." }, 503);
  }
}
