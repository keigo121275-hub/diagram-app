"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MemberOption } from "../page";
import {
  toJSTDate,
  toJSTTime,
  getCurrentWeekStart,
  addWeeks,
  addDays,
  formatWeekLabel,
  formatDayLabel,
} from "@/app/sugoroku/_lib/date-utils";

export type ReportItem = {
  id: string;
  body: string;
  date: string;
  created_at: string;
  member_id: string;
  member_name: string;
  roadmap_title: string;
};

// ---- Props ----
interface DailyReportListProps {
  allMembers: MemberOption[];
  initialMemberId: string;
}

export default function DailyReportList({
  allMembers,
  initialMemberId,
}: DailyReportListProps) {
  const supabase = useMemo(() => createClient(), []);

  const [weekStart, setWeekStart] = useState<string>(getCurrentWeekStart);
  const [selectedMemberId, setSelectedMemberId] = useState<string>(initialMemberId);
  const [items, setItems] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);

  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const nextWeekStart = addWeeks(weekStart, 1);
  const isNextDisabled = nextWeekStart > getCurrentWeekStart();

  // 週・メンバーが変わるたびにクライアントで直接フェッチ（サーバー往復なし）
  useEffect(() => {
    let cancelled = false;

    async function fetchReports() {
      setLoading(true);

      // UTC/JST 境界ズレ対策: ±1日広めに取得してクライアント側でJST日付フィルタ
      const queryStart = addDays(weekStart, -1);
      const queryEnd = addDays(weekEnd, 1);

      const { data: reports } = await supabase
        .from("daily_reports")
        .select("id, body, date, created_at, member_id, roadmap_id")
        .eq("member_id", selectedMemberId)
        .gte("date", queryStart)
        .lte("date", queryEnd)
        .order("created_at", { ascending: true });

      if (cancelled) return;

      // roadmap タイトルを並列で取得
      const roadmapIds = [
        ...new Set(
          (reports ?? [])
            .map((r) => r.roadmap_id)
            .filter((id): id is string => !!id)
        ),
      ];

      const roadmapMap = new Map<string, string>();
      if (roadmapIds.length > 0) {
        const { data: roadmapsData } = await supabase
          .from("roadmaps")
          .select("id, title")
          .in("id", roadmapIds);
        (roadmapsData ?? []).forEach((r) => roadmapMap.set(r.id, r.title));
      }

      if (cancelled) return;

      const memberName =
        allMembers.find((m) => m.id === selectedMemberId)?.name ?? "不明";

      setItems(
        (reports ?? [])
          .map((r) => ({
            id: r.id,
            body: r.body,
            // created_at から JST 日付を算出（DBの date フィールドはUTCズレの可能性あり）
            date: toJSTDate(r.created_at),
            created_at: r.created_at,
            member_id: r.member_id ?? "",
            member_name: memberName,
            roadmap_title: r.roadmap_id
              ? (roadmapMap.get(r.roadmap_id) ?? "不明")
              : "不明",
          }))
          // JST 日付でこの週のみに絞り込む
          .filter((r) => r.date >= weekStart && r.date <= weekEnd)
      );
      setLoading(false);
    }

    fetchReports();
    return () => {
      cancelled = true;
    };
  }, [weekStart, weekEnd, selectedMemberId, supabase, allMembers]);

  // 日付でグループ化
  const grouped = useMemo(
    () =>
      items.reduce<Record<string, ReportItem[]>>((acc, item) => {
        if (!acc[item.date]) acc[item.date] = [];
        acc[item.date].push(item);
        return acc;
      }, {}),
    [items]
  );
  const sortedDates = useMemo(
    () => Object.keys(grouped).sort(),
    [grouped]
  );

  return (
    <div>
      {/* 週ナビゲーター */}
      <div
        className="flex items-center justify-between mb-5 px-4 py-3 rounded-xl"
        style={{ background: "#1a1d27", border: "1px solid #2e3347" }}
      >
        <button
          onClick={() => setWeekStart((ws) => addWeeks(ws, -1))}
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
          onClick={() => !isNextDisabled && setWeekStart((ws) => addWeeks(ws, 1))}
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
        <label
          className="text-xs font-medium mb-1.5 block"
          style={{ color: "#6c63ff" }}
        >
          メンバー
        </label>
        <select
          value={selectedMemberId}
          onChange={(e) => setSelectedMemberId(e.target.value)}
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

      {/* ローディング */}
      {loading ? (
        <div
          className="rounded-2xl p-16 text-center"
          style={{ background: "#1a1d27", border: "1px dashed #2e3347" }}
        >
          <div
            className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-3"
            style={{ borderColor: "#6c63ff", borderTopColor: "transparent" }}
          />
          <p className="text-xs" style={{ color: "#4a5568" }}>
            読み込み中...
          </p>
        </div>
      ) : sortedDates.length === 0 ? (
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
              <div className="flex items-center gap-3 mb-3">
                <p
                  className="text-xs font-bold shrink-0"
                  style={{ color: "#6c63ff" }}
                >
                  {formatDayLabel(date)}
                </p>
                <div className="flex-1 h-px" style={{ background: "#2e3347" }} />
              </div>

              <div className="space-y-3">
                {grouped[date].map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl p-4"
                    style={{
                      background: "#1a1d27",
                      border: "1px solid #2e3347",
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs" style={{ color: "#64748b" }}>
                        {item.roadmap_title}
                      </span>
                      <span className="text-xs" style={{ color: "#4a5568" }}>
                        {toJSTTime(item.created_at)}
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
