"use client";

import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchQuestions, dedupeByKey, sampleStratified, getStratumKey } from "../lib/questions";
import { addWrong, addDailyProgress, setLastAnswers, getWrongIds, setAttemptId, addWrongBySubject, addAttemptBySubject } from "../lib/storage";
import { getDataVersionSync } from "../lib/datasets";
import type { Question } from "../types";

function QuizContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const n = Math.min(100, Math.max(1, parseInt(searchParams.get("n") ?? "100", 10) || 100));
  const chapter = searchParams.get("chapter") ?? "ALL";
  const dataset = searchParams.get("dataset") ?? "ALL";
  const mode = searchParams.get("mode") ?? "all";

  const [questions, setQuestions] = useState<Question[]>([]);
  const [ids, setIds] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAttemptId(`${Date.now()}-${Math.random().toString(36).slice(2)}`);
      fetchQuestions(dataset)
      .then((all) => {
        let pool = all;
        if (chapter !== "ALL") {
          pool = all.filter((q) => q.chapter === chapter);
        }
        if (mode === "wrong") {
          const wrongIds = getWrongIds();
          pool = all.filter((q) => wrongIds.includes(q.id));
        }
        pool = dedupeByKey(pool);
        const slice = sampleStratified(pool, n);
        const idList = slice.map((q) => q.id);
        setIds(idList);
        setQuestions(all);
        if (idList.length === 0) {
          setError("沒有可用的題目（錯題本為空或章節無題）");
        }
        setLoading(false);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "題庫載入失敗";
        setError(msg);
        setLoading(false);
      });
  }, [n, chapter, dataset, mode]);

  const currentId = ids[currentIndex];
  const currentQ = useMemo(
    () => questions.find((q) => q.id === currentId),
    [questions, currentId]
  );

  const total = ids.length;
  const answered = Object.keys(answers).length;
  const correct = useMemo(() => {
    let c = 0;
    ids.forEach((id) => {
      const q = questions.find((x) => x.id === id);
      if (q && answers[id] === q.answer_index) c++;
    });
    return c;
  }, [ids, questions, answers]);

  const score = total > 0 ? Math.round((correct / total) * 100) : 0;

  const handleSelect = (optionIndex: number) => {
    if (selected !== null || !currentQ) return;
    setSelected(optionIndex);
    const newAnswers = { ...answers, [currentId]: optionIndex };
    setAnswers(newAnswers);
    if (currentIndex >= total - 1) setLastAnswers(newAnswers);
    const subjectKey = getStratumKey(currentQ);
    addAttemptBySubject(subjectKey);
    if (optionIndex !== currentQ.answer_index) {
      addWrong(currentQ.id);
      addWrongBySubject(subjectKey);
    }
    addDailyProgress(1);
  };

  const goNext = () => {
    if (currentIndex < total - 1) {
      setCurrentIndex((i) => i + 1);
      setSelected(null);
    } else {
      setLastAnswers(answers);
      const params = new URLSearchParams();
      ids.forEach((id) => params.append("id", id));
      router.push(`/result?${params.toString()}`);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <p className="text-gray-500">載入題目…</p>
      </main>
    );
  }

  if (error || !currentQ) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6">
        <p className="text-red-600 mb-4">{error ?? "題目不存在"}</p>
        <Link href="/" className="py-3 px-6 rounded-lg bg-[#111] text-white">
          回首頁
        </Link>
      </main>
    );
  }

  const isCorrect = selected !== null && selected === currentQ.answer_index;
  const showExplanation = selected !== null;

  return (
    <main className="min-h-screen flex flex-col p-4 max-w-lg mx-auto pb-8">
      <div className="flex justify-between items-center text-sm text-gray-500 mb-4">
        <span>
          {currentIndex + 1} / {total}
        </span>
        <span>得分 {score}（{correct}/{answered}）</span>
      </div>

      <div className="flex-1">
        {currentQ.assets && currentQ.assets.length > 0 && (
          <div className="mb-4 space-y-2">
            {currentQ.assets
              .filter((a) => a.type === "image" && a.src)
              .map((a, idx) => {
                const v = getDataVersionSync();
                const src = a.src + (v ? (a.src.includes("?") ? "&" : "?") + "v=" + encodeURIComponent(v) : "");
                return (
                  <div key={idx}>
                    <img
                      src={src}
                      alt={a.alt || "題目圖"}
                      className="max-w-full h-auto rounded-lg border border-gray-200"
                      onError={(e) => {
                        const path = (e.target as HTMLImageElement)?.src ?? a.src;
                        try {
                          const key = "debug_missing_images";
                          const arr = JSON.parse(localStorage.getItem(key) ?? "[]");
                          arr.push({ path: a.src, qId: currentQ?.id, t: Date.now() });
                          localStorage.setItem(key, JSON.stringify(arr.slice(-50)));
                        } catch { /* ignore */ }
                        (e.target as HTMLImageElement).style.display = "none";
                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                      }}
                    />
                    <span className="hidden text-sm text-amber-600">本題圖檔缺失：{a.src}</span>
                  </div>
                );
              })}
          </div>
        )}
        <p className="text-[#111] font-medium leading-relaxed mb-6">
          {currentQ.question_text}
        </p>
        <div className="space-y-3">
          {currentQ.options.map((opt, i) => {
            const chosen = selected === i;
            const right = currentQ.answer_index === i;
            let style = "w-full text-left py-4 px-4 rounded-xl border-2 border-gray-300 ";
            if (showExplanation) {
              if (right) style += "border-green-500 bg-green-50 text-green-900 ";
              else if (chosen && !right) style += "border-red-500 bg-red-50 text-red-900 ";
              else style += "border-gray-200 text-gray-400 ";
            } else {
              style += "text-[#111] ";
              if (chosen) style += "border-[#111] bg-gray-100 ";
            }
            return (
              <button
                key={i}
                type="button"
                disabled={selected !== null}
                onClick={() => handleSelect(i)}
                className={style}
              >
                <span className="font-medium mr-2">
                  {["A", "B", "C", "D"][i]}.
                </span>
                {opt}
              </button>
            );
          })}
        </div>

        {showExplanation && (
          <div className="mt-6 p-4 rounded-xl bg-gray-100 text-gray-800 text-sm leading-relaxed">
            <p className="font-medium text-[#111] mb-1">解析</p>
            {currentQ.explanation ? (
              <p className="whitespace-pre-wrap">{currentQ.explanation}</p>
            ) : (
              <p className="text-gray-500">本題無解析</p>
            )}
            <p className="mt-2 text-gray-500">來源：{currentQ.source_display ?? currentQ.source}</p>
          </div>
        )}
      </div>

      <div className="mt-8">
        <button
          type="button"
          onClick={goNext}
          className="w-full py-4 rounded-xl bg-[#111] text-white font-medium text-lg disabled:opacity-50"
        >
          {currentIndex < total - 1 ? "下一題" : "看結果"}
        </button>
      </div>
    </main>
  );
}

export default function QuizPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">載入中…</div>}>
      <QuizContent />
    </Suspense>
  );
}
