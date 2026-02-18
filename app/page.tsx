"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchQuestions, getChapters, shuffle } from "./lib/questions";
import { getTodayAnsweredCount, getWrongIds } from "./lib/storage";
import type { Question } from "./types";

const COUNT_OPTIONS = [20, 50, 100] as const;

export default function HomePage() {
  const [chapters, setChapters] = useState<string[]>(["ALL"]);
  const [count, setCount] = useState<number>(100);
  const [chapter, setChapter] = useState<string>("ALL");
  const [todayCount, setTodayCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQuestions()
      .then((q) => {
        setChapters(getChapters(q));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    setTodayCount(getTodayAnsweredCount());
    setWrongCount(getWrongIds().length);
  }, []);

  const startUrl = () => {
    const params = new URLSearchParams();
    params.set("n", String(count));
    params.set("chapter", chapter);
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
      <h1 className="text-2xl font-bold tracking-tight mt-8 mb-2 text-center">
        MLH 裝修工程大腦
      </h1>
      <p className="text-gray-500 text-sm text-center mb-8">
        室內裝修工程管理 · 每日刷題
      </p>

      {loading ? (
        <p className="text-gray-500 text-center py-8">載入題庫中…</p>
      ) : (
        <>
          <section className="space-y-4 mb-8">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                題數
              </label>
              <div className="flex gap-2">
                {COUNT_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCount(n)}
                    className={`flex-1 py-3 rounded-lg border-2 text-sm font-medium transition ${
                      count === n
                        ? "border-[#111] bg-[#111] text-white"
                        : "border-gray-300 text-gray-700"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                章節
              </label>
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
              <> · 錯題本 <strong className="text-[#111]">{wrongCount}</strong> 題</>
            )}
          </div>

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
