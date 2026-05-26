import { NextResponse, type NextRequest } from "next/server";
import { getReferences, addReference } from "@/lib/store";
import { isAdmin } from "@/lib/auth";

export const runtime = "nodejs";

/** 레퍼런스 목록 (어드민 전용) */
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const list = await getReferences();
  return NextResponse.json(list);
}

/** 레퍼런스 추가 (어드민 전용) */
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  let body: { title?: string; industry?: string; content?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const { title, industry, content, note } = body;
  if (!title?.trim() || !industry?.trim() || !content?.trim()) {
    return NextResponse.json(
      { error: "제목·업종·대본 내용은 필수입니다." },
      { status: 400 },
    );
  }

  const ref = await addReference({
    title: title.trim(),
    industry: industry.trim(),
    content: content.trim(),
    note: note?.trim() || undefined,
  });
  return NextResponse.json(ref, { status: 201 });
}
