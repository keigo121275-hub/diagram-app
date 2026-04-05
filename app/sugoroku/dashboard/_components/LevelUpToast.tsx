"use client";

import { useEffect, useRef, useState } from "react";
import { getRank } from "@/app/sugoroku/_lib/constants";

interface LevelUpToastProps {
  pct: number;
}

export function LevelUpToast({ pct }: LevelUpToastProps) {
  const [visible, setVisible] = useState(false);
  const [toastRank, setToastRank] = useState({ icon: "", title: "" });
  const prevPctRef = useRef<number>(pct);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const prev = prevPctRef.current;
    const prevRank = getRank(prev);
    const nextRank = getRank(pct);
    prevPctRef.current = pct;

    if (nextRank.title !== prevRank.title && pct > prev) {
      setToastRank({ icon: nextRank.icon, title: nextRank.title });
      setVisible(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setVisible(false), 3200);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pct]);

  return (
    <div
      className="fixed left-1/2 z-50 text-center pointer-events-none"
      style={{
        top: visible ? "72px" : "-140px",
        transform: "translateX(-50%)",
        minWidth: "300px",
        background: "linear-gradient(135deg, #1e1a3a 0%, #2d2660 100%)",
        border: "1.5px solid #6c63ff",
        borderRadius: "20px",
        padding: "18px 28px",
        boxShadow: "0 8px 40px rgba(108,99,255,.55), 0 0 0 1px rgba(108,99,255,.2)",
        transition: "top 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
      }}
    >
      <div
        className="text-xs font-bold uppercase tracking-widest mb-1.5"
        style={{ color: "#a5b4fc", letterSpacing: "0.1em" }}
      >
        ⬆️ 称号アップ！
      </div>
      <div className="text-xl font-extrabold" style={{ color: "#e2e8f0" }}>
        {toastRank.icon} {toastRank.title} になりました
      </div>
    </div>
  );
}
