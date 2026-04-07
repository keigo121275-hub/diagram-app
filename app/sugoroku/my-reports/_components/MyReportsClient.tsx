"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { WeeklyReport } from "@/lib/supabase/types";
import {
  toJSTDate,
  toJSTTime,
  getCurrentWeekStart,
  addWeeks,
  addDays,
  formatWeekLabel,
  formatDayLabel,
} from "@/app/sugoroku/_lib/date-utils";

// ── 型 ───────────────────────────────────────────────────────
type DailyItem = {
  id: string;
  body: string;
  date: string;
  created_at: string;
};

type WeeklyFields = {
  main_events: string;
  actions: string;
  last_week_results: string;
  what_went_well: string;
  improvements: string;
  next_actions: string;
};

const EMPTY_FIELDS: WeeklyFields = {
  main_events: "",
  actions: "",
  last_week_results: "",
  what_went_well: "",
  improvements: "",
  next_actions: "",
};

const FIELD_LABELS: { key: keyof WeeklyFields; label: string; num: number }[] = [
  { key: "main_events", label: "主なイベント・できごと", num: 1 },
  { key: "actions", label: "目標に対するアクション", num: 2 },
  { key: "last_week_results", label: "先週の結果はどうでしたか？", num: 3 },
  { key: "what_went_well", label: "うまくいった点・感謝したいこと", num: 4 },
  { key: "improvements", label: "もっとよくするには？", num: 5 },
  { key: "next_actions", label: "この報告から次のアクションは？", num: 6 },
];

// ── Component ────────────────────────────────────────────────
export default function MyReportsClient({ memberId }: { memberId: string }) {
  const supabase = useMemo(() => createClient(), []);

  const [weekStart, setWeekStart] = useState<string>(getCurrentWeekStart);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const isNextDisabled = addWeeks(weekStart, 1) > getCurrentWeekStart();

  // 日報
  const [dailyItems, setDailyItems] = useState<DailyItem[]>([]);
  const [loadingDaily, setLoadingDaily] = useState(true);

  // 週報（既存）
  const [existingWeekly, setExistingWeekly] = useState<WeeklyReport | null>(null);
  const [loadingWeekly, setLoadingWeekly] = useState(true);

  // 週報フォーム
  const [showForm, setShowForm] = useState(false);
  const [fields, setFields] = useState<WeeklyFields>(EMPTY_FIELDS);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // 日報フェッチ
  useEffect(() => {
    let cancelled = false;
    setLoadingDaily(true);
    setDailyItems([]);

    (async () => {
      const queryStart = addDays(weekStart, -1);
      const queryEnd = addDays(weekEnd, 1);

      const { data } = await supabase
        .from("daily_reports")
        .select("id, body, date, created_at")
        .eq("member_id", memberId)
        .gte("date", queryStart)
        .lte("date", queryEnd)
        .order("created_at", { ascending: true });

      if (cancelled) return;

      const filtered = (data ?? [])
        .map((r) => ({
          id: r.id,
          body: r.body,
          date: toJSTDate(r.created_at),
          created_at: r.created_at,
        }))
        .filter((r) => r.date >= weekStart && r.date <= weekEnd);

      setDailyItems(filtered);
      setLoadingDaily(false);
    })();

    return () => { cancelled = true; };
  }, [weekStart, weekEnd, memberId, supabase]);

  // 週報フェッチ（この週の既存週報）
  const fetchWeekly = useCallback(async () => {
    setLoadingWeekly(true);
    const { data } = await supabase
      .from("weekly_reports")
      .select("*")
      .eq("member_id", memberId)
      .eq("week_start_date", weekStart)
      .maybeSingle();
    setExistingWeekly(data as WeeklyReport | null);
    if (data) {
      setFields({
        main_events: data.main_events ?? "",
        actions: data.actions ?? "",
        last_week_results: data.last_week_results ?? "",
        what_went_well: data.what_went_well ?? "",
        improvements: data.improvements ?? "",
        next_actions: data.next_actions ?? "",
      });
      setShowForm(true);
    } else {
      setFields(EMPTY_FIELDS);
      setShowForm(false);
    }
    setLoadingWeekly(false);
  }, [supabase, memberId, weekStart]);

  useEffect(() => {
    fetchWeekly();
  }, [fetchWeekly]);

  // AI生成
  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setShowForm(false);
    try {
      const res = await fetch("/api/sugoroku/generate-weekly-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_start_date: weekStart }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "生成に失敗しました");
        setGenerating(false);
        return;
      }
      setFields({
        main_events: json.main_events ?? "",
        actions: json.actions ?? "",
        last_week_results: json.last_week_results ?? "",
        what_went_well: json.what_went_well ?? "",
        improvements: json.improvements ?? "",
        next_actions: json.next_actions ?? "",
      });
      setShowForm(true);
      showToast(`✨ 週報の生成が完了しました（日報 ${json.daily_count}件を分析）`);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setGenerating(false);
    }
  };

  // 下書き保存 or 提出
  const handleSave = async (status: "draft" | "submitted") => {
    setSaving(true);
    const payload = {
      member_id: memberId,
      week_start_date: weekStart,
      ...fields,
      status,
      updated_at: new Date().toISOString(),
    };

    let err;
    if (existingWeekly) {
      ({ error: err } = await supabase
        .from("weekly_reports")
        .update(payload)
        .eq("id", existingWeekly.id));
    } else {
      ({ error: err } = await supabase
        .from("weekly_reports")
        .insert(payload));
    }

    setSaving(false);
    if (err) {
      setError("保存に失敗しました: " + err.message);
      return;
    }

    await fetchWeekly();
    showToast(
      status === "submitted"
        ? "📤 週報を提出しました！管理者に共有されました。"
        : "💾 下書きを保存しました"
    );
  };

  // スプレッドシートへコピー（タブ区切り1行）
  const handleCopyToSpreadsheet = async () => {
    const row = [
      fields.main_events,
      fields.actions,
      fields.last_week_results,
      fields.what_went_well,
      fields.improvements,
      fields.next_actions,
    ]
      .map((v) => `"${v.replace(/"/g, '""')}"`)
      .join("\t");
    try {
      await navigator.clipboard.writeText(row);
      setCopying(true);
      setTimeout(() => setCopying(false), 2000);
    } catch {
      setError("クリップボードへのコピーに失敗しました");
    }
  };

  // グループ化
  const grouped = useMemo(
    () =>
      dailyItems.reduce<Record<string, DailyItem[]>>((acc, item) => {
        if (!acc[item.date]) acc[item.date] = [];
        acc[item.date].push(item);
        return acc;
      }, {}),
    [dailyItems]
  );
  const sortedDates = useMemo(() => Object.keys(grouped).sort(), [grouped]);

  const weeklyStatus = existingWeekly?.status;

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

      {/* 週報出力ボタンエリア */}
      {!loadingWeekly && (
        <div
          className="rounded-xl p-4 mb-5 flex items-center justify-between gap-4 flex-wrap"
          style={{
            background: "linear-gradient(135deg, rgba(108,99,255,.12), rgba(139,92,246,.06))",
            border: "1px solid rgba(108,99,255,.25)",
          }}
        >
          <div>
            {weeklyStatus === "submitted" ? (
              <>
                <p className="text-sm font-bold" style={{ color: "#4ade80" }}>
                  ✅ この週の週報は提出済みです
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>
                  内容を確認・編集して再提出もできます
                </p>
              </>
            ) : weeklyStatus === "draft" ? (
              <>
                <p className="text-sm font-bold" style={{ color: "#facc15" }}>
                  📄 この週の週報が下書き保存されています
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>
                  続きを編集して提出してください
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-bold" style={{ color: "#e2e8f0" }}>
                  <strong style={{ color: "#6c63ff" }}>
                    この週の日報 {dailyItems.length}件
                  </strong>{" "}
                  をまとめて週報を自動生成できます
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>
                  Claude が日報を分析して週報テンプレートに変換します
                </p>
              </>
            )}
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating || dailyItems.length === 0}
            className="px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2"
            style={{
              background:
                generating || dailyItems.length === 0
                  ? "#2e3347"
                  : "linear-gradient(135deg, #7c3aed, #6c63ff)",
              color:
                generating || dailyItems.length === 0 ? "#4a5568" : "#fff",
              cursor:
                generating || dailyItems.length === 0
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {generating ? (
              <>
                <span
                  className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: "#6c63ff", borderTopColor: "transparent" }}
                />
                生成中...
              </>
            ) : (
              <>✨ この週の週報を出力する</>
            )}
          </button>
        </div>
      )}

      {error && (
        <div
          className="rounded-xl px-4 py-3 mb-4 text-sm"
          style={{
            background: "rgba(248,113,113,.1)",
            border: "1px solid rgba(248,113,113,.3)",
            color: "#f87171",
          }}
        >
          {error}
        </div>
      )}

      {/* 週報フォーム */}
      {showForm && (
        <div
          className="rounded-2xl overflow-hidden mb-6"
          style={{ border: "1px solid #2e3347" }}
        >
          {/* ヘッダー */}
          <div
            className="px-6 py-4 flex items-center justify-between"
            style={{
              background: "linear-gradient(135deg, rgba(74,222,128,.1), rgba(108,99,255,.08))",
              borderBottom: "1px solid #2e3347",
            }}
          >
            <div>
              <h2 className="font-bold text-sm" style={{ color: "#e2e8f0" }}>
                📋 週報テンプレート
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>
                内容を確認・編集して提出してください
              </p>
            </div>
            <span
              className="px-2.5 py-1 rounded-lg text-xs font-bold"
              style={
                weeklyStatus === "submitted"
                  ? { background: "rgba(74,222,128,.15)", color: "#4ade80" }
                  : { background: "rgba(148,163,184,.12)", color: "#94a3b8" }
              }
            >
              {weeklyStatus === "submitted" ? "提出済み" : "下書き"}
            </span>
          </div>

          {/* フィールド */}
          <div className="p-5 space-y-4" style={{ background: "#1a1d27" }}>
            {FIELD_LABELS.map(({ key, label, num }) => (
              <div key={key}>
                <label
                  className="flex items-center gap-2 text-xs font-bold mb-1.5"
                  style={{ color: "#94a3b8" }}
                >
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-xs"
                    style={{ background: "rgba(108,99,255,.2)", color: "#6c63ff" }}
                  >
                    {num}
                  </span>
                  {label}
                </label>
                <textarea
                  value={fields[key]}
                  onChange={(e) =>
                    setFields((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  rows={3}
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
                  style={{
                    background: "#232636",
                    border: "1px solid #2e3347",
                    borderLeft: "3px solid #6c63ff",
                    color: "#e2e8f0",
                    lineHeight: 1.7,
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#6c63ff";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "#2e3347";
                    e.currentTarget.style.borderLeftColor = "#6c63ff";
                  }}
                />
              </div>
            ))}
          </div>

          {/* アクション */}
          <div
            className="px-5 py-4 flex items-center justify-between"
            style={{ background: "#232636", borderTop: "1px solid #2e3347" }}
          >
            <button
              onClick={handleCopyToSpreadsheet}
              className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all"
              style={{
                background: copying ? "rgba(74,222,128,.15)" : "#1a1d27",
                color: copying ? "#4ade80" : "#94a3b8",
                border: `1px solid ${copying ? "rgba(74,222,128,.3)" : "#2e3347"}`,
              }}
            >
              {copying ? "✓ コピーしました" : "📋 スプレッドシートにコピー"}
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => handleSave("draft")}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{
                  background: "#1a1d27",
                  color: "#94a3b8",
                  border: "1px solid #2e3347",
                }}
              >
                {saving ? "保存中..." : "下書き保存"}
              </button>
              <button
                onClick={() => handleSave("submitted")}
                disabled={saving}
                className="px-5 py-2 rounded-lg text-sm font-bold"
                style={{
                  background: "linear-gradient(135deg, #6c63ff, #5a52e8)",
                  color: "#fff",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                📤 週報を提出する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 日報一覧 */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold" style={{ color: "#e2e8f0" }}>
          この週の日報
        </h3>
        <span className="text-xs" style={{ color: "#94a3b8" }}>
          {dailyItems.length} 件
        </span>
      </div>

      {loadingDaily ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ background: "#1a1d27", border: "1px dashed #2e3347" }}
        >
          <div
            className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-3"
            style={{ borderColor: "#6c63ff", borderTopColor: "transparent" }}
          />
          <p className="text-xs" style={{ color: "#4a5568" }}>
            読み込み中...
          </p>
        </div>
      ) : sortedDates.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ background: "#1a1d27", border: "1px dashed #2e3347" }}
        >
          <div className="text-4xl mb-3">📭</div>
          <p className="text-sm" style={{ color: "#94a3b8" }}>
            この週の日報はまだありません
          </p>
          <p className="text-xs mt-1" style={{ color: "#4a5568" }}>
            ダッシュボードから日報を投稿できます
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {sortedDates.map((date) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-3">
                <p className="text-xs font-bold shrink-0" style={{ color: "#6c63ff" }}>
                  {formatDayLabel(date)}
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
                    <div className="flex items-center justify-end mb-2">
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

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 px-5 py-3 rounded-xl text-sm font-medium z-50 shadow-2xl"
          style={{
            background: "#1a1d27",
            border: "1px solid #2e3347",
            color: "#e2e8f0",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
