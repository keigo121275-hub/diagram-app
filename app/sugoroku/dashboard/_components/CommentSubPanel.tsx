"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Task } from "@/lib/supabase/types";

interface CommentWithAuthor {
  id: string;
  body: string;
  created_at: string;
  author_id: string | null;
  author_name: string;
}

interface CommentSubPanelProps {
  task: Task;
  onClose: () => void;
  onCommentPosted: (taskId: string) => void;
}

export default function CommentSubPanel({
  task,
  onClose,
  onCommentPosted,
}: CommentSubPanelProps) {
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [commentText, setCommentText] = useState("");
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // スライドインアニメーション用に少し遅延
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 200);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  // handleClose は onClose に依存するため onClose を deps に含める
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  useEffect(() => {
    const fetchComments = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);

      const { data } = await supabase
        .from("comments")
        .select("*")
        .eq("task_id", task.id)
        .order("created_at", { ascending: true });

      if (data && data.length > 0) {
        const authorIds = [
          ...new Set(data.map((c) => c.author_id).filter(Boolean)),
        ] as string[];
        const { data: members } = await supabase
          .from("members")
          .select("id, name")
          .in("id", authorIds);
        const memberMap = new Map(members?.map((m) => [m.id, m.name]) ?? []);
        setComments(
          data.map((c) => ({
            ...c,
            author_name: c.author_id
              ? (memberMap.get(c.author_id) ?? "不明")
              : "不明",
          }))
        );
      } else {
        setComments([]);
      }
      setLoading(false);
    };
    fetchComments();
  }, [task.id]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 200);
  };

  const postComment = async () => {
    if (!commentText.trim() || posting) return;
    setPosting(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

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
      onCommentPosted(task.id);
    }
    setCommentText("");
    setPosting(false);
  };

  const levelLabel =
    task.level === "medium" ? "中タスク" : task.level === "small" ? "小タスク" : "";

  return (
    <div
      className="fixed top-0 right-0 h-full overflow-y-auto"
      style={{
        width: "360px",
        background: "#141622",
        borderLeft: "1px solid #6c63ff44",
        zIndex: 60,
        transform: visible ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.2s ease-out",
        boxShadow: visible ? "-8px 0 32px rgba(0,0,0,0.5)" : "none",
      }}
    >
      {/* ヘッダー */}
      <div
        className="sticky top-0 px-5 py-4 flex items-center justify-between"
        style={{
          background: "rgba(20,22,34,0.95)",
          borderBottom: "1px solid #2e3347",
          backdropFilter: "blur(8px)",
        }}
      >
        <div className="flex-1 min-w-0 mr-2">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ background: "rgba(108,99,255,0.2)", color: "#a5b4fc" }}
            >
              {levelLabel}
            </span>
            <span className="text-xs" style={{ color: "#64748b" }}>
              コメント{comments.length > 0 ? ` (${comments.length})` : ""}
            </span>
          </div>
          <p
            className="text-xs font-medium leading-snug truncate"
            style={{ color: "#e2e8f0" }}
          >
            {task.title}
          </p>
        </div>
        <button
          onClick={handleClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "#232636", color: "#94a3b8" }}
        >
          ✕
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* コメントリスト */}
        <div className="space-y-2">
          {loading ? (
            <p className="text-xs text-center py-6" style={{ color: "#4a5568" }}>
              読み込み中...
            </p>
          ) : comments.length === 0 ? (
            <p className="text-xs py-6 text-center" style={{ color: "#4a5568" }}>
              まだコメントがありません
            </p>
          ) : (
            comments.map((c) => (
              <div
                key={c.id}
                className="rounded-xl p-3"
                style={{ background: "#1e2032", border: "1px solid #2e3347" }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className="text-xs font-medium"
                    style={{
                      color:
                        c.author_id === currentUserId ? "#6c63ff" : "#94a3b8",
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
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: "#e2e8f0" }}
                >
                  {c.body}
                </p>
              </div>
            ))
          )}
        </div>

        {/* コメント投稿フォーム */}
        <div
          className="rounded-xl p-3"
          style={{ background: "#1e2032", border: "1px solid #2e3347" }}
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
              disabled={!commentText.trim() || posting}
              className="px-4 py-1.5 rounded-lg text-xs font-medium transition-opacity"
              style={{
                background: commentText.trim()
                  ? "linear-gradient(135deg, #6c63ff, #5a52e8)"
                  : "#2e3347",
                color: commentText.trim() ? "#fff" : "#4a5568",
                opacity: posting ? 0.5 : 1,
              }}
            >
              {posting ? "送信中..." : "送信"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
