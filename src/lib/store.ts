import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { put, del, list as listBlobs } from "@vercel/blob";
import type { Reference } from "./types";
import seedData from "../../data/references.json";

// ===== 레퍼런스 저장소 =====
// 같은 인터페이스(아래 5개 함수)로 두 가지 백엔드를 자동 선택한다.
//
//  - 배포(Vercel 등): 환경변수 BLOB_READ_WRITE_TOKEN 이 있으면 Vercel Blob
//    (클라우드에 저장하는 "파일")에 보관한다. 서버리스에서도 어드민이
//    추가·수정한 레퍼런스가 영구 보존된다. DB가 아니라 파일 저장이다.
//
//  - 로컬 개발: 토큰이 없으면 기존처럼 data/references.json 파일에 저장한다.
//    별도 설정 없이 `npm run dev` 가 그대로 동작한다.
//
// (OpenAI 키 유무로 실모드/데모모드가 갈리는 것과 같은 철학)

/** Blob/파일이 아직 비었을 때 보여줄 초기 데이터 (저장소에 첫 글이 들어오기 전까지) */
const SEED = seedData as Reference[];

/** 최신순 정렬 (createdAt 내림차순) */
function sortByNewest(list: Reference[]): Reference[] {
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const isBlobBackend = (): boolean => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

// ----- Vercel Blob 백엔드 -----

// 저장 파일은 매번 고유 이름(references-data-<random>.json)으로 쓴다.
// 공개 Blob 은 같은 URL 을 CDN 이 최대 1분 캐시하므로, 같은 파일명에 덮어쓰면
// 방금 저장한 내용을 곧바로 다시 읽을 때 옛 버전이 나온다(→ read-modify-write
// 과정에서 데이터 유실 위험). 매 저장마다 새 URL 을 만들면 캐시를 타지 않아
// 항상 최신본을 읽을 수 있다. 읽을 땐 list 로 최신 파일을 고른다.
const BLOB_PREFIX = "references-";

async function loadAllBlob(): Promise<Reference[]> {
  // list 는 파일이 없어도 빈 배열만 돌려줄 뿐 예외를 던지지 않는다.
  //   → 없으면 시드 폴백(쓰기 경로가 시드를 덮어쓰는 사고도 방지).
  const { blobs } = await listBlobs({ prefix: BLOB_PREFIX });
  if (blobs.length === 0) return SEED; // 아직 한 번도 저장 안 됨

  // 가장 최근에 저장된 파일을 읽는다 (새 URL 이라 CDN 캐시 미스 → 최신본 보장).
  const latest = blobs.reduce((a, b) =>
    a.uploadedAt.getTime() >= b.uploadedAt.getTime() ? a : b,
  );
  const res = await fetch(latest.url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Blob 읽기 실패: HTTP ${res.status}`);
  }
  return (await res.json()) as Reference[];
}

async function saveAllBlob(items: Reference[]): Promise<void> {
  // 고유 이름으로 새로 쓴다 (매번 새 URL → 캐시 회피 → 항상 최신 읽기 보장).
  const { url } = await put(
    `${BLOB_PREFIX}data.json`,
    JSON.stringify(items, null, 2),
    {
      access: "public", // CLI 로 만든 스토어는 public. 레퍼런스는 비민감 정보.
      addRandomSuffix: true,
      contentType: "application/json",
    },
  );

  // 방금 쓴 것 외의 옛 버전 정리 (실패해도 저장 자체엔 영향 없음).
  try {
    const { blobs } = await listBlobs({ prefix: BLOB_PREFIX });
    const stale = blobs.filter((b) => b.url !== url).map((b) => b.url);
    if (stale.length > 0) await del(stale);
  } catch (err) {
    console.error("[store] 옛 Blob 정리 실패(무시 가능):", err);
  }
}

// ----- 로컬 파일 백엔드 -----

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "references.json");

async function ensureFile(): Promise<void> {
  try {
    await fs.access(FILE);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(FILE, "[]", "utf-8");
  }
}

async function loadAllFile(): Promise<Reference[]> {
  await ensureFile();
  const raw = await fs.readFile(FILE, "utf-8");
  return JSON.parse(raw) as Reference[];
}

async function saveAllFile(list: Reference[]): Promise<void> {
  await ensureFile();
  await fs.writeFile(FILE, JSON.stringify(list, null, 2), "utf-8");
}

// ----- 백엔드 선택 -----

function loadAll(): Promise<Reference[]> {
  return isBlobBackend() ? loadAllBlob() : loadAllFile();
}

function saveAll(list: Reference[]): Promise<void> {
  return isBlobBackend() ? saveAllBlob(list) : saveAllFile(list);
}

// ===== 공개 API =====

/**
 * 전체 레퍼런스 조회 (최신순).
 * 저장소 읽기에 실패하면 예외를 던진다 — 호출 측(쓰기 작업)이 시드를 잘못
 * 덮어쓰지 않도록 하기 위함. 프론트 읽기 경로는 getReferencesForIndustry 에서
 * 별도로 폴백 처리한다.
 */
export async function getReferences(): Promise<Reference[]> {
  return sortByNewest(await loadAll());
}

/** 신규 레퍼런스 추가 */
export async function addReference(
  input: Omit<Reference, "id" | "createdAt">,
): Promise<Reference> {
  const list = await getReferences();
  const ref: Reference = {
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  await saveAll([ref, ...list]);
  return ref;
}

/** 레퍼런스 수정 */
export async function updateReference(
  id: string,
  patch: Partial<Omit<Reference, "id" | "createdAt">>,
): Promise<Reference | null> {
  const list = await getReferences();
  const idx = list.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch };
  await saveAll(list);
  return list[idx];
}

/** 레퍼런스 삭제 */
export async function deleteReference(id: string): Promise<boolean> {
  const list = await getReferences();
  const next = list.filter((r) => r.id !== id);
  if (next.length === list.length) return false;
  await saveAll(next);
  return true;
}

/**
 * 특정 업종에 맞는 레퍼런스 선별 (프론트 대본 생성용).
 * 해당 업종 + "공통" 태그를 우선 포함하고, 부족하면 나머지로 채운다.
 * 저장소 읽기에 실패해도 시드 데이터로 폴백해 대본 생성이 멈추지 않게 한다.
 */
export async function getReferencesForIndustry(
  industry: string,
  limit = 4,
): Promise<Reference[]> {
  let list: Reference[];
  try {
    list = await getReferences();
  } catch (err) {
    console.error("[store] 레퍼런스 로드 실패 — 시드로 대체합니다:", err);
    list = sortByNewest(SEED);
  }

  const matched = list.filter(
    (r) => r.industry === industry || r.industry === "공통",
  );
  const picked = matched.slice(0, limit);
  if (picked.length < limit) {
    const rest = list.filter((r) => !picked.includes(r));
    picked.push(...rest.slice(0, limit - picked.length));
  }
  return picked;
}
