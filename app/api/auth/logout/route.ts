import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, isSameOrigin } from "@/lib/auth";
import { json } from "@/lib/http";

export function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  const response = NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  clearSessionCookie(response);
  return response;
}
