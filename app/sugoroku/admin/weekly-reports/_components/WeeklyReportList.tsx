"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { WeeklyReport } from "@/lib/supabase/types";
import type { MemberOption } from "../page";

// ── 日付ユーティリティ ──────────────────────────────────────
const DAYS_JA = ["日", "月", "火", "水", "木", "金", "土"];

function getCurrentWeekStart(): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

function addWeeks(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + delta * 7);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatWeekLabel(weekStart: string, weekEnd: string): string {
  const s = new Date(`${weekStart}T00:00:00`);
  const e = new Date(`${weekEnd}T00:00:00`);
  const fmt = (d: Date) =>
    `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(
      d.getDate()
    ).padStart(2, "0")}(${DAYS_JA[d.getDay()]})`;
  return `${fmt(s)} 〜 ${fmt(e)}`;
}

const FIELD_LABELS: { key: keyof WeeklyReport; label: string }[] = [
  { key: "main_events", label: "主なイベント・できごと" },
  { key: "actions", label: "目標に対するアクション" },
  { key: "last_week_results", label: "先週の結果はどうでしたか？" },
  { key: "what_went_well", label: "うまくいった点・感謝したいこと" },
  { key: "improvements", label: "もっとよくするには？" },
  { key: "next_actions", label: "この報告から次のアクションは？" },
];

type WeeklyReportWithMember = WeeklyReport & { member_name: string };

interface WeeklyReportListProps {
  allMembers: MemberOption[];
  initialMemberId: string;
}

export default function WeeklyReportList({
  allMembers,
  initialMemberId,
}: WeeklyReportListProps) {
  const supabase = useMemo(() => createClient(), []);

  const [weekStart, setWeekStart] = useState<string>(getCurrentWeekStart);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const isNextDisabled = addWeeks(weekStart, 1) > getCurrentWeekStart();

  const [reports, setReports] = useState<WeeklyReportWithMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [detail, setDetail] = useState<WeeklyReportWithMember | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      const { data } = await supabase
        .from("weekly_reports")
        .select("*")
        .eq("week_start_date", weekStart)
        .order("member_id");

      if (cancelled) return;

      const enriched: WeeklyReportWithMember[] = (data ?? []).map((r) => ({
        ...(r as WeeklyReport),
        member_name:
          allMembers.find((m) => m.id === r.member_id)?.name ?? "不明",
      }));

      setReports(enriched);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [weekStart, supabase, allMembers]);

  // 未提出メンバーを補完してフィルタ
  const allRows = useMemo(() => {
    const existing = new Map(reports.map((r) => [r.member_id, r]));
    const rows: (WeeklyReportWithMember | { member_id: string; member_name: string; status: "unsubmitted" })[] =
      allMembers.map((m) =>
        existing.get(m.id) ?? {
          member_id: m.id,
          member_name: m.name,
          status: "unsubmitted" as const,
        }
      );
    return rows;
  }, [reports, allMembers]);

  const filtered = useMemo(() => {
    return allRows.filter((r) => {
      if (selectedMemberId !== "all" && r.member_id !== selectedMemberId)
        return false;
      if (selectedStatus !== "all" && r.status !== selectedStatus) return false;
      return true;
    });
  }, [allRows, selectedMemberId, selectedStatus]);

  const statusBadge = (status: string) => {
    if (status === "submitted")
      return (
        <span
          className="px-2 py-0.5 rounded-full text-xs font-bold"
          style={{ background: "rgba(74,222,128,.15)", color: "#4ade80" }}
        >
          提出済み
        </span>
      );
    if (status === "draft")
      return (
        <span
          className="px-2 py-0.5 rounded-full text-xs font-bold"
          style={{ background: "rgba(148,163,184,.12)", color: "#94a3b8" }}
        >
          下書き
        </span>
      );
    return (
      <span
        className="px-2 py-0.5 rounded-full text-xs font-bold"
        style={{ background: "rgba(248,113,113,.12)", color: "#f87171" }}
      >
        未提出
      </span>
    );
  };

  return (
    <div>
      {/* 週ナビ */}
      <div
        className="flex items-center justify-between mb-5 px-4 py-3 rounded-xl"
        style={{ background: "#1a1d27", border: "1px solid #2e3347" }}
      >
        <button
          onClick={() => setWeekStart((ws) => addWeeks(ws, -1))}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium"
          style={{ background: "#232636", color: "#94a3b8", border: "1px solid #2e3347" }}
        >
          ← 前の週
        </button>
        <span className="text-sm font-semibold" style={{ color: "#e2e8f0" }}>
          {formatWeekLabel(weekStart, weekEnd)}
        </span>
        <button
          onClick={() => !isNextDisabled && setWeekStart((ws) => addWeeks(ws, 1))}
          disabled={isNextDisabled}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium"
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

      {/* フィルタ */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <select
          value={selectedMemberId}
          onChange={(e) => setSelectedMemberId(e.target.value)}
          className="px-3 py-2 rounded-xl text-sm outline-none"
          style={{ background: "#1a1d27", border: "1px solid #2e3347", color: "#e2e8f0" }}
        >
          <option value="all" style={{ background: "#1a1d27" }}>
            すべてのメンバー
          </option>
          {allMembers.map((m) => (
            <option key={m.id} value={m.id} style={{ background: "#1a1d27" }}>
              {m.name}
            </option>
          ))}
        </select>
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-3 py-2 rounded-xl text-sm outline-none"
          style={{ background: "#1a1d27", border: "1px solid #2e3347", color: "#e2e8f0" }}
        >
          <option value="all" style={{ background: "#1a1d27" }}>すべてのステータス</option>
          <option value="submitted" style={{ background: "#1a1d27" }}>提出済み</option>
          <option value="draft" style={{ background: "#1a1d27" }}>下書き</option>
          <option value="unsubmitted" style={{ background: "#1a1d27" }}>未提出</option>
        </select>
      </div>

      {/* テーブル */}
      {loading ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ background: "#1a1d27", border: "1px dashed #2e3347" }}
        >
          <div
            className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-3"
            style={{ borderColor: "#6c63ff", borderTopColor: "transparent" }}
          />
          <p className="text-xs" style={{ color: "#4a5568" }}>読み込み中...</p>
        </div>
      ) : (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "#1a1d27", border: "1px solid #2e3347" }}
        >
          {filtered.map((row, i) => {
            const isReport = "id" in row;
            const report = isReport ? (row as WeeklyReportWithMember) : null;

            return (
              <div
                key={row.member_id}
                className="flex items-center gap-4 px-5 py-4"
                style={{
                  borderBottom:
                    i < filtered.length - 1 ? "1px solid #2e3347" : "none",
                }}
              >
                {/* アバター + 名前 */}
                <div className="flex items-center gap-3 w-32 shrink-0">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      background: "linear-gradient(135deg, #6c63ff, #8b5cf6)",
                      color: "#fff",
                    }}
                  >
                    {row.member_name.slice(0, 1)}
                  </div>
                  <span
                    className="text-sm font-medium truncate"
                    style={{ color: "#e2e8f0" }}
                  >
                    {row.member_name}
                  </span>
                </div>

                {/* ステータス */}
                <div className="w-20 shrink-0">{statusBadge(row.status)}</div>

                {/* プレビュー */}
                <div className="flex-1 min-w-0">
                  {report?.main_events ? (
                    <p
                      className="text-xs truncate"
                      style={{ color: "#94a3b8" }}
                    >
                      {report.main_events}
                    </p>
                  ) : (
                    <p className="text-xs" style={{ color: "#4a5568" }}>
                      —
                    </p>
                  )}
                </div>

                {/* 詳細ボタン */}
                <div className="shrink-0">
                  {isReport && report ? (
                    <button
                      onClick={() => setDetail(report)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{
                        background: "#232636",
                        color: "#94a3b8",
                        border: "1px solid #2e3347",
                      }}
                    >
                      詳細
                    </button>
                  ) : (
                    <button
                      disabled
                      className="px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{
                        background: "#1a1d27",
                        color: "#2e3347",
                        border: "1px solid #1e2130",
                        cursor: "not-allowed",
                      }}
                    >
                      詳細
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 詳細モーダル */}
      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setDetail(null);
          }}
        >
          <div
            className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl"
            style={{ background: "#1a1d27", border: "1px solid #2e3347" }}
          >
            {/* モーダルヘッダー */}
            <div
              className="sticky top-0 px-6 py-4 flex items-center justify-between"
              style={{
                background: "#1a1d27",
                borderBottom: "1px solid #2e3347",
                zIndex: 1,
              }}
            >
              <div>
                <h3 className="font-bold text-sm" style={{ color: "#e2e8f0" }}>
                  週報詳細 — {detail.member_name}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className="text-xs px-2 py-0.5 rounded"
                    style={{ background: "rgba(108,99,255,.2)", color: "#6c63ff" }}
                  >
                    {formatWeekLabel(
                      detail.week_start_date,
                      addDays(detail.week_start_date, 6)
                    )}
                  </span>
                  {statusBadge(detail.status)}
                </div>
              </div>
              <button
                onClick={() => setDetail(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "#232636", color: "#94a3b8" }}
              >
                ✕
              </button>
            </div>

            {/* フィールド */}
            <div className="p-6 space-y-5">
              {FIELD_LABELS.map(({ key, label }, i) => (
                <div key={key}>
                  <p
                    className="text-xs font-bold mb-2"
                    style={{ color: "#94a3b8" }}
                  >
                    {"①②③④⑤⑥"[i]} {label}
                  </p>
                  <div
                    className="rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap"
                    style={{
                      background: "#232636",
                      border: "1px solid #2e3347",
                      borderLeft: "3px solid #6c63ff",
                      color: "#e2e8f0",
                    }}
                  >
                    {(detail[key] as string) || (
                      <span style={{ color: "#4a5568" }}>—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
