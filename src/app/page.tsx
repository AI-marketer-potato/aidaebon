"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { INDUSTRIES, REGIONS, PURPOSES, TONES } from "@/lib/constants";
import CustomSelect from "@/components/CustomSelect";

export default function HomePage() {
  const [industry, setIndustry] = useState("");
  const [region, setRegion] = useState("");
  const [purpose, setPurpose] = useState("");
  const [tone, setTone] = useState("");
  const [extra, setExtra] = useState("");

  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const canSubmit = Boolean(industry && region && purpose) && !loading;

  async function handleGenerate() {
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    setResult("");
    setCopied(false);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ industry, region, purpose, tone, extra }),
      });

      if (!res.ok || !res.body) {
        const msg = await res.text();
        throw new Error(msg || "생성에 실패했습니다.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setResult(acc);
        resultRef.current?.scrollTo({ top: resultRef.current.scrollHeight });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!result) return;
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-10 sm:px-8">
      {/* 헤더 */}
      <header className="fade-up flex flex-col items-center text-center">
        <span className="glass mb-5 rounded-full px-4 py-1.5 text-xs font-medium tracking-wide text-violet-200">
          ✨ AI 바이럴 릴스 대본 생성기
        </span>
        <h1 className="text-4xl font-black leading-tight sm:text-6xl">
          <span className="gradient-text">터지는 릴스 대본</span>
          <br />
          <span className="text-white/90">3초 만에 뽑아드려요</span>
        </h1>
        <p className="mt-5 max-w-xl text-balance text-base text-white/60 sm:text-lg">
          우리 가게 <b className="text-white/80">업종·지역·목적</b>만 고르면, AI가
          조회수 터지는 릴스 대본을 업체 맞춤으로 완성합니다.
        </p>
      </header>

      {/* 본문: 입력 / 결과 */}
      <main className="mt-12 grid flex-1 gap-6 lg:grid-cols-[440px_1fr]">
        {/* 입력 카드 */}
        <section className="glass fade-up h-fit rounded-3xl p-6 sm:p-8">
          <h2 className="mb-6 text-lg font-bold text-white/90">
            🎯 우리 가게 정보
          </h2>

          <div className="space-y-5">
            <Field label="업종" required>
              <CustomSelect
                value={industry}
                onChange={setIndustry}
                placeholder="업종을 선택하세요"
                options={INDUSTRIES}
              />
            </Field>

            <Field label="지역" required>
              <CustomSelect
                value={region}
                onChange={setRegion}
                placeholder="지역을 선택하세요"
                options={REGIONS}
              />
            </Field>

            <Field label="제작 목적" required>
              <CustomSelect
                value={purpose}
                onChange={setPurpose}
                placeholder="목적을 선택하세요"
                options={PURPOSES}
              />
            </Field>

            <Field label="분위기 / 톤 (선택)">
              <CustomSelect
                value={tone}
                onChange={setTone}
                placeholder="AI 추천 톤"
                options={TONES}
              />
            </Field>

            <Field label="추가 설명 (선택)">
              <textarea
                className="field w-full resize-none rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30"
                rows={3}
                placeholder="예) 이번 주말 신메뉴 출시, 20대 여성 타겟, 매장 분위기가 아늑함"
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
              />
            </Field>

            <button
              onClick={handleGenerate}
              disabled={!canSubmit}
              className="glow-btn mt-2 w-full rounded-xl px-6 py-4 text-base font-bold text-white"
            >
              {loading ? "대본 생성 중…" : "🚀 대본 생성하기"}
            </button>

            {error && (
              <p className="rounded-xl bg-red-500/15 px-4 py-3 text-sm text-red-200">
                {error}
              </p>
            )}
          </div>
        </section>

        {/* 결과 카드 */}
        <section className="glass fade-up flex min-h-[480px] flex-col rounded-3xl p-6 sm:p-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white/90">📝 생성된 대본</h2>
            {result && !loading && (
              <button
                onClick={handleCopy}
                className="glass rounded-lg px-3 py-1.5 text-xs font-medium text-violet-200 transition hover:text-white"
              >
                {copied ? "복사됨 ✓" : "전체 복사"}
              </button>
            )}
          </div>

          <div ref={resultRef} className="flex-1 overflow-y-auto pr-1">
            {!result && !loading && (
              <div className="flex h-full flex-col items-center justify-center text-center text-white/40">
                <div className="mb-3 text-5xl">🎬</div>
                <p className="text-sm">
                  왼쪽에서 정보를 선택하고
                  <br />
                  <b className="text-white/60">대본 생성하기</b>를 눌러보세요.
                </p>
              </div>
            )}

            {loading && !result && (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-white/50">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-violet-400/30 border-t-violet-400" />
                <p className="text-sm">AI가 터지는 후크를 짜는 중…</p>
              </div>
            )}

            {result && (
              <article
                className={`prose prose-invert max-w-none prose-headings:text-violet-200 prose-strong:text-white prose-li:text-white/80 prose-p:text-white/80 prose-table:text-white/80 ${
                  loading ? "typing-cursor" : ""
                }`}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {result}
                </ReactMarkdown>
              </article>
            )}
          </div>
        </section>
      </main>

      {/* 푸터 */}
      <footer className="mt-10 flex items-center justify-center gap-2 text-xs text-white/30">
        <span>© {new Date().getFullYear()} 릴스 대본 메이커</span>
        <span>·</span>
        <Link href="/admin" className="transition hover:text-white/60">
          관리자
        </Link>
      </footer>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-white/70">
        {label}
        {required && <span className="ml-1 text-pink-400">*</span>}
      </span>
      {children}
    </label>
  );
}
