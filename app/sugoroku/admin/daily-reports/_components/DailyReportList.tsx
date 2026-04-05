"use client";

import { useRouter } from "next/navigation";
import type { ReportItem, MemberOption } from "../page";

interface DailyReportListProps {
  items: ReportItem[];
  allMembers: MemberOption[];
  selectedMemberId: string;
  weekStart: string; // "2026-04-06"
  weekEnd: string;   // "2026-04-12"
}

const DAYS_JA = ["日", "月", "火", "水", "木", "金", "土"];

function formatWeekLabel(weekStart: string, weekEnd: string): string {
  const s = new Date(`${weekStart}T00:00:00`);
  const e = new Date(`${weekEnd}T00:00:00`);
  const fmt = (d: Date) =>
    `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}(${DAYS_JA[d.getDay()]})`;
  return `${fmt(s)} 〜 ${fmt(e)}`;
}

function addWeeks(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + delta * 7);
  return d.toISOString().slice(0, 10);
}

function isCurrentWeekOrFuture(weekStart: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() + diff);
  const ws = new Date(`${weekStart}T00:00:00`);
  return ws >= thisMonday;
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${d.getMonth() + 1}月${d.getDate()}日（${DAYS_JA[d.getDay()]}）`;
}

export default function DailyReportList({
  items,
  allMembers,
  selectedMemberId,
  weekStart,
  weekEnd,
}: DailyReportListProps) {
  const router = useRouter();

  const navigate = (newWeekStart: string, newMemberId: string) => {
    router.push(
      `/sugoroku/admin/daily-reports?week=${newWeekStart}&member=${newMemberId}`
    );
  };

  const prevWeek = addWeeks(weekStart, -1);
  const nextWeek = addWeeks(weekStart, 1);
  const isNextDisabled = isCurrentWeekOrFuture(nextWeek);

  // 日付でグループ化
  const grouped = items.reduce<Record<string, ReportItem[]>>((acc, item) => {
    if (!acc[item.date]) acc[item.date] = [];
    acc[item.date].push(item);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort();

  return (
    <div>
      {/* 週ナビゲーター */}
      <div
        className="flex items-center justify-between mb-5 px-4 py-3 rounded-xl"
        style={{ background: "#1a1d27", border: "1px solid #2e3347" }}
      >
        <button
          onClick={() => navigate(prevWeek, selectedMemberId)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
          style={{
            background: "#232636",
            color: "#94a3b8",
            border: "1px solid #2e3347",
          }}
        >
          ← 前の週
        </button>

        <span className="text-sm font-semibold" style={{ color: "#e2e8f0" }}>
          {formatWeekLabel(weekStart, weekEnd)}
        </span>

        <button
          onClick={() => !isNextDisabled && navigate(nextWeek, selectedMemberId)}
          disabled={isNextDisabled}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
          style={{
            background: isNextDisabled ? "#1a1d27" : "#232636",
            color: isNextDisabled ? "#2e3347" : "#94a3b8",
            border: `1px solid ${isNextDisabled ? "#1e2130" : "#2e3347"}`,
            cursor: isNextDisabled ? "not-allowed" : "pointer",
          }}
        >
          次の週 →
        </button>
      </div>

      {/* メンバー選択 */}
      <div className="mb-6">
        <label className="text-xs font-medium mb-1.5 block" style={{ color: "#6c63ff" }}>
          メンバー
        </label>
        <select
          value={selectedMemberId}
          onChange={(e) => navigate(weekStart, e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
          style={{
            background: "#1a1d27",
            border: "1px solid #2e3347",
            color: "#e2e8f0",
          }}
        >
          {allMembers.map((m) => (
            <option key={m.id} value={m.id} style={{ background: "#1a1d27" }}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      {/* 日報リスト */}
      {sortedDates.length === 0 ? (
        <div
          className="rounded-2xl p-16 text-center"
          style={{ background: "#1a1d27", border: "1px dashed #2e3347" }}
        >
          <div className="text-4xl mb-4">📭</div>
          <p style={{ color: "#94a3b8" }}>この週は日報がありません</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((date) => (
            <div key={date}>
              {/* 日付ヘッダー */}
              <div className="flex items-center gap-3 mb-3">
                <p className="text-xs font-bold shrink-0" style={{ color: "#6c63ff" }}>
                  {formatDayLabel(date)}
                </p>
                <div className="flex-1 h-px" style={{ background: "#2e3347" }} />
              </div>

              {/* 日報カード */}
              <div className="space-y-3">
                {grouped[date].map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl p-4"
                    style={{ background: "#1a1d27", border: "1px solid #2e3347" }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs" style={{ color: "#64748b" }}>
                        {item.roadmap_title}
                      </span>
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
      )}
    </div>
  );
}
