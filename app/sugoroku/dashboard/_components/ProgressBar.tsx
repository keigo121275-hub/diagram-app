"use client";

import { useEffect, useRef } from "react";

export function ProgressBar({
  done,
  total,
}: {
  done: number;
  total: number;
}) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const prevPctRef = useRef<number>(pct);
  const firedRef = useRef<boolean>(false);

  useEffect(() => {
    const isNewCompletion =
      pct === 100 &&
      total > 0 &&
      (prevPctRef.current < 100 || !firedRef.current);

    if (isNewCompletion) {
      firedRef.current = true;
      import("canvas-confetti").then(({ default: confetti }) => {
        confetti({
          particleCount: 150,
          spread: 90,
          origin: { y: 0.4 },
          colors: ["#6c63ff", "#4ade80", "#facc15", "#f87171", "#60a5fa"],
        });
        setTimeout(() => {
          confetti({
            particleCount: 80,
            angle: 60,
            spread: 55,
            origin: { x: 0, y: 0.5 },
            colors: ["#6c63ff", "#4ade80", "#facc15"],
          });
          confetti({
            particleCount: 80,
            angle: 120,
            spread: 55,
            origin: { x: 1, y: 0.5 },
            colors: ["#6c63ff", "#4ade80", "#facc15"],
          });
        }, 300);
      });
    }

    prevPctRef.current = pct;
  }, [pct, total]);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium" style={{ color: "#94a3b8" }}>
          進捗
        </span>
        <span className="text-sm font-bold" style={{ color: pct === 100 ? "#4ade80" : "#e2e8f0" }}>
          {done} / {total} タスク完了 ({pct}%)
          {pct === 100 && total > 0 && (
            <span className="ml-2 text-xs" style={{ color: "#facc15" }}>
              🎉 完了！
            </span>
          )}
        </span>
      </div>
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height: "10px", background: "#232636" }}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background:
              pct === 100
                ? "linear-gradient(to right, #4ade80, #22c55e)"
                : "linear-gradient(to right, #6c63ff, #4ade80)",
          }}
        />
      </div>
    </div>
  );
}
