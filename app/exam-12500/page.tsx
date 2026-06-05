"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchMeta } from "../lib/datasets";
import { QuestionReviewBadges } from "../components/QuestionReviewBadges";
import { QuestionAssets } from "../components/QuestionAssets";
import { ExamWrongAccordion } from "../components/ExamWrongAccordion";
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
  resolveExamQuestionsByIds,
  type Exam12500Question,
} from "../lib/exam12500";
import {
  clearExamWrongbook,
  getExamWrongCount,
  getExamWrongIds,
  recordExamWrongFromResults,
  recordExamWrongPracticeMiss,
  removeExamWrongId,
} from "../lib/exam12500Wrongbook";

const LABELS = ["A", "B", "C", "D"] as const;

type Phase = "intro" | "exam" | "result" | "wrong_practice";

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
  const [wrongCount, setWrongCount] = useState(0);

  const [deck, setDeck] = useState<Exam12500Question[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [singleAnswers, setSingleAnswers] = useState<Record<string, number>>({});
  const [multiAnswers, setMultiAnswers] = useState<Record<string, string[]>>({});
  const [remainingSec, setRemainingSec] = useState(EXAM_DURATION_SEC);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [results, setResults] = useState<ResultRow[]>([]);
  const submittedRef = useRef(false);
  const startTimeRef = useRef<number>(0);

  const [wpQuestions, setWpQuestions] = useState<Exam12500Question[]>([]);
  const [wpIndex, setWpIndex] = useState(0);
  const [wpSingle, setWpSingle] = useState<number | undefined>(undefined);
  const [wpMulti, setWpMulti] = useState<Set<string>>(() => new Set());
  const [wpSubmitted, setWpSubmitted] = useState<"idle" | "correct" | "wrong">("idle");

  const refreshWrongCount = useCallback(() => {
    setWrongCount(getExamWrongCount());
  }, []);

  useEffect(() => {
    if (phase === "intro") refreshWrongCount();
  }, [phase, refreshWrongCount]);

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
        const correct = userSingle !== undefined && userSingle === q.answer_index;
        return { q, index, userSingle, correct };
      }
      const userMulti = multiAnswers[q.id] ?? [];
      const correct = multiAnswersEqual(userMulti, q.correct_answers ?? []);
      return { q, index, userMulti, correct };
    });
    recordExamWrongFromResults(rows);
    refreshWrongCount();
    setResults(rows);
    setPhase("result");
  }, [deck, singleAnswers, multiAnswers, refreshWrongCount]);

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

  const startWrongPractice = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const ids = getExamWrongIds();
      if (ids.length === 0) {
        setErr("目前沒有模擬考錯題");
        return;
      }
      const [singles, multis] = await Promise.all([loadY12500Single(), loadY12500Multi()]);
      const qs = resolveExamQuestionsByIds(ids, singles, multis);
      if (qs.length === 0) {
        setErr("錯題 id 在題庫中找不到，請清空錯題集後重試");
        return;
      }
      setWpQuestions(qs);
      setWpIndex(0);
      setWpSingle(undefined);
      setWpMulti(new Set());
      setWpSubmitted("idle");
      setPhase("wrong_practice");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "載入錯題失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleClearWrongbook = () => {
    if (!window.confirm("確定清空模擬考錯題集？")) return;
    clearExamWrongbook();
    refreshWrongCount();
  };

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

  const q = deck[qIndex];
  const total = deck.length;
  const wpQ = wpQuestions[wpIndex];

  const submitWrongPractice = () => {
    if (!wpQ || wpSubmitted !== "idle") return;
    let ok = false;
    if (wpQ.kind === "single") {
      ok = wpSingle !== undefined && wpSingle === wpQ.answer_index;
      if (ok) {
        removeExamWrongId(wpQ.id);
        refreshWrongCount();
      } else {
        recordExamWrongPracticeMiss(wpQ, wpSingle, undefined);
        refreshWrongCount();
      }
    } else {
      const picked = Array.from(wpMulti);
      ok = multiAnswersEqual(picked, wpQ.correct_answers ?? []);
      if (ok) {
        removeExamWrongId(wpQ.id);
        refreshWrongCount();
      } else {
        recordExamWrongPracticeMiss(wpQ, undefined, picked);
        refreshWrongCount();
      }
    }
    setWpSubmitted(ok ? "correct" : "wrong");
  };

  const nextWrongPractice = () => {
    if (wpIndex >= wpQuestions.length - 1) {
      setPhase("intro");
      refreshWrongCount();
      return;
    }
    setWpIndex((i) => i + 1);
    setWpSingle(undefined);
    setWpMulti(new Set());
    setWpSubmitted("idle");
  };

  const toggleWpMulti = (letter: string) => {
    if (wpSubmitted !== "idle") return;
    setWpMulti((prev) => {
      const next = new Set(prev);
      if (next.has(letter)) next.delete(letter);
      else next.add(letter);
      return next;
    });
  };

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
      <main className="min-h-screen bg-neutral-50 text-[#111] p-6 max-w-lg mx-auto pb-12">
        <Link href="/" className="text-sm text-neutral-600 underline">
          回首頁
        </Link>
        <h1 className="text-2xl font-bold mt-6 mb-2">室內設計乙級模擬考</h1>
        <p className="text-neutral-600 mb-6 leading-relaxed">
          {EXAM_SINGLE_COUNT} 單選 + {EXAM_MULTI_COUNT} 複選 · 共 80 題 · {EXAM_DURATION_SEC / 60}{" "}
          分鐘 · 滿分 100 分（單選 1 分／複選 2 分，複選須全對才得分）
        </p>
        <ul className="text-sm text-neutral-700 space-y-2 mb-6 list-disc pl-5">
          <li>題庫：y12500 單選 + 複選（隨機抽題）</li>
          <li>及格線：{EXAM_PASS_SCORE} 分</li>
          <li>交卷後錯題寫入獨立模擬考錯題集（不影響單選錯題本）</li>
        </ul>

        <section className="mb-6 p-4 rounded-xl border border-amber-200 bg-amber-50">
          <h2 className="text-base font-semibold text-amber-950 mb-1">模擬考錯題練習</h2>
          {wrongCount > 0 ? (
            <>
              <p className="text-sm text-amber-900 mb-3">
                錯題數量：<strong>{wrongCount}</strong> 題
              </p>
              <button
                type="button"
                disabled={loading}
                onClick={startWrongPractice}
                className="w-full rounded-lg border-2 border-amber-800 text-amber-950 py-3 font-medium mb-2 bg-white"
              >
                開始錯題練習
              </button>
              <button
                type="button"
                onClick={handleClearWrongbook}
                className="w-full text-sm text-amber-800 underline"
              >
                清空模擬考錯題集
              </button>
            </>
          ) : (
            <p className="text-sm text-amber-900">
              目前沒有模擬考錯題，完成一次模擬考後會自動建立。
            </p>
          )}
        </section>

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
            <p className="text-xl font-semibold">總分 {scoreSummary.totalScore} / 100</p>
            <p className={scoreSummary.pass ? "text-emerald-700" : "text-rose-700"}>
              {scoreSummary.pass ? "及格" : "未及格"}（及格線 {EXAM_PASS_SCORE} 分）
            </p>
            <p className="text-sm text-neutral-600">
              單選 {scoreSummary.singleOk} / {EXAM_SINGLE_COUNT} · 複選 {scoreSummary.multiOk} /{" "}
              {EXAM_MULTI_COUNT}
            </p>
            <p className="text-sm text-neutral-600">花費時間：{formatExamTime(elapsedSec)}</p>
            <p className="text-sm text-neutral-600">錯題數量：{wrong.length}</p>
          </div>

          {wrong.length > 0 && (
            <section className="mb-8">
              <h2 className="text-lg font-semibold mb-3">錯題清單（點開查看完整題目）</h2>
              <ExamWrongAccordion rows={wrong} />
            </section>
          )}

          <button
            type="button"
            onClick={() => {
              setPhase("intro");
              setResults([]);
              setDeck([]);
              refreshWrongCount();
            }}
            className="w-full rounded-xl bg-[#111] text-white py-4 font-medium mb-3"
          >
            重新開始一份模擬考
          </button>
          {wrongCount > 0 && (
            <button
              type="button"
              onClick={startWrongPractice}
              className="w-full rounded-xl border-2 border-amber-700 text-amber-900 py-3 font-medium mb-3"
            >
              模擬考錯題練習（{wrongCount} 題）
            </button>
          )}
          <Link href="/" className="block text-center text-neutral-600 underline">
            回首頁
          </Link>
        </div>
      </main>
    );
  }

  if (phase === "wrong_practice") {
    if (!wpQ) {
      return (
        <main className="min-h-screen flex items-center justify-center p-6">
          <p className="text-neutral-600">沒有可練習的錯題</p>
        </main>
      );
    }
    return (
      <main className="min-h-screen bg-neutral-50 text-[#111] pb-28">
        <header className="sticky top-0 z-10 border-b border-amber-200 bg-amber-50 px-4 py-3">
          <div className="max-w-lg mx-auto flex justify-between items-center">
            <span className="text-sm font-medium text-amber-900">模擬考錯題練習</span>
            <span className="text-sm text-neutral-600">
              第 {wpIndex + 1} / {wpQuestions.length}
            </span>
          </div>
        </header>
        <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <p className="text-xs text-neutral-500 mb-2">
              {wpQ.kind === "single" ? "單選" : "複選"} · {wpQ.points} 分 · {wpQ.work_item}{" "}
              {wpQ.work_item_name || wpQ.chapter || ""} · {wpQ.id}
            </p>
            <QuestionReviewBadges officialNote={wpQ.official_note} reviewFlag={wpQ.review_flag} />
            <p className="text-base leading-relaxed whitespace-pre-wrap break-words">{wpQ.question_text}</p>
            <QuestionAssets assets={wpQ.assets} />
          </div>

          {wpQ.kind === "single" ? (
            <div className="space-y-2">
              {LABELS.map((letter, idx) => (
                <label
                  key={letter}
                  className={`flex items-start gap-3 rounded-xl border-2 px-3 py-3 min-h-[52px] cursor-pointer ${
                    wpSingle === idx ? "border-[#111] bg-neutral-100" : "border-neutral-200 bg-white"
                  } ${wpSubmitted !== "idle" ? "pointer-events-none opacity-80" : ""}`}
                >
                  <input
                    type="radio"
                    checked={wpSingle === idx}
                    disabled={wpSubmitted !== "idle"}
                    onChange={() => setWpSingle(idx)}
                    className="mt-1 w-5 h-5 shrink-0 accent-[#111]"
                  />
                  <span className="text-base flex-1 whitespace-pre-wrap break-words">
                    <span className="font-semibold mr-2">{letter}.</span>
                    {wpQ.options[idx] ?? "（缺）"}
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {LABELS.map((letter, idx) => {
                const on = wpMulti.has(letter);
                return (
                  <label
                    key={letter}
                    className={`flex items-start gap-3 rounded-xl border-2 px-3 py-3 min-h-[52px] cursor-pointer ${
                      on ? "border-[#111] bg-neutral-100" : "border-neutral-200 bg-white"
                    } ${wpSubmitted !== "idle" ? "pointer-events-none opacity-80" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={wpSubmitted !== "idle"}
                      onChange={() => toggleWpMulti(letter)}
                      className="mt-1 w-5 h-5 shrink-0 accent-[#111]"
                    />
                    <span className="text-base flex-1 whitespace-pre-wrap break-words">
                      <span className="font-semibold mr-2">{letter}.</span>
                      {wpQ.options[idx] ?? "（缺）"}
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          {wpSubmitted === "idle" ? (
            <button
              type="button"
              onClick={submitWrongPractice}
              className="w-full rounded-xl bg-[#111] text-white py-4 font-medium min-h-[52px]"
            >
              提交答案
            </button>
          ) : (
            <div
              className={`rounded-xl px-4 py-3 text-center font-medium ${
                wpSubmitted === "correct" ? "bg-emerald-100 text-emerald-900" : "bg-rose-100 text-rose-900"
              }`}
            >
              {wpSubmitted === "correct" ? "答對！已從錯題集移除" : "答錯，已保留在錯題集"}
              {wpSubmitted === "wrong" && (
                <p className="text-sm font-normal mt-1">
                  正解：
                  {wpQ.kind === "single"
                    ? LABELS[wpQ.answer_index ?? 0]
                    : (wpQ.correct_answers ?? []).join("、")}
                </p>
              )}
            </div>
          )}

          {wpSubmitted !== "idle" && (
            <button
              type="button"
              onClick={nextWrongPractice}
              className="w-full rounded-xl border-2 border-neutral-400 py-3 font-medium"
            >
              {wpIndex >= wpQuestions.length - 1 ? "返回模擬考" : "下一題"}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setPhase("intro");
              refreshWrongCount();
            }}
            className="w-full text-sm text-neutral-600 underline"
          >
            返回模擬考首頁
          </button>
        </div>
      </main>
    );
  }

  const pickedMulti = q?.kind === "multi" ? new Set(multiAnswers[q.id] ?? []) : new Set();
  const singlePicked = q?.kind === "single" ? singleAnswers[q.id] : undefined;

  return (
    <main className="min-h-screen bg-neutral-50 text-[#111] pb-28">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/95 px-4 py-3">
        <div className="max-w-lg mx-auto flex justify-between items-center gap-2">
          <span className="text-sm font-medium text-rose-700">剩餘 {formatExamTime(remainingSec)}</span>
          <span className="text-sm text-neutral-600">第 {qIndex + 1} / {total}</span>
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
              <p className="text-base leading-relaxed whitespace-pre-wrap break-words">{q.question_text}</p>
              <QuestionAssets assets={q.assets} />
            </div>

            {q.kind === "single" ? (
              <div className="space-y-2">
                {LABELS.map((letter, idx) => (
                  <label
                    key={letter}
                    className={`flex items-start gap-3 rounded-xl border-2 px-3 py-3 min-h-[52px] cursor-pointer ${
                      singlePicked === idx ? "border-[#111] bg-neutral-100" : "border-neutral-200 bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`single-${q.id}`}
                      checked={singlePicked === idx}
                      onChange={() => setSingleAnswers((prev) => ({ ...prev, [q.id]: idx }))}
                      className="mt-1 w-5 h-5 shrink-0 accent-[#111]"
                    />
                    <span className="text-base flex-1 whitespace-pre-wrap break-words">
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
                      <span className="text-base flex-1 whitespace-pre-wrap break-words">
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
