"use client";

import { useState } from "react";
import { QuestionReviewBadges } from "./QuestionReviewBadges";
import { QuestionAssets } from "./QuestionAssets";
import type { Exam12500Question } from "../lib/exam12500";

const LABELS = ["A", "B", "C", "D"] as const;

export type WrongAccordionRow = {
  q: Exam12500Question;
  index: number;
  userSingle?: number;
  userMulti?: string[];
  correct: boolean;
};

function formatUserAnswer(row: WrongAccordionRow): string {
  if (row.q.kind === "single") {
    return row.userSingle !== undefined ? LABELS[row.userSingle] ?? "—" : "未作答";
  }
  return row.userMulti?.length ? row.userMulti.join("、") : "未作答";
}

function formatCorrectAnswer(q: Exam12500Question): string {
  if (q.kind === "single") return LABELS[q.answer_index ?? 0] ?? "—";
  return (q.correct_answers ?? []).join("、");
}

export function ExamWrongAccordion({ rows }: { rows: WrongAccordionRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const open = openId === r.q.id;
        return (
          <div key={r.q.id} className="rounded-xl border border-rose-200 bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenId(open ? null : r.q.id)}
              className="w-full text-left px-4 py-3 flex items-start justify-between gap-2 min-h-[48px]"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#111]">
                  第 {r.index + 1} 題 · {r.q.kind === "single" ? "單選" : "複選"} · {r.q.work_item}{" "}
                  {r.q.work_item_name || r.q.chapter || ""}
                </p>
                <p className="text-xs text-neutral-600 mt-1 truncate">
                  我的：{formatUserAnswer(r)} · 正確：{formatCorrectAnswer(r.q)}
                </p>
              </div>
              <span className="text-neutral-400 shrink-0 text-sm">{open ? "▲" : "▼"}</span>
            </button>
            {open && (
              <div className="px-4 pb-4 border-t border-rose-100 space-y-3">
                <QuestionReviewBadges
                  officialNote={r.q.official_note}
                  reviewFlag={r.q.review_flag}
                />
                <p className="text-sm whitespace-pre-wrap break-words">{r.q.question_text}</p>
                <QuestionAssets assets={r.q.assets} />
                <ul className="text-sm space-y-1">
                  {LABELS.map((letter, idx) => (
                    <li key={letter} className="break-words">
                      <span className="font-semibold">{letter}.</span> {r.q.options[idx] ?? "（缺）"}
                    </li>
                  ))}
                </ul>
                <p className="text-sm">
                  <span className="text-neutral-600">我的答案：</span>
                  {formatUserAnswer(r)}
                </p>
                <p className="text-sm text-emerald-800">
                  <span className="text-neutral-600">正確答案：</span>
                  {formatCorrectAnswer(r.q)}
                </p>
                <p className="text-xs text-neutral-500">
                  分值 {r.q.points} 分 · {r.q.id} · 答錯
                </p>
                {r.q.explanation ? (
                  <p className="text-sm text-neutral-700 bg-neutral-50 rounded-lg p-3 whitespace-pre-wrap break-words">
                    <span className="font-medium">解析：</span>
                    {r.q.explanation}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
