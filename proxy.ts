import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { usernameOf } from "@/lib/auth";

const PLAY_ROUTE_RE = /^\/games\/[^/]+\/play\/?$/;

// Refreshes Supabase session cookies on every request; gates
// /games/[id]/play to signed-in users with a username.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = getSupabaseEnv();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Validates the JWT and triggers a refresh when expired.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  if (PLAY_ROUTE_RE.test(pathname)) {
    const next = encodeURIComponent(pathname + search);
    if (!user) {
      return redirectWithCookies(request, response, `/auth?next=${next}`);
    }
    if (!usernameOf(user)) {
      return redirectWithCookies(
        request,
        response,
        `/auth?step=username&next=${next}`,
      );
    }
  }

  return response;
}

// Keeps refreshed session cookies on the redirect response.
function redirectWithCookies(
  request: NextRequest,
  from: NextResponse,
  path: string,
) {
  const redirect = NextResponse.redirect(new URL(path, request.url));
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp3|wav|ogg)$).*)",
  ],
};
