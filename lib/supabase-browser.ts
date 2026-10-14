"use client";

import { createBrowserClient } from "@supabase/ssr";

export class SupabaseBrowserConfigError extends Error {
  readonly code = "SUPABASE_CONFIG_MISSING";
  constructor(missing: string[]) {
    super(`누락된 환경 변수: ${missing.join(", ")}`);
    this.name = "SupabaseBrowserConfigError";
  }
}

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const missing = [
    !url?.trim() && "NEXT_PUBLIC_SUPABASE_URL",
    !anonKey?.trim() && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ].filter((value): value is string => !!value);
  if (missing.length) throw new SupabaseBrowserConfigError(missing);
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url!);
  } catch {
    throw Object.assign(new Error("NEXT_PUBLIC_SUPABASE_URL이 유효한 URL이 아닙니다."), {
      code: "SUPABASE_URL_INVALID",
    });
  }
  if (parsedUrl.protocol !== "https:" && parsedUrl.hostname !== "localhost") {
    throw Object.assign(new Error("NEXT_PUBLIC_SUPABASE_URL은 HTTPS 주소여야 합니다."), {
      code: "SUPABASE_URL_INVALID",
    });
  }
  return createBrowserClient(url!, anonKey!);
}
