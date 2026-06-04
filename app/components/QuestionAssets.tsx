"use client";

import { getDataVersionSync } from "../lib/datasets";

export type QuestionAsset = {
  type: string;
  src: string;
  alt?: string;
};

export function QuestionAssets({ assets }: { assets?: QuestionAsset[] }) {
  if (!assets?.length) return null;
  const v = getDataVersionSync();
  return (
    <div className="mt-4 space-y-2">
      {assets
        .filter((a) => a.type === "image" && a.src)
        .map((a, idx) => {
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
  );
}
