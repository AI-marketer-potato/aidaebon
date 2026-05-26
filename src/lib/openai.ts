import OpenAI from "openai";
import type { ChatMessage } from "./prompt";

// OpenAI 호출 래퍼.
// - API 키는 반드시 환경변수(OPENAI_API_KEY)에서만 읽는다. (하드코딩 금지)
// - 키가 없으면 데모 스트림으로 폴백해 키 없이도 화면이 동작한다.

const MODEL = process.env.OPENAI_MODEL || "gpt-4o";

export function hasApiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/** 대본 텍스트를 토큰 단위로 스트리밍한다. */
export async function* streamScript(
  messages: ChatMessage[],
): AsyncGenerator<string> {
  if (!hasApiKey()) {
    yield* demoStream();
    return;
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const stream = await client.chat.completions.create({
      model: MODEL,
      messages,
      temperature: 0.85,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    yield `\n\n> ⚠️ 대본 생성 중 오류가 발생했어요: ${message}\n> OPENAI_API_KEY 와 OPENAI_MODEL(현재: ${MODEL}) 설정을 확인해주세요.`;
  }
}

/** 키가 없을 때 보여줄 데모 대본 (타이핑 효과용 청크 스트리밍) */
async function* demoStream(): AsyncGenerator<string> {
  const demo = `## 🎬 추천 콘셉트 3가지
1. **"이걸 몰랐다고요?"** — 동네 사장님만 아는 꿀팁으로 시작하는 정보형
2. **"손님이 줄 서는 이유"** — 가게 비하인드 + 반전 공개
3. **"3초 안에 결정나는 첫인상"** — 비포/애프터 대비 영상

> 아래는 위 1번 콘셉트 기준 풀 대본입니다. *(현재 데모 모드 — OPENAI_API_KEY 를 넣으면 진짜 맞춤 대본이 생성됩니다.)*

## 🪝 후크 (0–3초)
- **화면 자막:** "우리 동네에 이런 곳이 있었어?"
- **멘트/나레이션:** "잠깐, 이거 모르고 지나치면 진짜 손해예요."

## 🎞 장면별 대본
**씬 1 · 2초**
- 🎥 화면/연출: 가게 외관을 빠르게 줌인
- 💬 자막: 우리 동네 숨은 맛집
- 🎙 멘트: 매일 지나치던 그 골목,

**씬 2 · 4초**
- 🎥 화면/연출: 시그니처 메뉴 클로즈업, 슬로우모션
- 💬 자막: 이걸 안 먹어봤다고?
- 🎙 멘트: 사장님이 직접 만드는 이 메뉴 때문에 단골이 끊이질 않아요.

## 📣 CTA (마무리)
- **화면 자막:** "저장하고 주말에 가보세요 📍"
- **멘트:** "위치는 프로필 링크에! 댓글로 같이 갈 친구 소환하세요."

## ✍️ 업로드 캡션 & 해시태그
- **캡션:** 우리 동네에 이런 곳이 숨어있었다니 🤫 저장 필수!
- **해시태그:** #동네맛집 #로컬맛집 #숨은맛집 #데이트코스 #주말나들이

## 🎯 촬영·편집 꿀팁
- 첫 1초는 무조건 움직임(줌/팬)으로 시선 고정
- 자막은 화면 중앙, 큼직하게
- 트렌디한 배경음악으로 리듬감 주기`;

  // 단어 단위로 끊어 타이핑 효과
  const tokens = demo.split(/(\s+)/);
  for (const t of tokens) {
    yield t;
    await new Promise((r) => setTimeout(r, 12));
  }
}
