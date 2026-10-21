# planless

## Supabase Auth 설정

### 환경 변수

`.env.local`에 Supabase 프로젝트의 브라우저용 URL과 anon/publishable key를 설정합니다.

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-or-publishable-key>
GOOGLE_MAPS_API_KEY=<server-only-google-places-key>
GEMINI_API_KEY=<server-only-gemini-key>
# Optional
GEMINI_MODEL=<model-name>
```

Google Places와 Gemini 키는 서버 환경 변수로만 둡니다. `NEXT_PUBLIC_` 접두사는 Supabase URL과 anon/publishable key에만 사용합니다. Supabase 서비스 역할 키는 이 앱에 추가하지 않습니다.

### 데이터베이스 마이그레이션

`supabase/migrations/20261014000100_add_auth_ownership_rls.sql`의 내용을 Supabase SQL Editor에서 검토한 뒤 실행하세요. 이 마이그레이션은 `trips.user_id`를 nullable로 추가하고 `trips`와 `itineraries`에 대한 기존 RLS 정책을 제거한 다음, 로그인 사용자 소유권 정책으로 교체합니다. 저장소에는 기존 정책 정의가 없어 실제 프로젝트에 적용된 정책은 확인하지 못했습니다. SQL Editor의 현재 정책을 먼저 검토하고, 이 두 테이블의 기존 접근 규칙이 위 정책으로 대체되어도 되는지 확인하세요. 배포 DB의 trips.user_id 컬럼 및 소유자 정책을 보장하려면 이후 보강 마이그레이션인 supabase/migrations/20261021000100_reconcile_trip_ownership.sql도 적용하세요. 이 작업은 기존 여행의 소유자를 추정하지 않으며, 컬럼이 이미 있으면 그대로 둡니다. PGRST204가 계속 발생하고 컬럼이 실제로 존재한다면 SQL Editor에서 NOTIFY pgrst, 'reload schema';를 실행한 뒤, Vercel의 Supabase URL이 해당 DB 프로젝트를 가리키는지 확인하세요.

기존 `user_id`가 없는 여행은 어떤 계정에도 할당하지 않습니다. RLS 적용 뒤에는 기존 여행 목록과 상세 화면에서 보이지 않으며, 원본 행은 삭제하지 않습니다. 데이터 소유권을 입증할 별도 정보가 있을 때만 별도의 검토된 이전 작업으로 계정에 연결하세요.

### Supabase Auth 대시보드

1. **Authentication → URL Configuration**에서 Site URL을 개발/운영 주소로 설정합니다.
2. Redirect URLs에 `http://localhost:3000/auth/callback`과 운영 도메인의 `/auth/callback`을 등록합니다.
3. 이메일 가입 인증을 사용할지 **Authentication → Providers → Email**에서 결정합니다. 이메일 인증이 켜져 있으면 가입 화면은 인증 메일 안내를 표시하며, 메일의 링크는 `/auth/callback`으로 돌아옵니다.
4. 비밀번호 재설정 링크도 위 callback을 거쳐 `/auth/reset-password`로 이동합니다. 배포 주소와 이메일 템플릿의 리디렉션 정책이 이 흐름을 허용하는지 확인하세요.
5. Google 로그인을 쓰려면 **Authentication → Providers → Google**을 활성화하고 Google OAuth Client ID와 Client Secret을 입력하세요. Google Cloud OAuth 설정에는 Supabase 대시보드가 안내하는 callback URL을 등록하고, Supabase URL Configuration에는 PLANLESS의 `/auth/callback` 주소를 허용해야 합니다. Provider를 설정하지 않은 상태에서는 Google 버튼이 로그인 성공을 표시하지 않고 설정 오류를 안내합니다.

이 저장소에서는 연결된 Supabase 프로젝트나 대시보드 설정을 확인할 수 없습니다. 위 SQL과 Provider 설정을 적용한 뒤 실제 프로젝트에서 이메일 인증, OAuth, RLS 동작을 확인하세요.
