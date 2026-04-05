"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface DailyReportModalProps {
  roadmapId: string;
  memberId: string;
  onClose: () => void;
  onSubmitted: () => void;
}

export function DailyReportModal({
  roadmapId,
  memberId,
  onClose,
  onSubmitted,
}: DailyReportModalProps) {
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const today = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  const handleSubmit = async () => {
    if (!body.trim() || submitting) return;
    setSubmitting(true);
    const supabase = createClient();

    // 日本時間（JST）での日付を明示的に設定
    const jstDate = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Tokyo",
    }).format(new Date()); // "YYYY-MM-DD" 形式

    await supabase.from("daily_reports").insert({
      member_id: memberId,
      roadmap_id: roadmapId,
      body: body.trim(),
      date: jstDate,
    });
    setSubmitting(false);
    onSubmitted();
    onClose();
  };

  return (
    <>
      {/* オーバーレイ */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.6)" }}
        onClick={onClose}
      />
      {/* モーダル */}
      <div
        className="fixed z-60 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md"
        style={{
          background: "#1a1d27",
          border: "1px solid #2e3347",
          borderRadius: 16,
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
        }}
      >
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: "1px solid #2e3347" }}
        >
          <div>
            <h3 className="font-bold text-sm" style={{ color: "#e2e8f0" }}>
              📝 今日の日報
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>
              {today}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "#232636", color: "#94a3b8" }}
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
            }}
            placeholder={"今日の進捗・気づき・課題などを記録してください...\n\n例：\n・○○の作業を完了した\n・△△でつまずいた → □□で解決\n・明日は□□を進める予定"}
            rows={8}
            autoFocus
            className="w-full text-sm outline-none resize-none rounded-xl p-4"
            style={{
              background: "#232636",
              border: "1px solid #2e3347",
              color: "#e2e8f0",
              lineHeight: 1.7,
            }}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: "#4a5568" }}>
              ⌘+Enter で送信
            </span>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ background: "#232636", color: "#64748b" }}
              >
                キャンセル
              </button>
              <button
                onClick={handleSubmit}
                disabled={!body.trim() || submitting}
                className="px-5 py-2 rounded-lg text-sm font-bold"
                style={{
                  background: body.trim()
                    ? "linear-gradient(135deg, #6c63ff, #5a52e8)"
                    : "#2e3347",
                  color: body.trim() ? "#fff" : "#4a5568",
                  opacity: submitting ? 0.6 : 1,
                }}
              >
                {submitting ? "送信中..." : "送信する"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
