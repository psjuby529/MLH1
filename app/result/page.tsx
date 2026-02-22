"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchQuestions } from "../lib/questions";
import { getWrongIds, getLastAnswers, getAttemptId, tryIncrementPerfectCount, getPerfectCount } from "../lib/storage";
import { getDataVersionSync } from "../lib/datasets";
import type { Question } from "../types";

function ResultContent() {
  const searchParams = useSearchParams();
  const ids = useMemo(
    () => searchParams.getAll("id").filter(Boolean),
    [searchParams]
  );

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQuestions("ALL")
      .then(setQuestions)
      .finally(() => setLoading(false));
  }, []);

  const results = useMemo(() => {
    const answers = getLastAnswers();
    const list: { q: Question; yourIndex: number }[] = [];
    ids.forEach((id) => {
      const q = questions.find((x) => x.id === id);
      if (!q) return;
      const your = answers[id] ?? -1;
      const isWrong = your !== q.answer_index;
      if (isWrong) list.push({ q, yourIndex: your });
    });
    return list;
  }, [questions, ids]);

  const correctCount = ids.length - results.length;
  const total = ids.length;
  const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  const pass = score >= 60;

  const [perfectCount, setPerfectCount] = useState(0);

  useEffect(() => {
    setPerfectCount(getPerfectCount());
  }, []);

  useEffect(() => {
    if (loading || total === 0) return;
    if (score === 100) {
      const attemptId = getAttemptId();
      if (tryIncrementPerfectCount(attemptId)) {
        setPerfectCount(getPerfectCount());
      }
    }
  }, [loading, total, score]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">載入中…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col p-6 max-w-lg mx-auto pb-12">
      <h1 className="text-xl font-bold text-center mt-4 mb-2">測驗結果</h1>

      <div
        className={`rounded-2xl p-6 text-center mb-8 ${
          pass ? "bg-green-50 text-green-900" : "bg-red-50 text-red-900"
        }`}
      >
        <p className="text-4xl font-bold">{score} 分</p>
        <p className="text-xl font-medium mt-1">{pass ? "PASS" : "FAIL"}</p>
        <p className="text-sm opacity-80 mt-1">
          正確 {correctCount} / {total} 題
        </p>
        {score === 100 && (
          <p className="text-sm font-medium mt-2 text-green-700">Perfect! 完美的專業展現！</p>
        )}
      </div>

      <div className="text-sm text-gray-500 text-center mb-6">
        🏆 累積滿分次數：{perfectCount}
      </div>

      {results.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4">錯題清單</h2>
          <ul className="space-y-4">
            {results.map(({ q, yourIndex }) => (
              <li
                key={q.id}
                className="p-4 rounded-xl border border-gray-200 bg-gray-50"
              >
                {q.assets && q.assets.length > 0 && (
                  <div className="mb-2 space-y-1">
                    {q.assets
                      .filter((a) => a.type === "image" && a.src)
                      .map((a, idx) => {
                        const v = getDataVersionSync();
                        const src = a.src + (v ? (a.src.includes("?") ? "&" : "?") + "v=" + encodeURIComponent(v) : "");
                        return (
                          <img
                            key={idx}
                            src={src}
                            alt={a.alt || "題目圖"}
                            className="max-w-full h-auto rounded border border-gray-200"
                            onError={(e) => {
                              try {
                                const key = "debug_missing_images";
                                const arr = JSON.parse(localStorage.getItem(key) ?? "[]");
                                arr.push({ path: a.src, qId: q.id, t: Date.now() });
                                localStorage.setItem(key, JSON.stringify(arr.slice(-50)));
                              } catch { /* ignore */ }
                            }}
                          />
                        );
                      })}
                  </div>
                )}
                <p className="font-medium text-[#111] mb-2">{q.question_text}</p>
                <p className="text-sm text-gray-600">
                  正確答案：{["A", "B", "C", "D"][q.answer_index]}.{" "}
                  {q.options[q.answer_index]}
                </p>
                {yourIndex >= 0 && yourIndex <= 3 && (
                  <p className="text-sm text-red-600">
                    你的答案：{["A", "B", "C", "D"][yourIndex]}.{" "}
                    {q.options[yourIndex]}
                  </p>
                )}
                {q.explanation ? (
                  <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{q.explanation}</p>
                ) : (
                  <p className="text-sm text-gray-500 mt-2">本題無解析</p>
                )}
                <p className="text-sm text-gray-500 mt-1">來源：{q.source_display ?? q.source}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-col gap-3">
        <Link
          href="/"
          className="w-full py-4 rounded-xl bg-[#111] text-white text-center font-medium text-lg"
        >
          再刷一次
        </Link>
        {getWrongIds().length > 0 && (
          <Link
            href={`/quiz?mode=wrong&n=100`}
            className="w-full py-4 rounded-xl border-2 border-[#111] text-[#111] text-center font-medium"
          >
            只刷錯題
          </Link>
        )}
      </div>
    </main>
  );
}

export default function ResultPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">載入中…</div>}>
      <ResultContent />
    </Suspense>
  );
}
