import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseClient } from "@/lib/supabase";

function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/create";
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const nextPath = safeNext(request.nextUrl.searchParams.get("next"));
  if (code) {
    const supabase = await createSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(nextPath, request.url));
  }
  return NextResponse.redirect(new URL("/auth/login?error=callback", request.url));
}
