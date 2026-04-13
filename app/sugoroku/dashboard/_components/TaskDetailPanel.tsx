"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Task } from "@/lib/supabase/types";
import TaskDetailHeader from "./TaskDetailHeader";
import SubTaskList from "./SubTaskList";
import ApprovalSection from "./ApprovalSection";
import CommentSubPanel from "./CommentSubPanel";

interface TaskDetailPanelProps {
  task: Task;
  allTasks: Task[];
  onClose: () => void;
  /** タスク（大・中・小問わず）のフィールド変更をボードに通知（即時 UI 更新用）*/
  onTaskUpdated?: (id: string, patch: Partial<Task>) => void;
  /** 削除されたタスク ID をボードの localTasksMap から即時除去 */
  onTaskDeleted?: (ids: string[]) => void;
}

export default function TaskDetailPanel({ task, allTasks, onClose, onTaskUpdated, onTaskDeleted }: TaskDetailPanelProps) {
  const supabase = useMemo(() => createClient(), []);

  // ---- 中・小タスク状態 ----
  const [mediumTasks, setMediumTasks] = useState<Task[]>(
    allTasks
      .filter((t) => t.parent_id === task.id)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  );

  const [smallTasksMap, setSmallTasksMap] = useState<Record<string, Task[]>>(() => {
    const mediumIds = allTasks.filter((t) => t.parent_id === task.id).map((t) => t.id);
    const map: Record<string, Task[]> = {};
    for (const mid of mediumIds) {
      map[mid] = allTasks
        .filter((t) => t.parent_id === mid)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    return map;
  });

  // allTasks が更新されたとき、中・小タスク状態に追従させる
  // allTasks の最新データを優先し、まだ allTasks に存在しないローカル追加分のみ保持
  useEffect(() => {
    const latestMedium = allTasks
      .filter((t) => t.parent_id === task.id)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    setMediumTasks((prev) => {
      // ローカルにしか存在しないタスク（INSERT 直後で allTasks 未反映）を保持
      const latestIds = new Set(latestMedium.map((t) => t.id));
      const localOnly = prev.filter((p) => !latestIds.has(p.id));
      const result = [...latestMedium, ...localOnly];
      // データが実質変わっていなければ同じ参照を返して無駄な再レンダーを防ぐ
      if (
        result.length === prev.length &&
        result.every((t, i) => t.id === prev[i]?.id && t.status === prev[i]?.status && t.title === prev[i]?.title)
      ) return prev;
      return result;
    });

    setSmallTasksMap((prev) => {
      const mediumIds = latestMedium.map((t) => t.id);
      const next: Record<string, Task[]> = {};
      for (const mid of mediumIds) {
        const latestSmalls = allTasks
          .filter((t) => t.parent_id === mid)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        const prevSmalls = prev[mid] ?? [];
        const latestIds = new Set(latestSmalls.map((t) => t.id));
        const localOnly = prevSmalls.filter((p) => !latestIds.has(p.id));
        next[mid] = [...latestSmalls, ...localOnly];
      }
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTasks, task.id]);

  // ---- メモ状態（差分更新で入力中を保護） ----
  const [memoValues, setMemoValues] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    allTasks.forEach((t) => {
      if (t.parent_id !== null) map[t.id] = t.description ?? "";
    });
    return map;
  });

  useEffect(() => {
    setMemoValues((prev) => {
      const next = { ...prev };
      allTasks.forEach((t) => {
        if (t.parent_id !== null && !(t.id in next)) {
          next[t.id] = t.description ?? "";
        }
      });
      return next;
    });
  }, [allTasks]);

  // ---- 大タスク状態 ----
  const [largeStatus, setLargeStatus] = useState<Task["status"]>(task.status);
  const [updatingLarge, setUpdatingLarge] = useState(false);
  const [updatingTask, setUpdatingTask] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string>(task.due_date ?? "");
  const [savingDate, setSavingDate] = useState(false);
  const [deliverableNote, setDeliverableNote] = useState<string>(task.deliverable_note ?? "");
  const [savingDeliverable, setSavingDeliverable] = useState(false);
  const [taskDescription, setTaskDescription] = useState<string>(task.description ?? "");
  const [savingDescription, setSavingDescription] = useState(false);
  const [descriptionSaved, setDescriptionSaved] = useState(false);
  const descTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deliverableTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // パネル unmount 時にタイマーをクリア
  useEffect(() => {
    return () => {
      if (descTimerRef.current) clearTimeout(descTimerRef.current);
      if (deliverableTimerRef.current) clearTimeout(deliverableTimerRef.current);
    };
  }, []);

  // ---- 展開状態 ----
  const [expandedMediumIds, setExpandedMediumIds] = useState<Set<string>>(
    () => new Set(allTasks.filter((t) => t.parent_id === task.id).map((t) => t.id))
  );

  // ---- コメント状態 ----
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [commentSubTask, setCommentSubTask] = useState<Task | null>(null);

  // ---- 承認コメント ----
  const [rejectionComment, setRejectionComment] = useState<string | null>(null);
  const [approvalMessage, setApprovalMessage] = useState<string | null>(null);

  // 差し戻し・承認コメントの取得
  useEffect(() => {
    if (largeStatus !== "needs_revision" && largeStatus !== "done") {
      setRejectionComment(null);
      setApprovalMessage(null);
      return;
    }
    const targetStatus = largeStatus === "needs_revision" ? "rejected" : "approved";
    supabase
      .from("approval_requests")
      .select("comment, reviewed_at")
      .eq("task_id", task.id)
      .eq("status", targetStatus)
      .order("reviewed_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (largeStatus === "needs_revision") {
          setRejectionComment(data?.comment ?? null);
        } else {
          setApprovalMessage(data?.comment ?? null);
        }
      });
  }, [task.id, largeStatus, supabase]);

  // 全サブタスク ID（コメント件数一括取得用）
  const allChildIds = useMemo(() => {
    const mediumIds = new Set(allTasks.filter((t) => t.parent_id === task.id).map((t) => t.id));
    return allTasks
      .filter((t) => t.parent_id === task.id || mediumIds.has(t.parent_id!))
      .map((t) => t.id);
  }, [allTasks, task.id]);

  useEffect(() => {
    if (allChildIds.length === 0) return;
    supabase
      .from("comments")
      .select("task_id")
      .in("task_id", allChildIds)
      .then(({ data }) => {
        const counts: Record<string, number> = {};
        data?.forEach((c) => { counts[c.task_id] = (counts[c.task_id] ?? 0) + 1; });
        setCommentCounts(counts);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id, supabase]);

  // ESC でパネルを閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (commentSubTask) setCommentSubTask(null);
        else onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, commentSubTask]);

  // ---- 大タスク操作ハンドラ ----
  const handleTitleSave = async (title: string) => {
    const { error } = await supabase.from("tasks").update({ title }).eq("id", task.id);
    if (error) { console.error("[TaskDetailPanel] handleTitleSave failed:", error); return; }
    onTaskUpdated?.(task.id, { title });
  };

  const handleDueDateBlur = async (value: string) => {
    setSavingDate(true);
    const { error } = await supabase.from("tasks").update({ due_date: value || null }).eq("id", task.id);
    setSavingDate(false);
    if (error) { console.error("[TaskDetailPanel] handleDueDateBlur failed:", error); return; }
    onTaskUpdated?.(task.id, { due_date: value || null });
  };

  const handleDueDateClear = () => {
    setDueDate("");
    handleDueDateBlur("");
  };

  const saveDescription = async (value: string) => {
    setSavingDescription(true);
    setDescriptionSaved(false);
    const { error } = await supabase.from("tasks").update({ description: value || null }).eq("id", task.id);
    if (error) {
      console.error("[TaskDetailPanel] saveDescription failed:", error);
      setSavingDescription(false);
      return;
    }
    onTaskUpdated?.(task.id, { description: value || null });
    setSavingDescription(false);
    setDescriptionSaved(true);
    setTimeout(() => setDescriptionSaved(false), 2000);
  };

  const handleDescriptionChange = (value: string) => {
    setTaskDescription(value);
    // 入力停止 800ms 後に自動保存（デバウンス）
    if (descTimerRef.current) clearTimeout(descTimerRef.current);
    descTimerRef.current = setTimeout(() => {
      descTimerRef.current = null;
      saveDescription(value);
    }, 800);
  };

  const handleDescriptionBlur = () => {
    // blur 時はデバウンスをキャンセルして即時保存
    if (descTimerRef.current) {
      clearTimeout(descTimerRef.current);
      descTimerRef.current = null;
    }
    saveDescription(taskDescription);
  };

  const handleDeliverableBlur = async () => {
    if (deliverableTimerRef.current) { clearTimeout(deliverableTimerRef.current); deliverableTimerRef.current = null; }
    await saveDeliverable(deliverableNote);
  };

  const saveDeliverable = async (value: string) => {
    setSavingDeliverable(true);
    const { error } = await supabase
      .from("tasks")
      .update({ deliverable_note: value || null })
      .eq("id", task.id);
    setSavingDeliverable(false);
    if (error) { console.error("[TaskDetailPanel] saveDeliverable failed:", error); return; }
    onTaskUpdated?.(task.id, { deliverable_note: value || null });
  };

  const handleDeliverableChange = (value: string) => {
    setDeliverableNote(value);
    if (deliverableTimerRef.current) clearTimeout(deliverableTimerRef.current);
    deliverableTimerRef.current = setTimeout(async () => {
      deliverableTimerRef.current = null;
      await saveDeliverable(value);
    }, 600);
  };

  const handleStartProgress = async () => {
    setUpdatingLarge(true);
    const { error } = await supabase.from("tasks").update({ status: "in_progress" }).eq("id", task.id);
    setUpdatingLarge(false);
    if (error) { console.error("[TaskDetailPanel] handleStartProgress failed:", error); return; }
    setLargeStatus("in_progress");
    onTaskUpdated?.(task.id, { status: "in_progress" });
  };

  const handleSubmitApproval = async () => {
    setUpdatingLarge(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("approval_requests").delete().eq("task_id", task.id);
    const { error } = await supabase.from("approval_requests").insert({
      task_id: task.id,
      requested_by: user?.id,
      status: "pending",
    });
    if (error) {
      console.error("[TaskDetailPanel] handleSubmitApproval failed:", error);
      setUpdatingLarge(false);
      return;
    }
    const { error: taskError } = await supabase.from("tasks").update({ status: "pending_approval" }).eq("id", task.id);
    setUpdatingLarge(false);
    if (taskError) { console.error("[TaskDetailPanel] handleSubmitApproval task update failed:", taskError); return; }
    setLargeStatus("pending_approval");
    onTaskUpdated?.(task.id, { status: "pending_approval" });
  };

  const handleCommentPosted = (taskId: string) => {
    setCommentCounts((prev) => ({ ...prev, [taskId]: (prev[taskId] ?? 0) + 1 }));
  };

  return (
    <>
      {/* オーバーレイ */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.4)" }}
        onClick={onClose}
      />

      {/* メインパネル */}
      <div
        className="fixed top-0 right-0 h-full z-50 overflow-y-auto"
        style={{
          width: "420px",
          background: "linear-gradient(180deg, #1a1d27 0%, #18162e 100%)",
          borderLeft: "1px solid #3d3566",
          animation: "slideIn 0.2s ease-out",
        }}
      >
        {/* ヘッダーバー */}
        <div
          className="sticky top-0 px-6 py-4 flex items-center justify-between"
          style={{
            background: "linear-gradient(135deg, rgba(26,29,39,0.97) 0%, rgba(30,26,58,0.97) 100%)",
            borderBottom: "1px solid #3d3566",
            backdropFilter: "blur(8px)",
          }}
        >
          <div className="flex items-center gap-2">
            <span style={{ fontSize: "18px" }}>⚔️</span>
            <h3 className="font-bold text-sm" style={{ color: "#e2e8f0" }}>
              クエスト詳細
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "#232636", color: "#94a3b8" }}
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5">
          <TaskDetailHeader
            task={task}
            largeStatus={largeStatus}
            dueDate={dueDate}
            savingDate={savingDate}
            taskDescription={taskDescription}
            savingDescription={savingDescription}
            descriptionSaved={descriptionSaved}
            onTitleSave={handleTitleSave}
            onDueDateChange={setDueDate}
            onDueDateBlur={handleDueDateBlur}
            onDueDateClear={handleDueDateClear}
            onDescriptionChange={handleDescriptionChange}
            onDescriptionBlur={handleDescriptionBlur}
          />

          {/* サブタスク階層（大タスクのみ） */}
          {task.level === "large" && (
            <SubTaskList
              parentTask={task}
              mediumTasks={mediumTasks}
              setMediumTasks={setMediumTasks}
              smallTasksMap={smallTasksMap}
              setSmallTasksMap={setSmallTasksMap}
              memoValues={memoValues}
              setMemoValues={setMemoValues}
              expandedMediumIds={expandedMediumIds}
              setExpandedMediumIds={setExpandedMediumIds}
              commentCounts={commentCounts}
              updatingTask={updatingTask}
              setUpdatingTask={setUpdatingTask}
              onCommentClick={setCommentSubTask}
              onTaskUpdated={onTaskUpdated}
              onTaskDeleted={onTaskDeleted}
            />
          )}

          <ApprovalSection
            largeStatus={largeStatus}
            updatingLarge={updatingLarge}
            rejectionComment={rejectionComment}
            approvalMessage={approvalMessage}
            deliverableNote={deliverableNote}
            savingDeliverable={savingDeliverable}
            onStartProgress={handleStartProgress}
            onSubmitApproval={handleSubmitApproval}
            onDeliverableChange={handleDeliverableChange}
            onDeliverableBlur={handleDeliverableBlur}
          />
        </div>

        <style>{`
          @keyframes slideIn {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
        `}</style>
      </div>

      {/* コメントサブパネル */}
      {commentSubTask && (
        <CommentSubPanel
          task={commentSubTask}
          onClose={() => setCommentSubTask(null)}
          onCommentPosted={handleCommentPosted}
        />
      )}
    </>
  );
}
