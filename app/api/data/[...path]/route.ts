import { NextRequest } from "next/server";
import { createAdminServiceToken, getAdminSession, isSameOrigin } from "@/lib/auth";
import { json } from "@/lib/http";

type Context = { params: Promise<{ path: string[] }> };

function getAllowedEndpoint(method: string, path: string[], status: string | null): string | null {
  if (method === "GET" && path.length === 1 && path[0] === "users") return "users";
  if (
    method === "GET" &&
    path.length === 2 &&
    path[0] === "office-intelligence" &&
    path[1] === "usage"
  ) {
    return "office-intelligence/usage";
  }
  if (path.length === 1 && path[0] === "office-intelligence-payments") {
    if (method === "PATCH") return "office-intelligence-payments";
    if (method === "GET" && ["pending", "approved", "rejected", "all"].includes(status || "")) {
      return "office-intelligence-payments";
    }
  }
  return null;
}

async function proxy(request: NextRequest, context: Context) {
  let session;
  try {
    session = getAdminSession(request);
  } catch (error) {
    console.error("Office Intelligence admin session validation is not configured:", error);
    return json({ error: "Admin session signing is not configured." }, 503);
  }
  if (!session) return json({ error: "Sign in again to continue." }, 401);
  if (!["GET", "HEAD"].includes(request.method) && !isSameOrigin(request)) {
    return json({ error: "Invalid request origin." }, 403);
  }

  const { path } = await context.params;
  const endpoint = getAllowedEndpoint(
    request.method,
    path,
    request.nextUrl.searchParams.get("status")
  );
  if (!endpoint) return json({ error: "Admin data endpoint not found." }, 404);

  const configuredOrigin = process.env.DENBEGNAYE_API_URL?.trim();
  if (!configuredOrigin) {
    return json({ error: "Set DENBEGNAYE_API_URL to the Denbegnaye application origin." }, 503);
  }

  let origin: URL;
  try {
    origin = new URL(configuredOrigin);
    if (
      !["http:", "https:"].includes(origin.protocol) ||
      origin.username ||
      origin.password ||
      origin.pathname !== "/" ||
      origin.search ||
      origin.hash
    ) {
      throw new Error("DENBEGNAYE_API_URL must be an HTTP(S) origin.");
    }
  } catch (error) {
    console.error("Invalid Denbegnaye application origin:", error);
    return json({ error: "The Denbegnaye application origin is misconfigured." }, 503);
  }

  let serviceToken: string;
  try {
    serviceToken = createAdminServiceToken(session.email);
  } catch (error) {
    console.error("Admin service token signing is not configured:", error);
    return json({ error: "Set the shared ADMIN_SERVICE_TOKEN_SECRET." }, 503);
  }

  const upstream = new URL(`/api/admin/${endpoint}`, origin);
  upstream.search = request.nextUrl.search;
  const headers = new Headers({
    Authorization: `Bearer ${serviceToken}`,
    Accept: "application/json",
  });
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  try {
    const response = await fetch(upstream, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.text(),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    const responseHeaders = new Headers({ "Cache-Control": "no-store" });
    const responseContentType = response.headers.get("content-type");
    if (responseContentType) responseHeaders.set("Content-Type", responseContentType);
    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Could not reach Denbegnaye admin API:", error);
    return json({ error: "Could not connect to Denbegnaye. Check its URL and that it is running." }, 502);
  }
}

export const GET = proxy;
export const PATCH = proxy;
