"use client";

import { useState } from "react";
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
  const [desc, setDesc] = useState(description ?? "");
  const [saving, setSaving] = useState(false);

  const saveDescription = async () => {
    if (!roadmapId) return;
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("roadmaps")
      .update({ description: desc || null })
      .eq("id", roadmapId);
    setSaving(false);
  };

  return (
    <div className="mb-6">
      {/* ボタン行 + 目標 */}
      <div className="flex items-start justify-between gap-4 mb-4">
        {/* 目標テキスト（主役） */}
        <div className="flex-1 min-w-0">
          {desc ? (
            <h2
              className="text-xl font-bold leading-snug"
              style={{ color: "#e2e8f0" }}
            >
              {desc}
            </h2>
          ) : (
            hasRoadmap && isAdmin && (
              <p className="text-sm" style={{ color: "#4a5568" }}>
                目標を設定してください（下の欄に入力すると保存されます）
              </p>
            )
          )}
        </div>

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
              {deletingAll ? "削除中..." : "🗑️ 全タスク削除"}
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
              ✨ 新規生成
            </a>
          )}
        </div>
      </div>

      {/* 目標編集欄（管理者のみ・ロードマップがある場合） */}
      {hasRoadmap && isAdmin && (
        <div
          className="rounded-xl p-4"
          style={{ background: "#1a1d27", border: "1px solid #2e3347" }}
        >
          <p className="text-xs font-medium mb-2" style={{ color: "#6c63ff" }}>
            🎯 目標を編集
          </p>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            onBlur={saveDescription}
            placeholder="このロードマップのゴールや育成方針を入力してください..."
            rows={2}
            className="w-full text-sm outline-none resize-none"
            style={{ background: "transparent", color: "#e2e8f0" }}
          />
          {saving && (
            <span className="text-xs" style={{ color: "#4a5568" }}>保存中...</span>
          )}
        </div>
      )}

      {/* メンバーには目標のみ表示（未設定時は非表示） */}
      {hasRoadmap && !isAdmin && desc && (
        <div
          className="rounded-xl p-4"
          style={{ background: "#1a1d27", border: "1px solid #2e3347" }}
        >
          <p className="text-xs font-medium mb-1" style={{ color: "#6c63ff" }}>
            🎯 ロードマップの目標
          </p>
          <p className="text-sm leading-relaxed" style={{ color: "#e2e8f0" }}>
            {desc}
          </p>
        </div>
      )}
    </div>
  );
}
