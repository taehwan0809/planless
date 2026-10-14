"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

type AuthMode = "login" | "signup" | "forgot" | "reset";

function safeAuthDiagnostic(error: unknown, stage: string) {
  const value = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const code = typeof value.code === "string" ? value.code.slice(0, 80) : "unknown";
  const rawStatus = typeof value.status === "number" ? value.status : value.statusCode;
  const status = typeof rawStatus === "number" ? rawStatus : "n/a";
  let message = typeof value.message === "string" ? value.message : "알 수 없는 오류";
  message = message
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[email]")
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/\b(?:Bearer\s+)?[A-Za-z0-9_-]{32,}\b/g, "[redacted]")
    .slice(0, 240);
  return { code, status, message, stage };
}

function friendlyAuthError(error: unknown, stage: string) {
  const diagnostic = safeAuthDiagnostic(error, stage);
  const message = diagnostic.message.toLowerCase();
  if (diagnostic.code === "SUPABASE_CONFIG_MISSING") return { text: `배포 환경 설정이 누락되었습니다. ${diagnostic.message}`, diagnostic };
  if (diagnostic.code === "SUPABASE_URL_INVALID") return { text: "Supabase 프로젝트 URL 설정을 확인해주세요.", diagnostic };
  if (diagnostic.code === "invalid_credentials" || message.includes("invalid login credentials")) return { text: "이메일 또는 비밀번호를 확인해주세요.", diagnostic };
  if (diagnostic.code === "email_not_confirmed" || message.includes("email not confirmed")) return { text: "이메일 인증을 완료한 뒤 로그인해주세요.", diagnostic };
  if (message.includes("already registered") || message.includes("already been registered")) return { text: "이미 가입된 이메일입니다. 로그인해주세요.", diagnostic };
  if (message.includes("password should be at least") || message.includes("password is too short")) return { text: "비밀번호를 8자 이상으로 입력해주세요.", diagnostic };
  if (message.includes("provider is not enabled") || message.includes("unsupported provider")) return { text: "Supabase 대시보드에서 Google 로그인을 설정해주세요.", diagnostic };
  if (message.includes("redirect") || message.includes("flow state")) return { text: "인증 주소 설정을 확인해주세요. 잠시 후 다시 시도해주세요.", diagnostic };
  if (stage === "signup" && (diagnostic.code === "over_email_send_rate_limit" || diagnostic.status === 429)) {
    return { text: "Supabase 이메일 발송 제한에 도달했습니다. 대시보드에서 이메일 확인을 끄고, 제한이 해제된 뒤 다시 시도해주세요.", diagnostic };
  }
  if (stage === "signup" && diagnostic.code === "signup_session_missing") {
    return { text: "가입은 완료됐지만 로그인 세션이 발급되지 않았습니다. Supabase 대시보드에서 이메일 확인(Confirm email)이 꺼져 있는지 확인해주세요.", diagnostic };
  }
  if (stage === "session-verification" || diagnostic.code.startsWith("AuthSession") || message.includes("session")) return { text: "로그인은 처리됐지만 세션 저장 또는 확인에 실패했습니다. 브라우저 쿠키 설정과 배포 도메인을 확인해주세요.", diagnostic };
  if (diagnostic.status === 429) return { text: "로그인 시도가 많습니다. 잠시 후 다시 시도해주세요.", diagnostic };
  if (message.includes("fetch") || message.includes("network")) return { text: "Supabase 서버에 연결할 수 없습니다. 배포 환경과 네트워크를 확인해주세요.", diagnostic };
  return { text: "요청을 처리하지 못했습니다. 아래 진단 정보를 확인해주세요.", diagnostic };
}

export default function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nextPath, setNextPath] = useState("/create");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [diagnostic, setDiagnostic] = useState("");
  const [message, setMessage] = useState("");
  const submitting = useRef(false);

  useEffect(() => {
    const candidate = new URLSearchParams(window.location.search).get("next");
    if (candidate?.startsWith("/") && !candidate.startsWith("//")) setNextPath(candidate);
    if (new URLSearchParams(window.location.search).has("error")) {
      setError("인증 링크를 확인하지 못했습니다. 다시 로그인하거나 인증 이메일을 재요청해주세요.");
    }
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    setDiagnostic("");
    setMessage("");
    let failureStage = "client-init";
    try {
      const supabase = createSupabaseBrowserClient();
      if (mode === "signup") {
        failureStage = "signup";
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(), password,
        });
        if (authError) throw authError;
        if (!data.session) throw Object.assign(new Error("회원가입 응답에 세션이 없습니다. Supabase의 이메일 확인 설정을 확인해주세요."), { code: "signup_session_missing" });
        failureStage = "session-verification";
        const { data: userData, error: sessionError } = await supabase.auth.getUser();
        if (sessionError) throw sessionError;
        if (!userData.user) throw Object.assign(new Error("가입 직후 세션에서 사용자를 확인할 수 없습니다."), { code: "session_user_missing" });
        router.replace(nextPath);
        router.refresh();
      } else if (mode === "login") {
        failureStage = "password-login";
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
        if (!data.session) throw Object.assign(new Error("로그인 응답에 세션이 없습니다."), { code: "session_missing" });
        failureStage = "session-verification";
        const { data: userData, error: sessionError } = await supabase.auth.getUser();
        if (sessionError) throw sessionError;
        if (!userData.user) throw Object.assign(new Error("세션에서 사용자를 확인할 수 없습니다."), { code: "session_user_missing" });
        router.replace(nextPath);
        router.refresh();
      } else if (mode === "forgot") {
        failureStage = "password-reset";
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth/callback?next=%2Fauth%2Freset-password`,
        });
        if (authError) throw authError;
        setMessage("비밀번호 재설정 링크를 이메일로 보냈습니다. 메일함을 확인해주세요.");
      } else {
        failureStage = "password-update";
        const { error: authError } = await supabase.auth.updateUser({ password });
        if (authError) throw authError;
        setMessage("비밀번호를 변경했습니다. 로그인 상태를 확인하고 있어요.");
        router.replace("/create");
        router.refresh();
      }
    } catch (authError) {
      const result = friendlyAuthError(authError, failureStage);
      console.warn("[PLANLESS auth]", result.diagnostic);
      setError(result.text);
      setDiagnostic(`단계: ${result.diagnostic.stage} · 코드: ${result.diagnostic.code} · HTTP: ${result.diagnostic.status} · 메시지: ${result.diagnostic.message}`);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    setError("");
    setDiagnostic("");
    try {
      const { error: authError } = await createSupabaseBrowserClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}` },
      });
      if (authError) throw authError;
    } catch (authError) {
      const result = friendlyAuthError(authError, "google-oauth-init");
      console.warn("[PLANLESS auth]", result.diagnostic);
      setError(result.text);
      setDiagnostic(`단계: ${result.diagnostic.stage} · 코드: ${result.diagnostic.code} · HTTP: ${result.diagnostic.status} · 메시지: ${result.diagnostic.message}`);
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
              {diagnostic && <details className="authDiagnostic"><summary>안전 진단 정보</summary><code>{diagnostic}</code></details>}
              <button className="generateButton authSubmit" type="submit" disabled={busy}>
                {busy ? "처리 중..." : mode === "login" ? "이메일로 로그인" : mode === "signup" ? "이메일로 가입" : mode === "forgot" ? "재설정 링크 보내기" : "비밀번호 변경"}
              </button>
            </form>
            {(mode === "login" || mode === "signup") && <>
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
