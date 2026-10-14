"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function AccountControl() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let subscription: { unsubscribe: () => void } | undefined;
    let active = true;
    try {
      const supabase = createSupabaseBrowserClient();
      supabase.auth.getUser().then(({ data }) => { if (active) setEmail(data.user?.email ?? null); });
      subscription = supabase.auth.onAuthStateChange((_event, session) => setEmail(session?.user.email ?? null)).data.subscription;
    } catch {
      setEmail(null);
    }
    return () => { active = false; subscription?.unsubscribe(); };
  }, []);
  if (!email) return <Link className="accountLink" href="/auth/login">로그인</Link>;
  return <div className="accountControl"><span title={email}>{email}</span><button type="button" onClick={async () => {
    setError("");
    try {
      const { error: signOutError } = await createSupabaseBrowserClient().auth.signOut();
      if (signOutError) throw signOutError;
      router.replace("/"); router.refresh();
    } catch {
      setError("로그아웃하지 못했습니다. 다시 시도해주세요.");
    }
  }}>로그아웃</button>{error && <span role="alert">{error}</span>}</div>;
}
