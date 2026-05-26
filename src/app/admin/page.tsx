"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { REFERENCE_INDUSTRIES } from "@/lib/constants";
import type { Reference } from "@/lib/types";
import CustomSelect from "@/components/CustomSelect";

const STORAGE_KEY = "aidaebon-admin-pw";

type SortKey = "recent" | "title" | "industry";
type Toast = { id: number; msg: string; type: "ok" | "err" };

export default function AdminPage() {
  const [pw, setPw] = useState("");
  const [authed, setAuthed] = useState(false);
  const [refs, setRefs] = useState<Reference[]>([]);
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading] = useState(false);

  // 툴바 상태
  const [query, setQuery] = useState("");
  const [filterIndustry, setFilterIndustry] = useState("전체");
  const [sortKey, setSortKey] = useState<SortKey>("recent");

  // 드로어(등록/수정) 상태
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [industry, setIndustry] = useState<string>(REFERENCE_INDUSTRIES[1]);
  const [content, setContent] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // 토스트
  const [toast, setToast] = useState<Toast | null>(null);
  function showToast(msg: string, type: "ok" | "err" = "ok") {
    const id = Date.now();
    setToast({ id, msg, type });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 2600);
  }

  const loadRefs = useCallback(async (password: string) => {
    setLoading(true);
    setLoginError("");
    try {
      const res = await fetch("/api/references", {
        headers: { "x-admin-password": password },
      });
      if (res.status === 401) {
        setAuthed(false);
        sessionStorage.removeItem(STORAGE_KEY);
        setLoginError("비밀번호가 올바르지 않습니다.");
        return;
      }
      if (!res.ok) throw new Error("목록을 불러오지 못했습니다.");
      const data = (await res.json()) as Reference[];
      setRefs(data);
      setPw(password);
      setAuthed(true);
      sessionStorage.setItem(STORAGE_KEY, password);
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    const id = setTimeout(() => loadRefs(saved), 0);
    return () => clearTimeout(id);
  }, [loadRefs]);

  function logout() {
    sessionStorage.removeItem(STORAGE_KEY);
    setAuthed(false);
    setPw("");
    setRefs([]);
  }

  // ===== 파생 데이터 =====
  const stats = useMemo(() => {
    const total = refs.length;
    const covered = new Set(refs.map((r) => r.industry)).size;
    const common = refs.filter((r) => r.industry === "공통").length;
    const latest = refs[0]?.createdAt
      ? new Date(refs[0].createdAt).toLocaleDateString("ko-KR", {
          month: "long",
          day: "numeric",
        })
      : "-";
    return { total, covered, common, latest };
  }, [refs]);

  const distribution = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of refs) map.set(r.industry, (map.get(r.industry) ?? 0) + 1);
    const arr = [...map.entries()].sort((a, b) => b[1] - a[1]);
    const max = arr[0]?.[1] ?? 1;
    return { arr: arr.slice(0, 8), max };
  }, [refs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = refs.filter((r) => {
      const okIndustry =
        filterIndustry === "전체" || r.industry === filterIndustry;
      const okQuery =
        !q ||
        r.title.toLowerCase().includes(q) ||
        r.content.toLowerCase().includes(q) ||
        (r.note ?? "").toLowerCase().includes(q);
      return okIndustry && okQuery;
    });
    const sorted = [...list];
    if (sortKey === "title") sorted.sort((a, b) => a.title.localeCompare(b.title));
    else if (sortKey === "industry")
      sorted.sort((a, b) => a.industry.localeCompare(b.industry));
    else sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return sorted;
  }, [refs, query, filterIndustry, sortKey]);

  // ===== 드로어 핸들러 =====
  function openAdd() {
    setEditingId(null);
    setTitle("");
    setIndustry(REFERENCE_INDUSTRIES[1]);
    setContent("");
    setNote("");
    setFormError("");
    setDrawerOpen(true);
  }
  function openEdit(ref: Reference) {
    setEditingId(ref.id);
    setTitle(ref.title);
    setIndustry(ref.industry);
    setContent(ref.content);
    setNote(ref.note ?? "");
    setFormError("");
    setDrawerOpen(true);
  }

  async function handleSave() {
    if (!title.trim() || !content.trim()) {
      setFormError("제목과 대본 내용은 필수입니다.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const url = editingId ? `/api/references/${editingId}` : "/api/references";
      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": pw },
        body: JSON.stringify({ title, industry, content, note }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "저장에 실패했습니다.");
      }
      setDrawerOpen(false);
      await loadRefs(pw);
      showToast(editingId ? "레퍼런스를 수정했어요." : "레퍼런스를 등록했어요.");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(ref: Reference) {
    if (!confirm(`"${ref.title}" 레퍼런스를 삭제할까요?`)) return;
    try {
      const res = await fetch(`/api/references/${ref.id}`, {
        method: "DELETE",
        headers: { "x-admin-password": pw },
      });
      if (!res.ok) throw new Error();
      await loadRefs(pw);
      showToast("삭제했어요.");
    } catch {
      showToast("삭제에 실패했습니다.", "err");
    }
  }

  // ===== 로그인 화면 =====
  if (!authed) {
    return (
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-5">
        <div className="glass fade-up w-full rounded-3xl p-8">
          <h1 className="mb-1 text-2xl font-black">
            <span className="gradient-text">관리자 콘솔</span>
          </h1>
          <p className="mb-6 text-sm text-white/50">
            레퍼런스(예시 대본) 라이브러리를 관리합니다.
          </p>
          <input
            type="password"
            className="field w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30"
            placeholder="관리자 비밀번호"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadRefs(pw)}
          />
          {loginError && <p className="mt-3 text-sm text-red-300">{loginError}</p>}
          <button
            onClick={() => loadRefs(pw)}
            disabled={loading || !pw}
            className="glow-btn mt-5 w-full rounded-xl px-6 py-3.5 font-bold text-white"
          >
            {loading ? "확인 중…" : "로그인"}
          </button>
          <Link
            href="/"
            className="mt-5 block text-center text-xs text-white/40 transition hover:text-white/70"
          >
            ← 메인으로
          </Link>
        </div>
      </div>
    );
  }

  // ===== 대시보드 =====
  return (
    <div className="relative z-10 mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
      {/* 상단 바 */}
      <header className="fade-up mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black sm:text-3xl">
            <span className="gradient-text">레퍼런스 대시보드</span>
          </h1>
          <p className="mt-1 text-sm text-white/50">
            등록된 레퍼런스가 대본 생성 프롬프트에 자동 반영됩니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="glass rounded-xl px-4 py-2 text-sm text-violet-200 transition hover:text-white"
          >
            메인 →
          </Link>
          <button
            onClick={logout}
            className="glass rounded-xl px-4 py-2 text-sm text-white/60 transition hover:text-white"
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* KPI 카드 */}
      <section className="fade-up mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon="📚" label="총 레퍼런스" value={`${stats.total}개`} />
        <StatCard icon="🏷️" label="커버 업종" value={`${stats.covered}종`} />
        <StatCard icon="🌐" label="공통 레퍼런스" value={`${stats.common}개`} />
        <StatCard icon="🕒" label="최근 등록" value={stats.latest} />
      </section>

      {/* 업종별 분포 */}
      {refs.length > 0 && (
        <section className="glass fade-up mb-8 rounded-3xl p-6 sm:p-7">
          <h2 className="mb-4 text-sm font-bold text-white/70">업종별 분포</h2>
          <div className="space-y-3">
            {distribution.arr.map(([name, count]) => (
              <div key={name} className="flex items-center gap-3">
                <span className="w-28 shrink-0 truncate text-xs text-white/60">
                  {name}
                </span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="bar-fill h-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500"
                    style={{ width: `${(count / distribution.max) * 100}%` }}
                  />
                </div>
                <span className="w-6 shrink-0 text-right text-xs text-white/50">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 툴바 */}
      <section className="fade-up mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40">
            🔍
          </span>
          <input
            className="field w-full rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/30"
            placeholder="제목·대본·메모 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <CustomSelect
          className="w-36"
          value={filterIndustry}
          onChange={setFilterIndustry}
          options={[
            { label: "전체 업종", value: "전체" },
            ...REFERENCE_INDUSTRIES.map((v) => ({ label: v, value: v })),
          ]}
        />
        <CustomSelect
          className="w-28"
          value={sortKey}
          onChange={(v) => setSortKey(v as SortKey)}
          options={[
            { label: "최신순", value: "recent" },
            { label: "제목순", value: "title" },
            { label: "업종순", value: "industry" },
          ]}
        />
        <button
          onClick={openAdd}
          className="glow-btn rounded-xl px-5 py-2.5 text-sm font-bold text-white"
        >
          ➕ 새 레퍼런스
        </button>
      </section>

      {/* 레퍼런스 목록 (1열, 대본 전체 표시) */}
      <section className="space-y-4">
        {filtered.length === 0 && (
          <div className="glass rounded-2xl py-16 text-center text-sm text-white/40">
            {refs.length === 0
              ? "아직 등록된 레퍼런스가 없습니다. ‘새 레퍼런스’로 추가해보세요."
              : "조건에 맞는 레퍼런스가 없습니다."}
          </div>
        )}
        {filtered.map((ref) => (
          <article
            key={ref.id}
            className="glass fade-up flex flex-col rounded-2xl p-5 transition hover:border-violet-400/40"
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="mb-1.5 inline-block rounded-md bg-violet-500/20 px-2 py-0.5 text-xs font-medium text-violet-200">
                  {ref.industry}
                </span>
                <h3 className="truncate font-bold text-white/90">{ref.title}</h3>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => openEdit(ref)}
                  className="rounded-lg px-2.5 py-1.5 text-xs text-white/60 transition hover:bg-white/10 hover:text-white"
                >
                  수정
                </button>
                <button
                  onClick={() => handleDelete(ref)}
                  className="rounded-lg px-2.5 py-1.5 text-xs text-red-300/70 transition hover:bg-red-500/15 hover:text-red-200"
                >
                  삭제
                </button>
              </div>
            </div>
            <pre className="flex-1 whitespace-pre-wrap break-words rounded-xl bg-white/[0.03] p-4 font-sans text-[15px] leading-relaxed text-white/70">
              {ref.content}
            </pre>
            {ref.note && (
              <p className="mt-3 border-t border-white/10 pt-3 text-xs text-white/40">
                💡 {ref.note}
              </p>
            )}
          </article>
        ))}
      </section>

      {/* ===== 등록/수정 드로어 ===== */}
      <div
        className={`fixed inset-0 z-40 transition ${
          drawerOpen ? "visible" : "invisible"
        }`}
      >
        {/* 백드롭 */}
        <div
          onClick={() => setDrawerOpen(false)}
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
            drawerOpen ? "opacity-100" : "opacity-0"
          }`}
        />
        {/* 패널 */}
        <div
          className={`glass absolute right-0 top-0 h-full w-full max-w-[480px] overflow-y-auto p-6 shadow-2xl transition-transform duration-300 sm:p-8 ${
            drawerOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white/90">
              {editingId ? "✏️ 레퍼런스 수정" : "➕ 새 레퍼런스 등록"}
            </h2>
            <button
              onClick={() => setDrawerOpen(false)}
              className="rounded-lg px-3 py-1.5 text-sm text-white/50 transition hover:bg-white/10 hover:text-white"
            >
              닫기 ✕
            </button>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-white/70">
                제목 <span className="text-pink-400">*</span>
              </span>
              <input
                className="field w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30"
                placeholder="예) 오픈런 부르는 카페 신메뉴 후킹"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-white/70">
                업종 태그
              </span>
              <CustomSelect
                value={industry}
                onChange={setIndustry}
                options={REFERENCE_INDUSTRIES}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-white/70">
                대본 내용 <span className="text-pink-400">*</span>
              </span>
              <textarea
                className="field w-full resize-y rounded-xl px-4 py-3 font-mono text-sm leading-relaxed text-white placeholder:text-white/30"
                rows={9}
                placeholder={"후크: ...\n씬1: ...\n씬2: ...\nCTA: ..."}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-white/70">
                메모 — 왜 터졌는지 (선택, 프롬프트에 함께 전달)
              </span>
              <input
                className="field w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30"
                placeholder="예) 한정 수량 + 시간 압박으로 즉시 방문 유도"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>

            {formError && <p className="text-sm text-red-300">{formError}</p>}

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="glow-btn flex-1 rounded-xl px-6 py-3 font-bold text-white"
              >
                {saving ? "저장 중…" : editingId ? "수정 저장" : "등록하기"}
              </button>
              <button
                onClick={() => setDrawerOpen(false)}
                className="glass rounded-xl px-6 py-3 font-medium text-white/70 transition hover:text-white"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ===== 토스트 ===== */}
      {toast && (
        <div
          className={`toast-in glass fixed bottom-6 right-6 z-50 rounded-xl px-5 py-3.5 text-sm font-medium shadow-2xl ${
            toast.type === "ok" ? "text-emerald-200" : "text-red-200"
          }`}
        >
          {toast.type === "ok" ? "✓ " : "⚠️ "}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="stat-card glass rounded-2xl p-5">
      <div className="mb-2 text-2xl">{icon}</div>
      <div className="text-2xl font-black text-white/90">{value}</div>
      <div className="mt-0.5 text-xs text-white/50">{label}</div>
    </div>
  );
}
