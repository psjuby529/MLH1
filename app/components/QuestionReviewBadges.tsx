/** 官方標記 / 人工複核（非刪題語意） */
export function QuestionReviewBadges({
  officialNote,
  reviewFlag,
}: {
  officialNote?: string | null;
  reviewFlag?: boolean;
}) {
  if (!reviewFlag && !officialNote) return null;
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {officialNote ? (
        <span className="inline-block rounded border border-amber-400 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900">
          官方標記：{officialNote}
        </span>
      ) : null}
      {reviewFlag ? (
        <span className="inline-block rounded border border-green-500 bg-green-50 px-2 py-1 text-xs font-medium text-green-800">
          需人工複核
        </span>
      ) : null}
    </div>
  );
}
