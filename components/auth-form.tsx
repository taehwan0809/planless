"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

type AuthMode = "login" | "signup" | "forgot" | "reset";

function friendlyAuthError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("invalid login credentials")) return "이메일 또는 비밀번호를 확인해주세요.";
  if (message.includes("email not confirmed")) return "이메일 인증을 완료한 뒤 로그인해주세요.";
  if (message.includes("already registered") || message.includes("already been registered")) return "이미 가입된 이메일입니다. 로그인해주세요.";
  if (message.includes("password should be at least") || message.includes("password is too short")) return "비밀번호를 8자 이상으로 입력해주세요.";
  if (message.includes("provider is not enabled") || message.includes("unsupported provider")) return "Supabase 대시보드에서 Google 로그인을 먼저 설정해주세요.";
  if (message.includes("redirect") || message.includes("flow state")) return "인증 주소 설정을 확인해주세요. 잠시 후 다시 시도해주세요.";
  return "요청을 처리하지 못했습니다. 입력값과 Supabase 인증 설정을 확인한 뒤 다시 시도해주세요.";
}

export default function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nextPath, setNextPath] = useState("/create");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const candidate = new URLSearchParams(window.location.search).get("next");
    if (candidate?.startsWith("/") && !candidate.startsWith("//")) setNextPath(candidate);
    if (new URLSearchParams(window.location.search).has("error")) {
      setError("인증 링크를 확인하지 못했습니다. 다시 로그인하거나 인증 이메일을 재요청해주세요.");
    }
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}` },
        });
        if (authError) throw authError;
        if (!data.session) {
          setMessage("가입 요청을 완료했습니다. 이메일의 인증 링크를 눌러 가입을 마쳐주세요.");
        } else {
          router.replace(nextPath);
          router.refresh();
        }
      } else if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
        router.replace(nextPath);
        router.refresh();
      } else if (mode === "forgot") {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth/callback?next=%2Fauth%2Freset-password`,
        });
        if (authError) throw authError;
        setMessage("비밀번호 재설정 링크를 이메일로 보냈습니다. 메일함을 확인해주세요.");
      } else {
        const { error: authError } = await supabase.auth.updateUser({ password });
        if (authError) throw authError;
        setMessage("비밀번호를 변경했습니다. 로그인 상태를 확인하고 있어요.");
        router.replace("/create");
        router.refresh();
      }
    } catch (authError) {
      setError(friendlyAuthError(authError));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    setError("");
    try {
      const { error: authError } = await createSupabaseBrowserClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}` },
      });
      if (authError) throw authError;
    } catch (authError) {
      setError(friendlyAuthError(authError));
      setBusy(false);
    }
  };

  const title = mode === "login" ? "다시 오셨네요" : mode === "signup" ? "PLANLESS 시작하기" : mode === "forgot" ? "비밀번호 재설정" : "새 비밀번호 만들기";
  const description = mode === "login" ? "로그인하고 여행 기록을 이어서 확인하세요." : mode === "signup" ? "여행 계획과 기록을 안전하게 저장하세요." : mode === "forgot" ? "가입한 이메일로 재설정 링크를 보내드릴게요." : "새로운 비밀번호를 입력해주세요.";

  return (
    <main className="authPage">
      <section className="authCard" aria-labelledby="auth-title">
        <Link href="/" className="authBrand">PLANLESS<span>여행의 플랜 B</span></Link>
        <p className="step">YOUR TRIP, YOUR PLAN</p>
        <h1 id="auth-title">{title}</h1>
        <p className="authDescription">{description}</p>
        {message ? <div className="authSuccess" role="status">{message}</div> : (
          <>
            <form className="authForm" onSubmit={handleSubmit}>
              {mode !== "reset" && <label className="formGroup"><span className="fieldLabel">이메일</span>
                <input type="email" autoComplete="email" required maxLength={254} value={email}
                  onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" />
              </label>}
              {(mode === "login" || mode === "signup" || mode === "reset") && <label className="formGroup"><span className="fieldLabel">비밀번호</span>
                <input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"}
                  minLength={8} maxLength={72} required value={password} onChange={(event) => setPassword(event.target.value)}
                  placeholder="8자 이상 입력해주세요" />
              </label>}
              {error && <p className="authError" role="alert">{error}</p>}
              <button className="generateButton authSubmit" type="submit" disabled={busy}>
                {busy ? "처리 중..." : mode === "login" ? "이메일로 로그인" : mode === "signup" ? "이메일로 가입" : mode === "forgot" ? "재설정 링크 보내기" : "비밀번호 변경"}
              </button>
            </form>
            {(mode === "login" || mode === "signup") && <>
              <div className="authDivider"><span>또는</span></div>
              <button className="googleButton" type="button" onClick={handleGoogle} disabled={busy}>
                <span className="googleMark" aria-hidden="true">G</span> Google로 계속하기
              </button>
            </>}
            <nav className="authLinks" aria-label="계정 도움말">
              {mode === "login" && <><Link href={`/auth/forgot-password?next=${encodeURIComponent(nextPath)}`}>비밀번호를 잊으셨나요?</Link><span>계정이 없으신가요? <Link href={`/auth/signup?next=${encodeURIComponent(nextPath)}`}>회원가입</Link></span></>}
              {mode === "signup" && <span>이미 계정이 있나요? <Link href={`/auth/login?next=${encodeURIComponent(nextPath)}`}>로그인</Link></span>}
              {mode === "forgot" && <Link href={`/auth/login?next=${encodeURIComponent(nextPath)}`}>로그인으로 돌아가기</Link>}
              {mode === "reset" && <Link href="/auth/login">로그인</Link>}
            </nav>
          </>
        )}
        <p className="authPublicNote">PLANLESS 서비스 소개와 홈은 로그인 없이 볼 수 있습니다.</p>
      </section>
    </main>
  );
}
