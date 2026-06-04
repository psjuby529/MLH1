"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchMeta } from "../lib/datasets";
import { QuestionReviewBadges } from "../components/QuestionReviewBadges";
import { QuestionAssets } from "../components/QuestionAssets";
import {
  buildExam12500Deck,
  EXAM_DURATION_SEC,
  EXAM_MULTI_COUNT,
  EXAM_PASS_SCORE,
  EXAM_SINGLE_COUNT,
  formatExamTime,
  loadY12500Multi,
  loadY12500Single,
  multiAnswersEqual,
  type Exam12500Question,
} from "../lib/exam12500";

const LABELS = ["A", "B", "C", "D"] as const;

type Phase = "intro" | "exam" | "result";

type ResultRow = {
  q: Exam12500Question;
  index: number;
  userSingle?: number;
  userMulti?: string[];
  correct: boolean;
};

export default function Exam12500Page() {
  useEffect(() => {
    fetchMeta().catch(() => null);
  }, []);

  const [phase, setPhase] = useState<Phase>("intro");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [deck, setDeck] = useState<Exam12500Question[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [singleAnswers, setSingleAnswers] = useState<Record<string, number>>({});
  const [multiAnswers, setMultiAnswers] = useState<Record<string, string[]>>({});
  const [remainingSec, setRemainingSec] = useState(EXAM_DURATION_SEC);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [results, setResults] = useState<ResultRow[]>([]);
  const submittedRef = useRef(false);
  const startTimeRef = useRef<number>(0);

  const startExam = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [singles, multis] = await Promise.all([loadY12500Single(), loadY12500Multi()]);
      if (singles.length < EXAM_SINGLE_COUNT) {
        throw new Error(`單選題不足 ${EXAM_SINGLE_COUNT} 題（目前 ${singles.length}）`);
      }
      if (multis.length < EXAM_MULTI_COUNT) {
        throw new Error(`複選題不足 ${EXAM_MULTI_COUNT} 題（目前 ${multis.length}）`);
      }
      const d = buildExam12500Deck(singles, multis);
      setDeck(d);
      setQIndex(0);
      setSingleAnswers({});
      setMultiAnswers({});
      setRemainingSec(EXAM_DURATION_SEC);
      setElapsedSec(0);
      submittedRef.current = false;
      startTimeRef.current = Date.now();
      setPhase("exam");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  const finishExam = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    const elapsed = Math.min(
      EXAM_DURATION_SEC,
      Math.round((Date.now() - startTimeRef.current) / 1000)
    );
    setElapsedSec(elapsed);

    const rows: ResultRow[] = deck.map((q, index) => {
      if (q.kind === "single") {
        const userSingle = singleAnswers[q.id];
        const correct =
          userSingle !== undefined && userSingle === q.answer_index;
        return { q, index, userSingle, correct };
      }
      const userMulti = multiAnswers[q.id] ?? [];
      const correct = multiAnswersEqual(userMulti, q.correct_answers ?? []);
      return { q, index, userMulti, correct };
    });
    setResults(rows);
    setPhase("result");
  }, [deck, singleAnswers, multiAnswers]);

  const finishExamRef = useRef(finishExam);
  finishExamRef.current = finishExam;

  useEffect(() => {
    if (phase !== "exam") return;
    const t = setInterval(() => {
      setRemainingSec((s) => {
        if (s <= 1) {
          finishExamRef.current();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase]);

  const q = deck[qIndex];
  const total = deck.length;

  const scoreSummary = useMemo(() => {
    let singleOk = 0;
    let multiOk = 0;
    let totalScore = 0;
    for (const r of results) {
      if (r.correct) {
        totalScore += r.q.points;
        if (r.q.kind === "single") singleOk++;
        else multiOk++;
      }
    }
    return { singleOk, multiOk, totalScore, pass: totalScore >= EXAM_PASS_SCORE };
  }, [results]);

  const toggleMulti = (letter: string) => {
    if (!q || q.kind !== "multi") return;
    setMultiAnswers((prev) => {
      const cur = new Set(prev[q.id] ?? []);
      if (cur.has(letter)) cur.delete(letter);
      else cur.add(letter);
      return { ...prev, [q.id]: Array.from(cur) };
    });
  };

  if (phase === "intro") {
    return (
      <main className="min-h-screen bg-neutral-50 text-[#111] p-6 max-w-lg mx-auto">
        <Link href="/" className="text-sm text-neutral-600 underline">
          回首頁
        </Link>
        <h1 className="text-2xl font-bold mt-6 mb-2">室內設計乙級模擬考</h1>
        <p className="text-neutral-600 mb-6 leading-relaxed">
          {EXAM_SINGLE_COUNT} 單選 + {EXAM_MULTI_COUNT} 複選 · 共 80 題 · {EXAM_DURATION_SEC / 60}{" "}
          分鐘 · 滿分 100 分（單選 1 分／複選 2 分，複選須全對才得分）
        </p>
        <ul className="text-sm text-neutral-700 space-y-2 mb-8 list-disc pl-5">
          <li>題庫：y12500 單選 + 複選（隨機抽題）</li>
          <li>及格線：{EXAM_PASS_SCORE} 分</li>
          <li>交卷後顯示成績與錯題，不寫入單選錯題本</li>
        </ul>
        {err && <p className="text-red-600 text-sm mb-4">{err}</p>}
        <button
          type="button"
          disabled={loading}
          onClick={startExam}
          className="w-full rounded-xl bg-[#111] text-white py-4 text-lg font-medium min-h-[52px] disabled:opacity-50"
        >
          {loading ? "準備題目中…" : "開始模擬考"}
        </button>
      </main>
    );
  }

  if (phase === "result") {
    const wrong = results.filter((r) => !r.correct);
    return (
      <main className="min-h-screen bg-neutral-50 text-[#111] pb-24">
        <div className="max-w-lg mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold mb-4">模擬考結果</h1>
          <div className="rounded-xl border border-neutral-200 bg-white p-4 mb-6 space-y-2">
            <p className="text-xl font-semibold">
              總分 {scoreSummary.totalScore} / 100
            </p>
            <p className={scoreSummary.pass ? "text-emerald-700" : "text-rose-700"}>
              {scoreSummary.pass ? "及格" : "未及格"}（及格線 {EXAM_PASS_SCORE} 分）
            </p>
            <p className="text-sm text-neutral-600">
              單選 {scoreSummary.singleOk} / {EXAM_SINGLE_COUNT} · 複選 {scoreSummary.multiOk} /{" "}
              {EXAM_MULTI_COUNT}
            </p>
            <p className="text-sm text-neutral-600">花費時間：{formatExamTime(elapsedSec)}</p>
          </div>

          {wrong.length > 0 && (
            <section className="space-y-4 mb-8">
              <h2 className="text-lg font-semibold">錯題清單（{wrong.length}）</h2>
              {wrong.map((r) => (
                <div key={r.q.id} className="rounded-xl border border-rose-200 bg-white p-4">
                  <p className="text-xs text-neutral-500 mb-1">
                    第 {r.index + 1} 題 · {r.q.kind === "single" ? "單選" : "複選"} · {r.q.points} 分 ·{" "}
                    {r.q.work_item} {r.q.work_item_name || r.q.chapter || ""}
                  </p>
                  <QuestionReviewBadges
                    officialNote={r.q.official_note}
                    reviewFlag={r.q.review_flag}
                  />
                  <p className="text-sm whitespace-pre-wrap mb-2">{r.q.question_text}</p>
                  <QuestionAssets assets={r.q.assets} />
                  <p className="text-sm mt-2">
                    我的答案：
                    {r.q.kind === "single"
                      ? r.userSingle !== undefined
                        ? LABELS[r.userSingle] ?? "—"
                        : "未作答"
                      : (r.userMulti?.length ? r.userMulti.join("、") : "未作答")}
                  </p>
                  <p className="text-sm text-emerald-800">
                    正確答案：
                    {r.q.kind === "single"
                      ? LABELS[r.q.answer_index ?? 0] ?? "—"
                      : (r.q.correct_answers ?? []).join("、")}
                  </p>
                </div>
              ))}
            </section>
          )}

          <button
            type="button"
            onClick={() => {
              setPhase("intro");
              setResults([]);
              setDeck([]);
            }}
            className="w-full rounded-xl bg-[#111] text-white py-4 font-medium mb-3"
          >
            重新開始一份模擬考
          </button>
          <Link href="/" className="block text-center text-neutral-600 underline">
            回首頁
          </Link>
        </div>
      </main>
    );
  }

  // exam phase
  const pickedMulti = q?.kind === "multi" ? new Set(multiAnswers[q.id] ?? []) : new Set();
  const singlePicked = q?.kind === "single" ? singleAnswers[q.id] : undefined;

  return (
    <main className="min-h-screen bg-neutral-50 text-[#111] pb-28">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/95 px-4 py-3">
        <div className="max-w-lg mx-auto flex justify-between items-center gap-2">
          <span className="text-sm font-medium text-rose-700">剩餘 {formatExamTime(remainingSec)}</span>
          <span className="text-sm text-neutral-600">
            第 {qIndex + 1} / {total}
          </span>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {q && (
          <>
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <p className="text-xs text-neutral-500 mb-2">
                {q.kind === "single" ? "單選" : "複選"} · {q.points} 分 · {q.work_item}{" "}
                {q.work_item_name || q.chapter || ""} · {q.id}
              </p>
              <QuestionReviewBadges officialNote={q.official_note} reviewFlag={q.review_flag} />
              <p className="text-base leading-relaxed whitespace-pre-wrap">{q.question_text}</p>
              <QuestionAssets assets={q.assets} />
            </div>

            {q.kind === "single" ? (
              <div className="space-y-2">
                {LABELS.map((letter, idx) => (
                  <label
                    key={letter}
                    className={`flex items-start gap-3 rounded-xl border-2 px-3 py-3 min-h-[52px] cursor-pointer ${
                      singlePicked === idx
                        ? "border-[#111] bg-neutral-100"
                        : "border-neutral-200 bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`single-${q.id}`}
                      checked={singlePicked === idx}
                      onChange={() =>
                        setSingleAnswers((prev) => ({ ...prev, [q.id]: idx }))
                      }
                      className="mt-1 w-5 h-5 shrink-0 accent-[#111]"
                    />
                    <span className="text-base flex-1 whitespace-pre-wrap">
                      <span className="font-semibold mr-2">{letter}.</span>
                      {q.options[idx] ?? "（缺）"}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {LABELS.map((letter, idx) => {
                  const on = pickedMulti.has(letter);
                  return (
                    <label
                      key={letter}
                      className={`flex items-start gap-3 rounded-xl border-2 px-3 py-3 min-h-[52px] cursor-pointer ${
                        on ? "border-[#111] bg-neutral-100" : "border-neutral-200 bg-white"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggleMulti(letter)}
                        className="mt-1 w-5 h-5 shrink-0 accent-[#111]"
                      />
                      <span className="text-base flex-1 whitespace-pre-wrap">
                        <span className="font-semibold mr-2">{letter}.</span>
                        {q.options[idx] ?? "（缺）"}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                disabled={qIndex <= 0}
                onClick={() => setQIndex((i) => Math.max(0, i - 1))}
                className="flex-1 rounded-xl border-2 border-neutral-300 py-3 disabled:opacity-40"
              >
                上一題
              </button>
              <button
                type="button"
                disabled={qIndex >= total - 1}
                onClick={() => setQIndex((i) => Math.min(total - 1, i + 1))}
                className="flex-1 rounded-xl border-2 border-neutral-300 py-3 disabled:opacity-40"
              >
                下一題
              </button>
            </div>

            <button
              type="button"
              onClick={finishExam}
              className="w-full rounded-xl bg-rose-700 text-white py-4 font-medium min-h-[52px]"
            >
              交卷
            </button>
          </>
        )}
      </div>
    </main>
  );
}
