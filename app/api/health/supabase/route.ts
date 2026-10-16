import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

type HealthBody = { ok: true } | { ok: false; error: string };

function respond(body: HealthBody, status: number) {
  return Response.json(body, { status });
}

export async function GET() {
  let env: { url: string; key: string };
  try {
    env = getSupabaseEnv();
  } catch (error) {
    console.error("[health/supabase] not configured:", error);
    return respond({ ok: false, error: "SUPABASE NOT CONFIGURED" }, 503);
  }

  try {
    await createClient();
    const res = await fetch(`${env.url}/auth/v1/health`, {
      headers: { apikey: env.key },
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("[health/supabase] unhealthy response:", res.status);
      return respond({ ok: false, error: "SUPABASE UNREACHABLE" }, 503);
    }
    return respond({ ok: true }, 200);
  } catch (error) {
    console.error("[health/supabase] unreachable:", error);
    return respond({ ok: false, error: "SUPABASE UNREACHABLE" }, 503);
  }
}
