"use client";

import { useEffect, useRef } from "react";
import { getRank, RANK_TIERS } from "@/app/sugoroku/_lib/constants";
import { LevelUpToast } from "./LevelUpToast";

export function ProgressBar({
  done,
  total,
}: {
  done: number;
  total: number;
}) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const rank = getRank(pct);
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
    <>
      <LevelUpToast pct={pct} />

      <div
        className="mb-6 rounded-2xl p-4"
        style={{ background: "#13111e", border: "1px solid #2e3347" }}
      >
        {/* 上段: 称号バッジ + タスク数 + % */}
        <div className="flex items-center justify-between mb-3">
          {/* 称号バッジ */}
          <div className="flex items-center gap-2">
            <span style={{ fontSize: "24px" }}>{rank.icon}</span>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest" style={{ color: "#6b7280", letterSpacing: "0.07em" }}>
                称号
              </div>
              <div className="text-sm font-extrabold" style={{ color: rank.color }}>
                {rank.title}
              </div>
            </div>
          </div>

          {/* タスク数 + % */}
          <div className="text-right">
            <div
              className="text-2xl font-extrabold leading-none"
              style={{ color: pct === 100 ? "#4ade80" : "#e2e8f0" }}
            >
              {pct}%
            </div>
            <div className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>
              {done} / {total} タスク完了
            </div>
          </div>
        </div>

        {/* ランクマーカー行 */}
        <div className="flex justify-between mb-1.5 px-0.5">
          {RANK_TIERS.map((tier) => (
            <div key={tier.min} className="flex flex-col items-center" style={{ width: "20%" }}>
              <span
                style={{
                  fontSize: "13px",
                  opacity: pct >= tier.min ? 1 : 0.3,
                  transition: "opacity 0.4s",
                }}
              >
                {tier.icon}
              </span>
              <span
                className="text-xs"
                style={{
                  color: pct >= tier.min ? tier.color : "#374151",
                  fontSize: "9px",
                  fontWeight: 700,
                  transition: "color 0.4s",
                }}
              >
                {tier.min}%
              </span>
            </div>
          ))}
        </div>

        {/* EXP バー */}
        <div
          className="relative rounded-full overflow-hidden"
          style={{ height: "14px", background: "#1e2130" }}
        >
          {/* 区切り線 */}
          {[25, 50, 75].map((mark) => (
            <div
              key={mark}
              className="absolute top-0 bottom-0"
              style={{
                left: `${mark}%`,
                width: "2px",
                background: "rgba(255,255,255,0.1)",
                transform: "translateX(-50%)",
                zIndex: 2,
              }}
            />
          ))}
          {/* フィル */}
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              background:
                pct === 100
                  ? "linear-gradient(90deg, #4ade80, #22c55e)"
                  : "linear-gradient(90deg, #6c63ff 0%, #a78bfa 55%, #4ade80 100%)",
              boxShadow:
                pct > 0
                  ? "0 0 12px rgba(108,99,255,0.55)"
                  : undefined,
            }}
          />
          {/* 先端の光点 */}
          {pct > 0 && pct < 100 && (
            <div
              className="absolute top-1/2 -translate-y-1/2 rounded-full"
              style={{
                left: `calc(${pct}% - 3px)`,
                width: "7px",
                height: "7px",
                background: "#fff",
                boxShadow: "0 0 8px #6c63ff",
                zIndex: 3,
              }}
            />
          )}
        </div>

        {/* 100% 達成メッセージ */}
        {pct === 100 && total > 0 && (
          <div className="text-center mt-2 text-sm font-bold" style={{ color: "#4ade80" }}>
            🎉 全クエスト達成！伝説の英雄になりました
          </div>
        )}
      </div>
    </>
  );
}
