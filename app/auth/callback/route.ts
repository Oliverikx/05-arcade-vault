import { NextResponse, type NextRequest } from "next/server";
import { safeNext, usernameOf } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (!usernameOf(data.user)) {
        return NextResponse.redirect(
          new URL(
            `/auth?step=usernamew&next=${encodeURIComponent(next)}`,
            origin,
          ),
        );
      }
      return NextResponse.redirect(new URL(next, origin));
    }
    console.error("exchangeCodeForSession failed", error);
  }

  return NextResponse.redirect(new URL("/auth?error=link", origin));
}
