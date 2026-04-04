"use client";

import { useState } from "react";
import type { ReportItem } from "../page";

interface DailyReportListProps {
  items: ReportItem[];
}

export default function DailyReportList({ items }: DailyReportListProps) {
  const [filterMember, setFilterMember] = useState<string>("all");

  const memberNames = [...new Set(items.map((i) => i.member_name))].sort();

  const filtered =
    filterMember === "all" ? items : items.filter((i) => i.member_name === filterMember);

  // 日付でグループ化
  const grouped = filtered.reduce<Record<string, ReportItem[]>>((acc, item) => {
    const key = item.date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  if (items.length === 0) {
    return (
      <div
        className="rounded-2xl p-16 text-center"
        style={{ background: "#1a1d27", border: "1px dashed #2e3347" }}
      >
        <div className="text-4xl mb-4">📭</div>
        <p style={{ color: "#94a3b8" }}>まだ日報が投稿されていません</p>
      </div>
    );
  }

  return (
    <div>
      {/* フィルター */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setFilterMember("all")}
          className="px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{
            background: filterMember === "all" ? "rgba(108,99,255,0.2)" : "#1a1d27",
            color: filterMember === "all" ? "#6c63ff" : "#94a3b8",
            border: `1px solid ${filterMember === "all" ? "rgba(108,99,255,0.4)" : "#2e3347"}`,
          }}
        >
          全員
        </button>
        {memberNames.map((name) => (
          <button
            key={name}
            onClick={() => setFilterMember(name)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{
              background: filterMember === name ? "rgba(108,99,255,0.2)" : "#1a1d27",
              color: filterMember === name ? "#6c63ff" : "#94a3b8",
              border: `1px solid ${filterMember === name ? "rgba(108,99,255,0.4)" : "#2e3347"}`,
            }}
          >
            {name}
          </button>
        ))}
      </div>

      {/* 日付グループ */}
      <div className="space-y-6">
        {sortedDates.map((date) => (
          <div key={date}>
            <div className="flex items-center gap-3 mb-3">
              <p className="text-xs font-bold" style={{ color: "#6c63ff" }}>
                {new Date(date).toLocaleDateString("ja-JP", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  weekday: "short",
                })}
              </p>
              <div className="flex-1 h-px" style={{ background: "#2e3347" }} />
            </div>
            <div className="space-y-3">
              {grouped[date].map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl p-4"
                  style={{ background: "#1a1d27", border: "1px solid #2e3347" }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded"
                        style={{ background: "rgba(108,99,255,0.2)", color: "#a5b4fc" }}
                      >
                        {item.member_name}
                      </span>
                      <span className="text-xs" style={{ color: "#64748b" }}>
                        {item.roadmap_title}
                      </span>
                    </div>
                    <span className="text-xs" style={{ color: "#4a5568" }}>
                      {new Date(item.created_at).toLocaleTimeString("ja-JP", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p
                    className="text-sm leading-relaxed whitespace-pre-wrap"
                    style={{ color: "#e2e8f0" }}
                  >
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
