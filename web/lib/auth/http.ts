import { NextRequest, NextResponse } from "next/server";
import type { Permission } from "@/db/domain";
import { CSRF_COOKIE, SESSION_COOKIE, isLiveMode } from "./config";
import { constantTimeTokenMatch } from "./crypto";
import { getSessionByToken, hasPermission, type AuthContext } from "./session";

type AuthorizationResult =
  | { context: AuthContext; error: null }
  | { context: null; error: NextResponse };

export async function authorizeApi(
  request: NextRequest,
  options: { permission?: Permission; csrf?: boolean } = {},
): Promise<AuthorizationResult> {
  if (!isLiveMode()) {
    return {
      context: null,
      error: NextResponse.json({ error: "Live data is disabled" }, { status: 409 }),
    };
  }

  const context = await getSessionByToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!context) {
    return {
      context: null,
      error: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    };
  }

  if (options.permission && !hasPermission(context, options.permission)) {
    return {
      context: null,
      error: NextResponse.json({ error: "Permission denied" }, { status: 403 }),
    };
  }

  if (options.csrf) {
    const origin = request.headers.get("origin");
    if (origin && origin !== request.nextUrl.origin) {
      return { context: null, error: NextResponse.json({ error: "Invalid request origin" }, { status: 403 }) };
    }
    const headerToken = request.headers.get("x-csrf-token") ?? "";
    const cookieToken = request.cookies.get(CSRF_COOKIE)?.value ?? "";
    if (!headerToken || headerToken !== cookieToken || !constantTimeTokenMatch(headerToken, context.csrfTokenHash)) {
      return { context: null, error: NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }) };
    }
  }

  return { context, error: null };
}
