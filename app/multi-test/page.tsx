"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { isMultiTestAllowedDataset, MULTI_TEST_DATASET_ALLOWLIST } from "../lib/multiTestAllowlist";
import { getDataVersionSync } from "../lib/datasets";
import { QuestionReviewBadges } from "../components/QuestionReviewBadges";

const LABELS = ["A", "B", "C", "D"] as const;

type MultiIndex = {
  bank_kind?: string;
  datasets: { id: string; label: string; file: string }[];
};

type QuestionAsset = {
  type: string;
  src: string;
  alt?: string;
};

type MultiQuestion = {
  id: string;
  question_type?: string;
  question_text: string;
  options: string[];
  correct_answers: string[];
  assets?: QuestionAsset[];
  official_note?: string | null;
  review_flag?: boolean;
  is_deleted?: boolean;
};

function setsEqualLetters(a: string[], b: string[]): boolean {
  const norm = (x: string) => x.trim().toUpperCase();
  const sa = new Set(a.map(norm).filter(Boolean));
  const sb = new Set(b.map(norm).filter(Boolean));
  if (sa.size !== sb.size) return false;
  return Array.from(sa).every((x) => sb.has(x));
}

export default function MultiTestPage() {
  const [datasets, setDatasets] = useState<{ id: string; label: string; file: string }[]>([]);
  const [datasetId, setDatasetId] = useState<string>("");
  const [questions, setQuestions] = useState<MultiQuestion[]>([]);
  const [loadingIndex, setLoadingIndex] = useState(true);
  const [loadingQs, setLoadingQs] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [qIndex, setQIndex] = useState(0);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [submitted, setSubmitted] = useState<"idle" | "correct" | "wrong">("idle");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/data/multi/index.json", { cache: "no-store" });
        if (!res.ok) throw new Error("無法載入 multi index");
        const data: MultiIndex = await res.json();
        const list = (data.datasets ?? []).filter((d) => isMultiTestAllowedDataset(d.id));
        list.sort((a, b) => a.id.localeCompare(b.id));
        if (cancelled) return;
        setDatasets(list);
        if (list.length > 0) setDatasetId(list[0].id);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "載入失敗");
      } finally {
        if (!cancelled) setLoadingIndex(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!datasetId) {
      setQuestions([]);
      return;
    }
    const ds = datasets.find((d) => d.id === datasetId);
    if (!ds) return;
    let cancelled = false;
    setLoadingQs(true);
    setErr(null);
    (async () => {
      try {
        const res = await fetch(`/data/multi/${encodeURIComponent(ds.file)}`, { cache: "no-store" });
        if (!res.ok) throw new Error("無法載入題庫：" + ds.file);
        const raw: MultiQuestion[] = await res.json();
        const multi = Array.isArray(raw)
          ? raw.filter((q) => (q.question_type ?? "multi") === "multi" && Array.isArray(q.correct_answers))
          : [];
        if (cancelled) return;
        setQuestions(multi);
        setQIndex(0);
        setPicked(new Set());
        setSubmitted("idle");
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "載入題目失敗");
      } finally {
        if (!cancelled) setLoadingQs(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [datasetId, datasets]);

  const q = questions[qIndex];
  const total = questions.length;

  const toggle = useCallback((letter: string) => {
    setSubmitted("idle");
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(letter)) next.delete(letter);
      else next.add(letter);
      return next;
    });
  }, []);

  const submit = useCallback(() => {
    if (!q) return;
    const ok = setsEqualLetters(Array.from(picked), q.correct_answers);
    setSubmitted(ok ? "correct" : "wrong");
  }, [q, picked]);

  const go = useCallback(
    (delta: number) => {
      setQIndex((i) => {
        const n = i + delta;
        if (n < 0 || n >= total) return i;
        return n;
      });
      setPicked(new Set());
      setSubmitted("idle");
    },
    [total]
  );

  const allowlistNote = useMemo(
    () =>
      `目前開放 ${MULTI_TEST_DATASET_ALLOWLIST.size} 份資料集測試（含 12500 室內設計題庫），不含綜合 A/B。`,
    []
  );

  if (loadingIndex) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-neutral-50">
        <p className="text-neutral-600">載入題庫清單…</p>
      </main>
    );
  }

  if (datasets.length === 0) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-neutral-50">
        <p className="text-red-600 text-center">允許清單內沒有任何 dataset，請確認 public/data/multi/index.json。</p>
        <Link href="/" className="text-[#111] underline">
          回首頁
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50 text-[#111] pb-24">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/95 backdrop-blur px-4 py-3">
        <div className="max-w-lg mx-auto flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-lg font-semibold">Multi 內測</h1>
            <Link href="/" className="text-sm text-neutral-600 shrink-0">
              回首頁
            </Link>
          </div>
          <p className="text-xs text-neutral-500 leading-snug">{allowlistNote}</p>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-neutral-700">題庫</span>
          <select
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-3 text-base min-h-[48px]"
            value={datasetId}
            onChange={(e) => setDatasetId(e.target.value)}
          >
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </label>

        {err && <p className="text-red-600 text-sm">{err}</p>}

        {loadingQs && <p className="text-neutral-500">載入題目中…</p>}

        {!loadingQs && q && (
          <>
            <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-neutral-500 mb-2">
                第 {qIndex + 1} / {total} 題 · {q.id}
              </p>
              <QuestionReviewBadges
                officialNote={q.official_note}
                reviewFlag={q.review_flag}
              />
              <p className="text-base leading-relaxed whitespace-pre-wrap">{q.question_text}</p>
              {q.assets && q.assets.length > 0 && (
                <div className="mt-4 space-y-2">
                  {q.assets
                    .filter((a) => a.type === "image" && a.src)
                    .map((a, idx) => {
                      const v = getDataVersionSync();
                      const src =
                        a.src + (v ? (a.src.includes("?") ? "&" : "?") + "v=" + encodeURIComponent(v) : "");
                      return (
                        <img
                          key={idx}
                          src={src}
                          alt={a.alt || "題目圖"}
                          className="max-w-full h-auto rounded-lg border border-neutral-200"
                        />
                      );
                    })}
                </div>
              )}
            </div>

            <div className="space-y-2">
              {LABELS.map((letter, idx) => {
                const text = q.options[idx] ?? "（缺）";
                const on = picked.has(letter);
                return (
                  <label
                    key={letter}
                    className={`flex items-start gap-3 rounded-xl border-2 px-3 py-3 min-h-[52px] cursor-pointer active:bg-neutral-100 ${
                      on ? "border-[#111] bg-neutral-100" : "border-neutral-200 bg-white"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(letter)}
                      className="mt-1 w-5 h-5 shrink-0 accent-[#111]"
                    />
                    <span className="text-base leading-relaxed flex-1">
                      <span className="font-semibold mr-2">{letter}.</span>
                      <span className="whitespace-pre-wrap">{text}</span>
                    </span>
                  </label>
                );
              })}
            </div>

            <button
              type="button"
              onClick={submit}
              className="w-full rounded-xl bg-[#111] text-white py-4 text-base font-medium min-h-[52px]"
            >
              確認答案
            </button>

            {submitted !== "idle" && (
              <div
                className={`rounded-xl px-4 py-3 text-center text-base font-medium ${
                  submitted === "correct" ? "bg-emerald-100 text-emerald-900" : "bg-rose-100 text-rose-900"
                }`}
              >
                {submitted === "correct" ? "正確" : "錯誤"}
                {submitted === "wrong" && (
                  <p className="text-sm font-normal mt-1 opacity-90">
                    正解：{Array.from(new Set(q.correct_answers.map((x) => x.toUpperCase()))).sort().join("、")}
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={qIndex <= 0}
                onClick={() => go(-1)}
                className="flex-1 rounded-xl border-2 border-neutral-300 bg-white py-4 text-base min-h-[52px] disabled:opacity-40"
              >
                上一題
              </button>
              <button
                type="button"
                disabled={qIndex >= total - 1}
                onClick={() => go(1)}
                className="flex-1 rounded-xl border-2 border-neutral-300 bg-white py-4 text-base min-h-[52px] disabled:opacity-40"
              >
                下一題
              </button>
            </div>
          </>
        )}

        {!loadingQs && !q && !err && (
          <p className="text-neutral-500">此題庫沒有複選題。</p>
        )}
      </div>
    </main>
  );
}
