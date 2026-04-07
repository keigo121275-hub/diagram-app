"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface DailyReportModalProps {
  roadmapId: string;
  memberId: string;
  onClose: () => void;
  onSubmitted: () => void;
}

const TEMPLATE_FIELDS = [
  { key: "today", label: "今日やったこと", placeholder: "例：○○の資料を作成した、△△のミーティングに参加した" },
  { key: "output", label: "やったことに対する成果物", placeholder: "例：企画書v1完成、リスト50件作成、議事録共有済み" },
  { key: "progress", label: "大タスクの進捗率", placeholder: "例：30% → 45%（+15%）" },
  { key: "stuck", label: "現状つまずいていること", placeholder: "例：△△の手順がわからない、特になし" },
  { key: "concern", label: "今の不安・不満", placeholder: "例：スケジュールが遅れそう、特になし" },
] as const;

type FieldKey = (typeof TEMPLATE_FIELDS)[number]["key"];
type Fields = Record<FieldKey, string>;

const EMPTY: Fields = { today: "", output: "", progress: "", stuck: "", concern: "" };

function buildBody(fields: Fields): string {
  return TEMPLATE_FIELDS.map(
    ({ key, label }) => `【${label}】\n${fields[key].trim() || "（なし）"}`
  ).join("\n\n");
}

export function DailyReportModal({
  roadmapId,
  memberId,
  onClose,
  onSubmitted,
}: DailyReportModalProps) {
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  const today = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Tokyo",
  });

  const hasContent = Object.values(fields).some((v) => v.trim());

  const handleSubmit = async () => {
    if (!hasContent || submitting) return;
    setSubmitting(true);
    const supabase = createClient();

    const jstDate = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Tokyo",
    }).format(new Date());

    await supabase.from("daily_reports").insert({
      member_id: memberId,
      roadmap_id: roadmapId,
      body: buildBody(fields),
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
        className="fixed inset-0 z-50"
        style={{ background: "rgba(0,0,0,0.6)" }}
        onClick={onClose}
      />
      {/* モーダル */}
      <div
        className="fixed z-60 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[90vh] flex flex-col"
        style={{
          background: "#1a1d27",
          border: "1px solid #2e3347",
          borderRadius: 16,
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
        }}
      >
        {/* ヘッダー */}
        <div
          className="px-6 py-4 flex items-center justify-between shrink-0"
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

        {/* フィールド一覧（スクロール可） */}
        <div className="overflow-y-auto p-5 space-y-4 flex-1">
          {TEMPLATE_FIELDS.map(({ key, label, placeholder }, idx) => (
            <div key={key}>
              <label
                className="flex items-center gap-2 text-xs font-bold mb-1.5"
                style={{ color: "#94a3b8" }}
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0"
                  style={{ background: "rgba(108,99,255,0.2)", color: "#6c63ff" }}
                >
                  {idx + 1}
                </span>
                {label}
              </label>
              <textarea
                value={fields[key]}
                onChange={(e) =>
                  setFields((prev) => ({ ...prev, [key]: e.target.value }))
                }
                placeholder={placeholder}
                rows={2}
                autoFocus={idx === 0}
                className="w-full text-sm outline-none resize-none rounded-xl px-4 py-3"
                style={{
                  background: "#232636",
                  border: "1px solid #2e3347",
                  borderLeft: "3px solid #6c63ff",
                  color: "#e2e8f0",
                  lineHeight: 1.7,
                }}
              />
            </div>
          ))}
        </div>

        {/* フッター */}
        <div
          className="px-5 py-4 flex items-center justify-between shrink-0"
          style={{ borderTop: "1px solid #2e3347", background: "#232636", borderRadius: "0 0 16px 16px" }}
        >
          <span className="text-xs" style={{ color: "#4a5568" }}>
            ⌘+Enter で送信
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm"
              style={{ background: "#1a1d27", color: "#64748b", border: "1px solid #2e3347" }}
            >
              キャンセル
            </button>
            <button
              onClick={handleSubmit}
              disabled={!hasContent || submitting}
              className="px-5 py-2 rounded-lg text-sm font-bold"
              style={{
                background: hasContent
                  ? "linear-gradient(135deg, #6c63ff, #5a52e8)"
                  : "#2e3347",
                color: hasContent ? "#fff" : "#4a5568",
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? "送信中..." : "送信する"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
