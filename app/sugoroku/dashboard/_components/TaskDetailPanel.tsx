"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Task } from "@/lib/supabase/types";
import { STATUS_LABELS, STATUS_COLORS } from "@/app/sugoroku/_lib/constants";

interface TaskDetailPanelProps {
  task: Task;
  allTasks: Task[];
  onClose: () => void;
}

type CommentWithAuthor = {
  id: string;
  body: string;
  created_at: string;
  author_id: string | null;
  author_name: string;
};

export default function TaskDetailPanel({ task, allTasks, onClose }: TaskDetailPanelProps) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);

  const [children, setChildren] = useState<Task[]>(
    allTasks
      .filter((t) => t.parent_id === task.id)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  );
  const [largeStatus, setLargeStatus] = useState<Task["status"]>(task.status);
  const [updatingLarge, setUpdatingLarge] = useState(false);
  const [updatingChild, setUpdatingChild] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addingTitle, setAddingTitle] = useState("");
  const [addingLevel, setAddingLevel] = useState<"medium" | "small">("medium");
  const [addingChild, setAddingChild] = useState(false);

  // 日付
  const [dueDate, setDueDate] = useState<string>(task.due_date ?? "");
  const [savingDate, setSavingDate] = useState(false);

  // コメント
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const fetchComments = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);

      const { data } = await supabase
        .from("comments")
        .select("*")
        .eq("task_id", task.id)
        .order("created_at", { ascending: true });

      if (data && data.length > 0) {
        const authorIds = [...new Set(data.map((c) => c.author_id).filter(Boolean))] as string[];
        const { data: members } = await supabase
          .from("members")
          .select("id, name")
          .in("id", authorIds);
        const memberMap = new Map(members?.map((m) => [m.id, m.name]) ?? []);
        setComments(
          data.map((c) => ({
            ...c,
            author_name: c.author_id ? (memberMap.get(c.author_id) ?? "不明") : "不明",
          }))
        );
      } else {
        setComments([]);
      }
      setCommentsLoading(false);
    };
    fetchComments();
  }, [task.id]);

  const largeColors = STATUS_COLORS[largeStatus];

  const getNextAction = (
    status: Task["status"]
  ): { label: string; next: Task["status"] } | null => {
    if (status === "todo") return { label: "進行中にする", next: "in_progress" };
    if (status === "in_progress") return { label: "完了にする", next: "done" };
    if (status === "needs_revision") return { label: "再開する", next: "in_progress" };
    return null;
  };

  const updateDueDate = async (value: string) => {
    setSavingDate(true);
    const supabase = createClient();
    await supabase
      .from("tasks")
      .update({ due_date: value || null })
      .eq("id", task.id);
    setSavingDate(false);
    router.refresh();
  };

  const updateLargeStatus = async (newStatus: Task["status"]) => {
    setUpdatingLarge(true);
    const supabase = createClient();
    await supabase.from("tasks").update({ status: newStatus }).eq("id", task.id);
    setLargeStatus(newStatus);
    setUpdatingLarge(false);
    router.refresh();
  };

  const submitApproval = async () => {
    setUpdatingLarge(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("approval_requests").delete().eq("task_id", task.id);
    await supabase.from("approval_requests").insert({
      task_id: task.id,
      requested_by: user?.id,
      status: "pending",
    });
    await supabase.from("tasks").update({ status: "pending_approval" }).eq("id", task.id);
    setLargeStatus("pending_approval");
    setUpdatingLarge(false);
    router.refresh();
  };

  const updateChildStatus = async (childId: string, newStatus: Task["status"]) => {
    setUpdatingChild(childId);
    const supabase = createClient();
    await supabase.from("tasks").update({ status: newStatus }).eq("id", childId);
    setChildren((prev) =>
      prev.map((c) => (c.id === childId ? { ...c, status: newStatus } : c))
    );
    setUpdatingChild(null);
    router.refresh();
  };

  const addChildTask = async () => {
    if (!addingTitle.trim()) return;
    setAddingChild(true);
    const supabase = createClient();
    const { data: newTask } = await supabase
      .from("tasks")
      .insert({
        roadmap_id: task.roadmap_id,
        parent_id: task.id,
        title: addingTitle.trim(),
        level: addingLevel,
        order: children.length + 1,
        status: "todo",
      })
      .select()
      .single();
    if (newTask) {
      setChildren((prev) => [...prev, newTask as Task]);
    }
    setAddingTitle("");
    setShowAddForm(false);
    setAddingChild(false);
    router.refresh();
  };

  const postComment = async () => {
    if (!commentText.trim() || postingComment) return;
    setPostingComment(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data: newComment } = await supabase
      .from("comments")
      .insert({ task_id: task.id, author_id: user?.id, body: commentText.trim() })
      .select()
      .single();

    if (newComment) {
      const { data: members } = await supabase
        .from("members")
        .select("id, name")
        .eq("id", user?.id ?? "");
      const name = members?.[0]?.name ?? "不明";
      setComments((prev) => [...prev, { ...newComment, author_name: name }]);
    }
    setCommentText("");
    setPostingComment(false);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.4)" }}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="fixed top-0 right-0 h-full z-50 overflow-y-auto"
        style={{
          width: "420px",
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
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "#232636", color: "#94a3b8" }}
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* タイトル・ステータス */}
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
                style={{ background: largeColors.bg, color: largeColors.text }}
              >
                {STATUS_LABELS[largeStatus]}
              </span>
            </div>
          </div>

          {/* 期限日 */}
          <div
            className="rounded-xl p-4"
            style={{ background: "#232636", border: "1px solid #2e3347" }}
          >
            <p className="text-xs font-medium mb-2" style={{ color: "#94a3b8" }}>
              期限日
            </p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                onBlur={(e) => updateDueDate(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-lg text-xs outline-none"
                style={{
                  background: "#1a1d27",
                  border: "1px solid #2e3347",
                  color: dueDate ? "#a5b4fc" : "#4a5568",
                  colorScheme: "dark",
                }}
              />
              {dueDate && (
                <button
                  onClick={() => { setDueDate(""); updateDueDate(""); }}
                  className="text-xs px-2 py-1.5 rounded-lg"
                  style={{ background: "#1a1d27", color: "#64748b", border: "1px solid #2e3347" }}
                >
                  クリア
                </button>
              )}
              {savingDate && (
                <span className="text-xs" style={{ color: "#4a5568" }}>保存中...</span>
              )}
            </div>
          </div>

          {/* サブタスク（大タスクのみ） */}
          {task.level === "large" && (
            <div
              className="rounded-xl p-4"
              style={{ background: "#232636", border: "1px solid #2e3347" }}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium" style={{ color: "#94a3b8" }}>
                  サブタスク{children.length > 0 && ` (${children.filter((c) => c.status === "done").length}/${children.length} 完了)`}
                </p>
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="text-xs px-2 py-1 rounded-lg"
                  style={{
                    background: "#1a1d27",
                    border: "1px solid #2e3347",
                    color: "#94a3b8",
                  }}
                >
                  + 追加
                </button>
              </div>

              {showAddForm && (
                <div
                  className="rounded-lg p-3 mb-3 space-y-2"
                  style={{ background: "#1a1d27", border: "1px solid #6c63ff" }}
                >
                  <input
                    value={addingTitle}
                    onChange={(e) => setAddingTitle(e.target.value)}
                    placeholder="サブタスク名を入力..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addChildTask();
                      if (e.key === "Escape") setShowAddForm(false);
                    }}
                    autoFocus
                    className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                    style={{
                      background: "#232636",
                      border: "1px solid #2e3347",
                      color: "#e2e8f0",
                    }}
                  />
                  <div className="flex gap-2">
                    <select
                      value={addingLevel}
                      onChange={(e) => setAddingLevel(e.target.value as "medium" | "small")}
                      className="px-2 py-1.5 rounded-lg text-xs outline-none"
                      style={{
                        background: "#232636",
                        border: "1px solid #2e3347",
                        color: "#94a3b8",
                      }}
                    >
                      <option value="medium">中タスク</option>
                      <option value="small">小タスク</option>
                    </select>
                    <button
                      onClick={addChildTask}
                      disabled={!addingTitle.trim() || addingChild}
                      className="flex-1 py-1.5 rounded-lg text-xs font-medium"
                      style={{
                        background: "rgba(108,99,255,0.2)",
                        color: "#6c63ff",
                        border: "1px solid rgba(108,99,255,0.4)",
                        opacity: addingChild ? 0.5 : 1,
                      }}
                    >
                      {addingChild ? "追加中..." : "追加する"}
                    </button>
                    <button
                      onClick={() => { setShowAddForm(false); setAddingTitle(""); }}
                      className="px-3 py-1.5 rounded-lg text-xs"
                      style={{ background: "#232636", color: "#64748b" }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {children.length === 0 && !showAddForm ? (
                <p className="text-xs" style={{ color: "#4a5568" }}>
                  サブタスクがまだありません。「+ 追加」から作成できます。
                </p>
              ) : (
                <div className="space-y-2">
                  {children.map((child) => {
                    const childColors = STATUS_COLORS[child.status];
                    const nextAction = getNextAction(child.status);
                    return (
                      <div
                        key={child.id}
                        className="rounded-lg p-3"
                        style={{
                          background: "#1a1d27",
                          border: `1px solid ${childColors.border}`,
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium leading-snug" style={{ color: "#e2e8f0" }}>
                              {child.title}
                            </p>
                            <div className="flex items-center gap-1 mt-1">
                              <span
                                className="text-xs px-1.5 py-0.5 rounded"
                                style={{ background: "rgba(0,0,0,0.3)", color: "#64748b" }}
                              >
                                {child.level === "medium" ? "中" : "小"}
                              </span>
                              <span
                                className="text-xs px-1.5 py-0.5 rounded font-medium"
                                style={{ background: childColors.bg, color: childColors.text }}
                              >
                                {STATUS_LABELS[child.status]}
                              </span>
                            </div>
                          </div>
                          {nextAction && (
                            <button
                              onClick={() => updateChildStatus(child.id, nextAction.next)}
                              disabled={updatingChild === child.id}
                              className="shrink-0 text-xs px-2 py-1 rounded-lg whitespace-nowrap"
                              style={{
                                background: childColors.bg,
                                color: childColors.text,
                                border: `1px solid ${childColors.border}`,
                                opacity: updatingChild === child.id ? 0.5 : 1,
                              }}
                            >
                              {updatingChild === child.id ? "..." : nextAction.label}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 大タスクのステータス操作 */}
          {largeStatus !== "done" && largeStatus !== "pending_approval" && (
            <div
              className="rounded-xl p-4"
              style={{ background: "#232636", border: "1px solid #2e3347" }}
            >
              <p className="text-xs font-medium mb-3" style={{ color: "#94a3b8" }}>
                マスのステータス変更
              </p>
              <div className="flex gap-2 flex-wrap">
                {largeStatus === "todo" && (
                  <button
                    onClick={() => updateLargeStatus("in_progress")}
                    disabled={updatingLarge}
                    className="px-3 py-2 rounded-lg text-xs font-medium"
                    style={{
                      background: "rgba(96,165,250,0.15)",
                      color: "#60a5fa",
                      border: "1px solid rgba(96,165,250,0.3)",
                      opacity: updatingLarge ? 0.5 : 1,
                    }}
                  >
                    {updatingLarge ? "..." : "進行中にする"}
                  </button>
                )}
                {largeStatus === "in_progress" && (
                  <button
                    onClick={submitApproval}
                    disabled={updatingLarge}
                    className="px-3 py-2 rounded-lg text-xs font-medium"
                    style={{
                      background: "rgba(250,204,21,0.15)",
                      color: "#facc15",
                      border: "1px solid rgba(250,204,21,0.3)",
                      opacity: updatingLarge ? 0.5 : 1,
                    }}
                  >
                    {updatingLarge ? "..." : "完了申請する"}
                  </button>
                )}
                {largeStatus === "needs_revision" && (
                  <button
                    onClick={submitApproval}
                    disabled={updatingLarge}
                    className="px-3 py-2 rounded-lg text-xs font-medium"
                    style={{
                      background: "rgba(96,165,250,0.15)",
                      color: "#60a5fa",
                      border: "1px solid rgba(96,165,250,0.3)",
                      opacity: updatingLarge ? 0.5 : 1,
                    }}
                  >
                    {updatingLarge ? "..." : "再申請する"}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 承認待ちメッセージ */}
          {largeStatus === "pending_approval" && (
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
          {largeStatus === "done" && (
            <div
              className="rounded-xl p-4"
              style={{
                background: "rgba(74,222,128,0.08)",
                border: "1px solid rgba(74,222,128,0.25)",
              }}
            >
              <p className="text-xs" style={{ color: "#4ade80" }}>
                このマスは完了しました！
              </p>
            </div>
          )}

          {/* コメント欄 */}
          <div>
            <p className="text-xs font-medium mb-3" style={{ color: "#94a3b8" }}>
              コメント{comments.length > 0 && ` (${comments.length})`}
            </p>

            {/* コメントリスト */}
            <div className="space-y-2 mb-3">
              {commentsLoading ? (
                <p className="text-xs text-center py-4" style={{ color: "#4a5568" }}>
                  読み込み中...
                </p>
              ) : comments.length === 0 ? (
                <p className="text-xs py-3 text-center" style={{ color: "#4a5568" }}>
                  まだコメントがありません
                </p>
              ) : (
                comments.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-xl p-3"
                    style={{ background: "#232636", border: "1px solid #2e3347" }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className="text-xs font-medium"
                        style={{
                          color: c.author_id === currentUserId ? "#6c63ff" : "#94a3b8",
                        }}
                      >
                        {c.author_id === currentUserId ? "あなた" : c.author_name}
                      </span>
                      <span className="text-xs" style={{ color: "#4a5568" }}>
                        {new Date(c.created_at).toLocaleDateString("ja-JP", {
                          month: "numeric",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: "#e2e8f0" }}>
                      {c.body}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* コメント投稿フォーム */}
            <div
              className="rounded-xl p-3"
              style={{ background: "#232636", border: "1px solid #2e3347" }}
            >
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) postComment();
                }}
                placeholder="コメントを入力... (⌘+Enter で送信)"
                rows={3}
                className="w-full text-xs outline-none resize-none mb-2"
                style={{
                  background: "transparent",
                  color: "#e2e8f0",
                }}
              />
              <div className="flex justify-end">
                <button
                  onClick={postComment}
                  disabled={!commentText.trim() || postingComment}
                  className="px-4 py-1.5 rounded-lg text-xs font-medium transition-opacity"
                  style={{
                    background: commentText.trim()
                      ? "linear-gradient(135deg, #6c63ff, #5a52e8)"
                      : "#2e3347",
                    color: commentText.trim() ? "#fff" : "#4a5568",
                    opacity: postingComment ? 0.5 : 1,
                  }}
                >
                  {postingComment ? "送信中..." : "送信"}
                </button>
              </div>
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
