# 🎬 릴스 대본 메이커 (AI 바이럴 스크립트 생성기)

업종·지역·제작목적만 고르면, AI가 **우리 가게 맞춤형 "터지는 릴스 대본"** 을 뽑아주는 서비스입니다.
화면은 화려하게, 뒷단은 **프롬프트 중심**으로 설계되어 있습니다.

## 구조

- **앞 화면 `/`** — 사용자가 업종·지역·목적(+톤/추가설명)만 선택하면 실시간 스트리밍으로 대본 생성
- **어드민 `/admin`** — 관리자가 "터진 릴스" 예시 대본(레퍼런스)을 업종별로 등록/수정/삭제
  → 등록된 레퍼런스를 프롬프트가 참고해 업체 맞춤 대본을 만듭니다.

## 핵심 파일

| 파일 | 역할 |
| --- | --- |
| `src/lib/prompt.ts` | **서비스의 심장** — 대본 생성 프롬프트 (여기만 손보면 결과 품질이 바뀜) |
| `src/lib/openai.ts` | OpenAI 스트리밍 호출 + 키 없을 때 데모 폴백 |
| `src/lib/store.ts` | 레퍼런스 저장소 (파일 기반 `data/references.json`) |
| `src/app/page.tsx` | 앞 화면 UI |
| `src/app/admin/page.tsx` | 어드민 UI |

## 시작하기

```bash
npm install
npm run dev
# http://localhost:3000        (앞 화면)
# http://localhost:3000/admin  (관리자, 기본 비번: aidaebon)
```

### 실제 AI로 동작시키기

`.env.local` 에 OpenAI 키를 넣으세요 (비워두면 **데모 모드**로 동작):

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
ADMIN_PASSWORD=원하는_관리자_비밀번호
```

## 참고: 배포(Vercel)

레퍼런스는 현재 로컬 파일(`data/references.json`)에 저장됩니다. 로컬 개발에선 영구 저장되지만,
**Vercel 같은 서버리스 환경에선 어드민에서 추가한 데이터가 유지되지 않습니다.**
배포 후에도 영구 저장하려면 `src/lib/store.ts` 만 DB(Upstash Redis / Neon Postgres 등)로 교체하면 됩니다.
