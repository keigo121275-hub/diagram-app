"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ApprovalItem } from "../page";

interface ApprovalListProps {
  items: ApprovalItem[];
}

export default function ApprovalList({ items }: ApprovalListProps) {
  const router = useRouter();
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approveComment, setApproveComment] = useState("");
  const [localItems, setLocalItems] = useState<ApprovalItem[]>(items);

  const handleApprove = async (item: ApprovalItem) => {
    setProcessing(item.id);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    await supabase
      .from("approval_requests")
      .update({
        status: "approved",
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
        ...(approveComment.trim() ? { comment: approveComment.trim() } : {}),
      })
      .eq("id", item.id);

    await supabase
      .from("tasks")
      .update({ status: "done" })
      .eq("id", item.task_id);

    setLocalItems((prev) => prev.filter((i) => i.id !== item.id));
    setApprovingId(null);
    setApproveComment("");
    setProcessing(null);
    router.refresh();
  };

  const handleReject = async (item: ApprovalItem) => {
    if (!rejectComment.trim()) return;
    setProcessing(item.id);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    await supabase
      .from("approval_requests")
      .update({
        status: "rejected",
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
        comment: rejectComment.trim(),
      })
      .eq("id", item.id);

    await supabase
      .from("tasks")
      .update({ status: "needs_revision" })
      .eq("id", item.task_id);

    setLocalItems((prev) => prev.filter((i) => i.id !== item.id));
    setRejectingId(null);
    setRejectComment("");
    setProcessing(null);
    router.refresh();
  };

  if (localItems.length === 0) {
    return (
      <div
        className="rounded-2xl p-12 text-center"
        style={{ background: "#1a1d27", border: "1px dashed #2e3347" }}
      >
        <div className="text-4xl mb-4">✅</div>
        <p style={{ color: "#94a3b8" }}>未承認の申請はありません</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {localItems.map((item) => (
        <div
          key={item.id}
          className="rounded-2xl p-5"
          style={{
            background: "#1a1d27",
            border: "1px solid #2e3347",
          }}
        >
          {/* ヘッダー情報 */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-xs px-2 py-0.5 rounded font-medium"
                  style={{
                    background: "rgba(250,204,21,0.15)",
                    color: "#facc15",
                    border: "1px solid rgba(250,204,21,0.3)",
                    animation: "blink 1.5s ease-in-out infinite",
                  }}
                >
                  承認待ち
                </span>
                <span className="text-xs" style={{ color: "#64748b" }}>
                  {new Date(item.created_at).toLocaleDateString("ja-JP")}
                </span>
              </div>
              <p className="font-bold text-sm" style={{ color: "#e2e8f0" }}>
                {item.task_title}
              </p>
              <p className="text-xs mt-1" style={{ color: "#64748b" }}>
                {item.requested_by_name} ／ {item.roadmap_title}
              </p>
            </div>
          </div>

          {/* 差し戻しコメント入力欄 */}
          {rejectingId === item.id && (
            <div
              className="rounded-xl p-3 mb-4"
              style={{ background: "#1f0f0f", border: "1px solid rgba(248,113,113,0.3)" }}
            >
              <p className="text-xs mb-2" style={{ color: "#f87171" }}>
                差し戻しコメント（必須）
              </p>
              <textarea
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
                placeholder="修正してほしい点を入力してください..."
                rows={3}
                autoFocus
                className="w-full px-3 py-2 rounded-lg text-xs outline-none resize-none"
                style={{
                  background: "#232636",
                  border: "1px solid #2e3347",
                  color: "#e2e8f0",
                }}
              />
            </div>
          )}

          {/* 承認コメント入力欄（オプション） */}
          {approvingId === item.id && (
            <div
              className="rounded-xl p-3 mb-4"
              style={{ background: "#0f1f0f", border: "1px solid rgba(74,222,128,0.3)" }}
            >
              <p className="text-xs mb-2" style={{ color: "#4ade80" }}>
                承認コメント（任意）
              </p>
              <textarea
                value={approveComment}
                onChange={(e) => setApproveComment(e.target.value)}
                placeholder="メンバーへのフィードバックや一言を入力..."
                rows={3}
                autoFocus
                className="w-full px-3 py-2 rounded-lg text-xs outline-none resize-none"
                style={{
                  background: "#232636",
                  border: "1px solid #2e3347",
                  color: "#e2e8f0",
                }}
              />
            </div>
          )}

          {/* アクションボタン */}
          <div className="flex gap-2">
            {approvingId === item.id ? (
              <>
                <button
                  onClick={() => handleApprove(item)}
                  disabled={processing === item.id}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
                  style={{
                    background: processing === item.id ? "#232636" : "linear-gradient(135deg, #4ade80, #22c55e)",
                    color: processing === item.id ? "#4a5568" : "#fff",
                  }}
                >
                  {processing === item.id ? "処理中..." : "承認を確定する"}
                </button>
                <button
                  onClick={() => { setApprovingId(null); setApproveComment(""); }}
                  className="px-4 py-2.5 rounded-xl text-sm"
                  style={{ background: "#232636", color: "#64748b" }}
                >
                  キャンセル
                </button>
              </>
            ) : (
              <button
                onClick={() => setApprovingId(item.id)}
                disabled={processing === item.id || rejectingId === item.id}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
                style={{
                  background: "linear-gradient(135deg, #4ade80, #22c55e)",
                  color: "#fff",
                  opacity: rejectingId === item.id ? 0.5 : 1,
                }}
              >
                ✅ 承認する
              </button>
            )}

            {rejectingId === item.id ? (
              <>
                <button
                  onClick={() => handleReject(item)}
                  disabled={!rejectComment.trim() || processing === item.id}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                  style={{
                    background: rejectComment.trim() ? "rgba(248,113,113,0.2)" : "#232636",
                    color: rejectComment.trim() ? "#f87171" : "#4a5568",
                    border: "1px solid rgba(248,113,113,0.3)",
                  }}
                >
                  差し戻しを確定
                </button>
                <button
                  onClick={() => { setRejectingId(null); setRejectComment(""); }}
                  className="px-4 py-2.5 rounded-xl text-sm"
                  style={{ background: "#232636", color: "#64748b" }}
                >
                  キャンセル
                </button>
              </>
            ) : (
              <button
                onClick={() => setRejectingId(item.id)}
                disabled={processing === item.id}
                className="px-5 py-2.5 rounded-xl text-sm font-medium"
                style={{
                  background: "rgba(248,113,113,0.1)",
                  color: "#f87171",
                  border: "1px solid rgba(248,113,113,0.25)",
                }}
              >
                ❌ 差し戻す
              </button>
            )}
          </div>
        </div>
      ))}

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
