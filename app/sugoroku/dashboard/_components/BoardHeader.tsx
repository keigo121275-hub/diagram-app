"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

interface BoardHeaderProps {
  roadmapId: string | null;
  title: string;
  description: string | null;
  isAdmin: boolean;
  hasRoadmap: boolean;
  deletingAll: boolean;
  onDeleteAllClick: () => void;
}

export function BoardHeader({
  roadmapId,
  title,
  description,
  isAdmin,
  hasRoadmap,
  deletingAll,
  onDeleteAllClick,
}: BoardHeaderProps) {
  const [goal, setGoal] = useState(description ?? "");
  const [editing, setEditing] = useState(!description);
  const [draft, setDraft] = useState(description ?? "");
  const [saving, setSaving] = useState(false);
  const boardDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabase = useMemo(() => createClient(), []);

  // メンバー切り替え時や外部からの description 変化に追従
  useEffect(() => {
    setGoal(description ?? "");
    setDraft(description ?? "");
    setEditing(!description);
  }, [description]);

  const handleConfirm = async () => {
    if (boardDebounceRef.current) { clearTimeout(boardDebounceRef.current); boardDebounceRef.current = null; }
    if (!roadmapId || !draft.trim()) return;
    setSaving(true);
    await supabase
      .from("roadmaps")
      .update({ description: draft.trim() })
      .eq("id", roadmapId);
    setGoal(draft.trim());
    setEditing(false);
    setSaving(false);
  };

  const handleDraftChange = (value: string) => {
    setDraft(value);
    if (!roadmapId || !value.trim()) return;
    if (boardDebounceRef.current) clearTimeout(boardDebounceRef.current);
    boardDebounceRef.current = setTimeout(async () => {
      boardDebounceRef.current = null;
      await supabase.from("roadmaps").update({ description: value.trim() }).eq("id", roadmapId);
      setGoal(value.trim());
    }, 600);
  };

  const handleEdit = () => {
    setDraft(goal);
    setEditing(true);
  };

  return (
    <div className="mb-6">
      {/* ボタン行 */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1" />
        <div className="flex items-center gap-2 shrink-0">
          {isAdmin && hasRoadmap && (
            <button
              onClick={onDeleteAllClick}
              disabled={deletingAll}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{
                background: "rgba(248,113,113,0.1)",
                border: "1px solid rgba(248,113,113,0.3)",
                color: "#f87171",
              }}
            >
              {deletingAll ? "リセット中..." : "🗑️ マップをリセット"}
            </button>
          )}
          {isAdmin && (
            <a
              href="/sugoroku/new-roadmap"
              className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
              style={{
                background: "linear-gradient(135deg, #6c63ff, #5b52ee)",
                color: "#fff",
              }}
            >
              ✨ マップを作る
            </a>
          )}
        </div>
      </div>

      {/* 目標エリア */}
      {hasRoadmap && (
        <>
          {/* 目標設定済み・表示モード */}
          {!editing && goal && (
            <div
              className="rounded-xl px-5 py-4 flex items-start justify-between gap-4"
              style={{ background: "#1a1d27", border: "1px solid #2e3347" }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium mb-1.5" style={{ color: "#6c63ff" }}>
                  🗺️ ステージミッション
                </p>
                <p className="text-base font-semibold leading-relaxed" style={{ color: "#e2e8f0" }}>
                  {goal}
                </p>
              </div>
              <button
                onClick={handleEdit}
                className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{
                  background: "rgba(108,99,255,0.12)",
                  border: "1px solid rgba(108,99,255,0.3)",
                  color: "#6c63ff",
                }}
              >
                編集
              </button>
            </div>
          )}

          {/* 編集モード（未設定 or 編集中） */}
          {editing && (
            <div
              className="rounded-xl px-5 py-4"
              style={{ background: "#1a1d27", border: "1px solid rgba(108,99,255,0.4)" }}
            >
              <p className="text-xs font-medium mb-2" style={{ color: "#6c63ff" }}>
                🗺️ ミッションを設定する
              </p>
              <textarea
                value={draft}
                onChange={(e) => handleDraftChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleConfirm(); }
                }}
                placeholder="例）3ヶ月後にはひとりで冒険できる一人前の旅人になる"
                rows={2}
                autoFocus
                className="w-full text-sm outline-none resize-none mb-3"
                style={{ background: "transparent", color: "#e2e8f0", lineHeight: "1.7" }}
              />
              <div className="flex items-center gap-2 justify-end">
                {goal && (
                  <button
                    onClick={() => setEditing(false)}
                    className="px-3 py-1.5 rounded-lg text-xs"
                    style={{ background: "#232636", color: "#64748b" }}
                  >
                    キャンセル
                  </button>
                )}
                <button
                  onClick={handleConfirm}
                  disabled={!draft.trim() || saving}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
                  style={{
                    background: draft.trim() ? "linear-gradient(135deg, #6c63ff, #5b52ee)" : "#232636",
                    color: draft.trim() ? "#fff" : "#4a5568",
                  }}
                >
                  {saving ? "保存中..." : "設定する"}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
