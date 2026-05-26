import { NextResponse, type NextRequest } from "next/server";
import { updateReference, deleteReference } from "@/lib/store";
import { isAdmin } from "@/lib/auth";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** 레퍼런스 수정 (어드민 전용) */
export async function PUT(req: NextRequest, { params }: Params) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const { id } = await params;

  let body: { title?: string; industry?: string; content?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const updated = await updateReference(id, {
    ...(body.title !== undefined && { title: body.title.trim() }),
    ...(body.industry !== undefined && { industry: body.industry.trim() }),
    ...(body.content !== undefined && { content: body.content.trim() }),
    ...(body.note !== undefined && { note: body.note.trim() || undefined }),
  });

  if (!updated) {
    return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json(updated);
}

/** 레퍼런스 삭제 (어드민 전용) */
export async function DELETE(req: NextRequest, { params }: Params) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const { id } = await params;
  const ok = await deleteReference(id);
  if (!ok) {
    return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
