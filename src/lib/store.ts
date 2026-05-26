import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { put, list as listBlobs } from "@vercel/blob";
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

const BLOB_KEY = "references.json"; // Blob 안의 고정 파일명

async function loadAllBlob(): Promise<Reference[]> {
  // 먼저 list 로 파일 존재 여부를 확인한다.
  //  - list 는 파일이 없어도 빈 배열을 돌려줄 뿐 예외를 던지지 않는다.
  //    (get 은 빈 저장소에서 400 을 던져 첫 사용 시 500 을 유발했었음)
  //  - 없으면 시드 데이터로 폴백 → 쓰기 경로가 시드를 덮어쓰는 사고도 방지.
  const { blobs } = await listBlobs({ prefix: BLOB_KEY, limit: 1 });
  const found = blobs.find((b) => b.pathname === BLOB_KEY);
  if (!found) return SEED; // 아직 한 번도 저장 안 됨

  // 공개 blob URL 을 직접 fetch. cache:no-store 로 가능한 최신본을 읽는다.
  const res = await fetch(found.url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Blob 읽기 실패: HTTP ${res.status}`);
  }
  return (await res.json()) as Reference[];
}

async function saveAllBlob(items: Reference[]): Promise<void> {
  await put(BLOB_KEY, JSON.stringify(items, null, 2), {
    access: "public", // CLI 로 만든 스토어는 public. 레퍼런스는 비민감 정보.
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60, // 최소값(1분). 어드민 수정이 늦어도 1분 내 반영
  });
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
