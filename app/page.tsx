"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchQuestions, getChapters, fetchIndexDatasets } from "./lib/questions";
import {
  getTodayAnsweredCount,
  getWrongIds,
  getPerfectCount,
  getWrongBySubject,
  getAttemptBySubject,
  clearSubjectStats,
} from "./lib/storage";
import { MULTI_TEST_DATASET_ALLOWLIST } from "./lib/multiTestAllowlist";

const COUNT_OPTIONS = [20, 50, 100] as const;

export default function HomePage() {
  const [chapters, setChapters] = useState<string[]>(["ALL"]);
  const [datasets, setDatasets] = useState<{ id: string; label: string }[]>([
    { id: "ALL", label: "全部題庫" },
  ]);
  const [count, setCount] = useState<number>(100);
  const [chapter, setChapter] = useState<string>("ALL");
  const [dataset, setDataset] = useState<string>("ALL");
  const [todayCount, setTodayCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [perfectCount, setPerfectCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataStatus, setDataStatus] = useState<{
    data_version: string;
    dataset_count?: number;
    total_questions?: number;
    verified_at?: string;
  } | null>(null);
  const [subjectStats, setSubjectStats] = useState<
    { key: string; label: string; wrong: number; attempt: number; rate: number }[]
  >([]);

  useEffect(() => {
    setError(null);
    fetchIndexDatasets()
      .then((list) => {
        setDatasets(list);
        return fetchQuestions("ALL");
      })
      .then((q) => setChapters(getChapters(q)))
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "題庫載入失敗";
        setError(msg);
        setChapters(["ALL"]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch("/data/verify_result.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((v) => {
        if (v && v.ok) {
          setDataStatus({
            data_version: v.data_version,
            dataset_count: v.dataset_count,
            total_questions: v.total_questions,
            verified_at: v.verified_at,
          });
          return null;
        }
        return fetch("/data/meta.json", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null));
      })
      .then((m) => {
        if (m?.data_version) setDataStatus((prev) => prev ?? { data_version: m.data_version });
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    setTodayCount(getTodayAnsweredCount());
    setWrongCount(getWrongIds().length);
    setPerfectCount(getPerfectCount());

    const wrongBy = getWrongBySubject();
    const attemptBy = getAttemptBySubject();
    const keys = new Set([...Object.keys(wrongBy), ...Object.keys(attemptBy)]);

    const labelMap: Record<string, string> = {
      y105: "105 工程管理學科",
      y106: "106 工程管理學科",
      y107: "107 工程管理學科",
      y108: "108 工程管理學科",
      y109: "109 工程管理學科",
      y110: "110 工程管理學科",
      y111: "111 工程管理學科",
      y112: "112 工程管理學科",
      y113: "113 工程管理學科",
      y90006: "90006 共同科目",
      y90007: "90007 共同科目",
      y90008: "90008 共同科目",
      y90009: "90009 共同科目",
      zonghe_a: "綜合A",
      zonghe_b: "綜合B",
      a: "綜合A",
      b: "綜合B",
      v1: "v1 測試題庫",
    };

    const list = Array.from(keys)
      .filter((k) => (attemptBy[k] ?? 0) > 0)
      .map((k) => ({
        key: k,
        label: labelMap[k] ?? k,
        wrong: wrongBy[k] ?? 0,
        attempt: attemptBy[k] ?? 0,
        rate:
          (attemptBy[k] ?? 0) > 0
            ? Math.round(((wrongBy[k] ?? 0) / (attemptBy[k] ?? 1)) * 100)
            : 0,
      }))
      .sort((a, b) => b.wrong - a.wrong)
      .slice(0, 3);

    setSubjectStats(list);
  }, []);

  const handleResetSubjectStats = () => {
    if (typeof window === "undefined") return;
    if (window.confirm("確定要清除「易錯科目」統計嗎？")) {
      clearSubjectStats();
      setSubjectStats([]);
    }
  };

  const startUrl = () => {
    const params = new URLSearchParams();
    params.set("n", String(count));
    params.set("chapter", chapter);
    params.set("dataset", dataset);
    params.set("mode", "all");
    return `/quiz?${params.toString()}`;
  };

  const wrongOnlyUrl = () => {
    const params = new URLSearchParams();
    params.set("mode", "wrong");
    params.set("n", String(count));
    return `/quiz?${params.toString()}`;
  };

  return (
    <main className="min-h-screen flex flex-col p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold tracking-tight mt-8 mb-2 text-center">MLH 裝修工程大腦</h1>
      <p className="text-gray-500 text-sm text-center mb-8">室內裝修工程管理 · 每日刷題</p>

      {dataStatus && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-gray-100 text-gray-600 text-xs text-center">
          資料版本 <strong>{dataStatus.data_version}</strong>
          {dataStatus.dataset_count != null && <> · {dataStatus.dataset_count} 題庫</>}
          {dataStatus.total_questions != null && <> · {dataStatus.total_questions} 題</>}
          {dataStatus.verified_at && (
            <>
              {" "}
              · 最後驗證
              {" "}
              {new Date(dataStatus.verified_at).toLocaleString("zh-TW", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </>
          )}
        </div>
      )}

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-center py-8">載入題庫中…</p>
      ) : (
        <>
          <section className="space-y-4 mb-8">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">題數</label>
              <div className="flex gap-2">
                {COUNT_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCount(n)}
                    className={`flex-1 py-3 rounded-lg border-2 text-sm font-medium transition ${
                      count === n ? "border-[#111] bg-[#111] text-white" : "border-gray-300 text-gray-700"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">題庫範圍</label>
              <select
                value={dataset}
                onChange={(e) => setDataset(e.target.value)}
                className="w-full py-3 px-4 rounded-lg border-2 border-gray-300 text-gray-900"
              >
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">章節</label>
              <select
                value={chapter}
                onChange={(e) => setChapter(e.target.value)}
                className="w-full py-3 px-4 rounded-lg border-2 border-gray-300 text-gray-900"
              >
                {chapters.map((c) => (
                  <option key={c} value={c}>
                    {c === "ALL" ? "全部" : c}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <div className="text-sm text-gray-500 mb-4">
            今日已刷 <strong className="text-[#111]">{todayCount}</strong> 題
            {wrongCount > 0 && (
              <>
                {" "}
                · 錯題本 <strong className="text-[#111]">{wrongCount}</strong> 題
              </>
            )}
            <> · 🏆 累積滿分次數：<strong className="text-[#111]">{perfectCount}</strong></>
          </div>

          {subjectStats.length > 0 && (
            <section className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-sm font-medium text-amber-900 mb-2">易錯科目 Top 3</p>
              <ul className="text-sm text-amber-800 space-y-1">
                {subjectStats.map((s) => (
                  <li key={s.key}>
                    {s.label}：錯 <strong>{s.wrong}</strong> / 做 <strong>{s.attempt}</strong>（錯誤率 {s.rate}%）
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={handleResetSubjectStats}
                className="mt-2 text-xs text-amber-700 underline hover:no-underline"
              >
                重置易錯統計
              </button>
            </section>
          )}

          <section className="mb-6 p-4 rounded-xl border border-indigo-200 bg-indigo-50">
            <p className="text-base font-semibold text-indigo-950 mb-1">室內設計乙級模擬考</p>
            <p className="text-sm text-indigo-800 mb-3">
              60 單選 + 20 複選｜90 分鐘｜100 分
            </p>
            <Link
              href="/exam-12500"
              className="w-full inline-flex justify-center py-3 rounded-lg border-2 border-indigo-800 text-indigo-900 font-medium bg-white"
            >
              開始模擬考
            </Link>
          </section>

          <section className="mb-6 p-4 rounded-xl border border-slate-200 bg-slate-50">
            <p className="text-base font-semibold text-slate-900 mb-1">複選題刷題（測試版）</p>
            <p className="text-sm text-slate-600 mb-3">
              目前開放部分資料集測試（{MULTI_TEST_DATASET_ALLOWLIST.size} 份，含 12500 室內設計題庫），暫不含綜合 A / B
            </p>
            <Link
              href="/multi-test"
              className="w-full inline-flex justify-center py-3 rounded-lg border-2 border-slate-700 text-slate-800 font-medium"
            >
              前往複選題測試
            </Link>
          </section>

          <div className="flex flex-col gap-3">
            <Link
              href={startUrl()}
              className="w-full py-4 rounded-xl bg-[#111] text-white text-center font-medium text-lg"
            >
              開始刷題
            </Link>
            {wrongCount > 0 && (
              <Link
                href={wrongOnlyUrl()}
                className="w-full py-4 rounded-xl border-2 border-[#111] text-[#111] text-center font-medium"
              >
                只刷錯題
              </Link>
            )}
          </div>
        </>
      )}
    </main>
  );
}
