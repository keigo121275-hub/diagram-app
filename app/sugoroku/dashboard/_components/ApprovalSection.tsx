"use client";

import React from "react";
import type { Task } from "@/lib/supabase/types";

interface ApprovalSectionProps {
  largeStatus: Task["status"];
  updatingLarge: boolean;
  rejectionComment: string | null;
  approvalMessage: string | null;
  deliverableNote: string;
  savingDeliverable: boolean;
  onStartProgress: () => void;
  onSubmitApproval: () => void;
  onDeliverableChange: (v: string) => void;
  onDeliverableBlur: () => void;
}

export default React.memo(function ApprovalSection({
  largeStatus,
  updatingLarge,
  rejectionComment,
  approvalMessage,
  deliverableNote,
  savingDeliverable,
  onStartProgress,
  onSubmitApproval,
  onDeliverableChange,
  onDeliverableBlur,
}: ApprovalSectionProps) {
  return (
    <>
      {/* ステータス操作ボタン */}
      {largeStatus !== "done" && largeStatus !== "pending_approval" && (
        <div
          className="rounded-xl p-4"
          style={{ background: "#232636", border: "1px solid #3d3566" }}
        >
          <p className="text-xs font-medium mb-3" style={{ color: "#a5b4fc" }}>
            ⚔️ クエストを進める
          </p>
          <div className="flex gap-2 flex-wrap">
            {largeStatus === "todo" && (
              <button
                onClick={onStartProgress}
                disabled={updatingLarge}
                className="px-3 py-2 rounded-lg text-xs font-medium"
                style={{
                  background: "rgba(96,165,250,0.15)",
                  color: "#60a5fa",
                  border: "1px solid rgba(96,165,250,0.3)",
                  opacity: updatingLarge ? 0.5 : 1,
                }}
              >
                {updatingLarge ? "..." : "⚔️ 挑戦開始！"}
              </button>
            )}
            {largeStatus === "in_progress" && (
              <button
                onClick={onSubmitApproval}
                disabled={updatingLarge}
                className="px-3 py-2 rounded-lg text-xs font-medium"
                style={{
                  background: "rgba(250,204,21,0.15)",
                  color: "#facc15",
                  border: "1px solid rgba(250,204,21,0.3)",
                  opacity: updatingLarge ? 0.5 : 1,
                }}
              >
                {updatingLarge ? "..." : "✨ クリア申請する"}
              </button>
            )}
            {largeStatus === "needs_revision" && (
              <button
                onClick={onSubmitApproval}
                disabled={updatingLarge}
                className="px-3 py-2 rounded-lg text-xs font-medium"
                style={{
                  background: "rgba(96,165,250,0.15)",
                  color: "#60a5fa",
                  border: "1px solid rgba(96,165,250,0.3)",
                  opacity: updatingLarge ? 0.5 : 1,
                }}
              >
                {updatingLarge ? "..." : "🔄 再挑戦する"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 承認待ちメッセージ */}
      {largeStatus === "pending_approval" && (
        <div
          className="rounded-xl p-4"
          style={{ background: "rgba(250,204,21,0.08)", border: "1px solid rgba(250,204,21,0.25)" }}
        >
          <p className="text-xs" style={{ color: "#facc15" }}>
            ✨ クリア審判中…管理者の判定をお待ちください。
          </p>
        </div>
      )}

      {/* 差し戻しコメント */}
      {largeStatus === "needs_revision" && rejectionComment && (
        <div
          className="rounded-xl p-4"
          style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)" }}
        >
          <p className="text-xs font-medium mb-1" style={{ color: "#f87171" }}>
            🔄 再挑戦メッセージ
          </p>
          <p className="text-xs whitespace-pre-wrap" style={{ color: "#fca5a5" }}>
            {rejectionComment}
          </p>
        </div>
      )}

      {/* 完了メッセージ */}
      {largeStatus === "done" && (
        <div
          className="rounded-xl p-4"
          style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.25)" }}
        >
          <p className="text-xs font-medium" style={{ color: "#4ade80" }}>
            🏆 クエスト達成！このマスをクリアしました！
          </p>
          {approvalMessage && (
            <p className="text-xs mt-2 whitespace-pre-wrap" style={{ color: "#86efac" }}>
              管理者コメント: {approvalMessage}
            </p>
          )}
        </div>
      )}

      {/* 成果物・報告欄（done のときのみ） */}
      {largeStatus === "done" && (
        <div
          className="rounded-xl p-4"
          style={{ background: "#232636", border: "1px solid rgba(74,222,128,0.3)" }}
        >
          <p className="text-xs font-medium mb-2" style={{ color: "#4ade80" }}>
            🗝️ クリア報告・成果物
          </p>
          <textarea
            value={deliverableNote}
            onChange={(e) => onDeliverableChange(e.target.value)}
            onBlur={onDeliverableBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.currentTarget.value.endsWith("\n")) {
                e.preventDefault();
                onDeliverableBlur();
              }
            }}
            placeholder="成果物の内容や報告を入力してください..."
            rows={4}
            className="w-full text-xs outline-none resize-none rounded-lg p-3"
            style={{ background: "#1a1d27", border: "1px solid #2e3347", color: "#e2e8f0" }}
          />
          {savingDeliverable && (
            <p className="text-xs mt-1" style={{ color: "#4a5568" }}>保存中...</p>
          )}
        </div>
      )}
    </>
  );
});
