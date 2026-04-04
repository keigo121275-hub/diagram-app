"use client";

import { useEffect, useRef } from "react";
import type { Task } from "@/lib/supabase/types";

interface TaskDetailPanelProps {
  task: Task;
  onClose: () => void;
}

const STATUS_LABELS: Record<Task["status"], string> = {
  todo: "未着手",
  in_progress: "進行中",
  pending_approval: "承認待ち",
  done: "完了",
  needs_revision: "要修正",
};

const STATUS_COLORS: Record<Task["status"], { bg: string; text: string }> = {
  todo: { bg: "rgba(148,163,184,0.15)", text: "#94a3b8" },
  in_progress: { bg: "rgba(96,165,250,0.15)", text: "#60a5fa" },
  pending_approval: { bg: "rgba(250,204,21,0.15)", text: "#facc15" },
  done: { bg: "rgba(74,222,128,0.15)", text: "#4ade80" },
  needs_revision: { bg: "rgba(248,113,113,0.15)", text: "#f87171" },
};

export default function TaskDetailPanel({ task, onClose }: TaskDetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const colors = STATUS_COLORS[task.status];

  return (
    <>
      {/* オーバーレイ */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.4)" }}
        onClick={onClose}
      />

      {/* パネル */}
      <div
        ref={panelRef}
        className="fixed top-0 right-0 h-full z-50 overflow-y-auto"
        style={{
          width: "380px",
          background: "#1a1d27",
          borderLeft: "1px solid #2e3347",
          animation: "slideIn 0.2s ease-out",
        }}
      >
        {/* ヘッダー */}
        <div
          className="sticky top-0 px-6 py-4 flex items-center justify-between"
          style={{
            background: "rgba(26,29,39,0.95)",
            borderBottom: "1px solid #2e3347",
            backdropFilter: "blur(8px)",
          }}
        >
          <h3 className="font-bold text-sm" style={{ color: "#e2e8f0" }}>
            タスク詳細
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
            style={{ background: "#232636", color: "#94a3b8" }}
            onMouseOver={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "#e2e8f0";
            }}
            onMouseOut={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "#94a3b8";
            }}
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* タイトル */}
          <div>
            <h2 className="text-base font-bold leading-snug" style={{ color: "#e2e8f0" }}>
              {task.title}
            </h2>
            <div className="flex items-center gap-2 mt-2">
              {task.level && (
                <span
                  className="px-2 py-0.5 rounded text-xs"
                  style={{ background: "#232636", color: "#94a3b8" }}
                >
                  {task.level === "large" ? "大タスク" : task.level === "medium" ? "中タスク" : "小タスク"}
                </span>
              )}
              <span
                className="px-2 py-0.5 rounded text-xs font-medium"
                style={{ background: colors.bg, color: colors.text }}
              >
                {STATUS_LABELS[task.status]}
              </span>
            </div>
          </div>

          {/* ステータス変更（メンバー操作） */}
          {task.status !== "done" && task.status !== "pending_approval" && (
            <div
              className="rounded-xl p-4"
              style={{ background: "#232636", border: "1px solid #2e3347" }}
            >
              <p className="text-xs font-medium mb-3" style={{ color: "#94a3b8" }}>
                ステータス変更
              </p>
              <div className="flex gap-2 flex-wrap">
                {task.status === "todo" && (
                  <button
                    className="px-3 py-2 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: "rgba(96,165,250,0.15)",
                      color: "#60a5fa",
                      border: "1px solid rgba(96,165,250,0.3)",
                    }}
                  >
                    進行中にする
                  </button>
                )}
                {task.status === "in_progress" && (
                  <button
                    className="px-3 py-2 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: "rgba(250,204,21,0.15)",
                      color: "#facc15",
                      border: "1px solid rgba(250,204,21,0.3)",
                    }}
                  >
                    完了申請する
                  </button>
                )}
                {task.status === "needs_revision" && (
                  <button
                    className="px-3 py-2 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: "rgba(96,165,250,0.15)",
                      color: "#60a5fa",
                      border: "1px solid rgba(96,165,250,0.3)",
                    }}
                  >
                    再申請する
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 承認待ちメッセージ */}
          {task.status === "pending_approval" && (
            <div
              className="rounded-xl p-4"
              style={{
                background: "rgba(250,204,21,0.08)",
                border: "1px solid rgba(250,204,21,0.25)",
              }}
            >
              <p className="text-xs" style={{ color: "#facc15" }}>
                承認待ちです。管理者の確認をお待ちください。
              </p>
            </div>
          )}

          {/* 完了メッセージ */}
          {task.status === "done" && (
            <div
              className="rounded-xl p-4"
              style={{
                background: "rgba(74,222,128,0.08)",
                border: "1px solid rgba(74,222,128,0.25)",
              }}
            >
              <p className="text-xs" style={{ color: "#4ade80" }}>
                このタスクは完了しました！
              </p>
            </div>
          )}

          {/* コメント欄（Phase 3 で実装予定） */}
          <div>
            <p className="text-xs font-medium mb-3" style={{ color: "#94a3b8" }}>
              コメント
            </p>
            <div
              className="rounded-xl p-4 text-center"
              style={{ background: "#232636", border: "1px dashed #2e3347" }}
            >
              <p className="text-xs" style={{ color: "#4a5568" }}>
                コメント機能は近日公開予定
              </p>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes slideIn {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
        `}</style>
      </div>
    </>
  );
}
