import type { NextRequest } from "next/server";
import { buildMessages } from "@/lib/prompt";
import { streamScript } from "@/lib/openai";
import { getReferenceCandidates } from "@/lib/store";
import type { GenerateRequest } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let body: GenerateRequest;
  try {
    body = (await req.json()) as GenerateRequest;
  } catch {
    return new Response("잘못된 요청입니다.", { status: 400 });
  }

  if (!body.industry || !body.region || !body.purpose) {
    return new Response("업종·지역·제작 목적은 필수입니다.", { status: 400 });
  }

  // 레퍼런스 후보 풀을 프롬프트에 주입 (어떤 걸 쓸지는 AI 가 직접 고름)
  const refs = await getReferenceCandidates(body.industry);
  const messages = buildMessages(body, refs);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of streamScript(messages)) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "알 수 없는 오류";
        controller.enqueue(encoder.encode(`\n\n> ⚠️ 오류: ${message}`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
