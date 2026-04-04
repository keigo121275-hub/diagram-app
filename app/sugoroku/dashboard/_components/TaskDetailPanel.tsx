"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createClient } from "@/lib/supabase/client";
import type { Task } from "@/lib/supabase/types";
import { STATUS_LABELS, STATUS_COLORS } from "@/app/sugoroku/_lib/constants";
import CommentSubPanel from "./CommentSubPanel";

interface TaskDetailPanelProps {
  task: Task;
  allTasks: Task[];
  onClose: () => void;
}

type SubTaskStatus = "todo" | "in_progress" | "done" | "needs_revision";

const SUB_STATUS_OPTIONS: { value: SubTaskStatus; label: string }[] = [
  { value: "todo", label: "未着手" },
  { value: "in_progress", label: "進行中" },
  { value: "done", label: "完了" },
  { value: "needs_revision", label: "要修正" },
];

// Sortable ラッパー: ドラッグハンドルを children に提供する render-prop コンポーネント
function SortableRow({
  id,
  children,
}: {
  id: string;
  children: (props: {
    isDragging: boolean;
    handleProps: React.HTMLAttributes<HTMLElement>;
  }) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      {...attributes}
    >
      {children({ isDragging, handleProps: listeners ?? {} })}
    </div>
  );
}

export default function TaskDetailPanel({ task, allTasks, onClose }: TaskDetailPanelProps) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);

  // 中タスク（大タスクの直接子）
  const [mediumTasks, setMediumTasks] = useState<Task[]>(
    allTasks
      .filter((t) => t.parent_id === task.id)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  );

  // 小タスク（中タスクの子）をマップで管理
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

  const [largeStatus, setLargeStatus] = useState<Task["status"]>(task.status);
  const [updatingLarge, setUpdatingLarge] = useState(false);
  const [updatingTask, setUpdatingTask] = useState<string | null>(null);

  // 展開状態（中タスクの小タスク表示トグル）
  const [expandedMediumIds, setExpandedMediumIds] = useState<Set<string>>(
    () => new Set(allTasks.filter((t) => t.parent_id === task.id).map((t) => t.id))
  );

  // 中タスク追加フォーム
  const [showAddMediumForm, setShowAddMediumForm] = useState(false);
  const [addingMediumTitle, setAddingMediumTitle] = useState("");
  const [addingMedium, setAddingMedium] = useState(false);

  // 小タスク追加フォーム（中タスクごと）
  const [showAddSmallMap, setShowAddSmallMap] = useState<Record<string, boolean>>({});
  const [addingSmallTitle, setAddingSmallTitle] = useState<Record<string, string>>({});
  const [addingSmall, setAddingSmall] = useState<string | null>(null);

  // 期限日
  const [dueDate, setDueDate] = useState<string>(task.due_date ?? "");
  const [savingDate, setSavingDate] = useState(false);

  // 成果物
  const [deliverableNote, setDeliverableNote] = useState<string>(task.deliverable_note ?? "");
  const [savingDeliverable, setSavingDeliverable] = useState(false);

  // タスク説明文
  const [taskDescription, setTaskDescription] = useState<string>(task.description ?? "");
  const [savingDescription, setSavingDescription] = useState(false);

  // インライン タイトル編集
  const [editingLargeTitle, setEditingLargeTitle] = useState(false);
  const [largeTitleValue, setLargeTitleValue] = useState(task.title);
  const [largeTitle, setLargeTitle] = useState(task.title);
  const [editingMediumId, setEditingMediumId] = useState<string | null>(null);
  const [mediumTitleValues, setMediumTitleValues] = useState<Record<string, string>>({});
  const [editingSmallId, setEditingSmallId] = useState<string | null>(null);
  const [smallTitleValues, setSmallTitleValues] = useState<Record<string, string>>({});

  // コメント件数バッジ（中・小タスクのID → 件数）
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});

  // コメントサブパネル
  const [commentSubTask, setCommentSubTask] = useState<Task | null>(null);

  // 差し戻し / 承認コメント
  const [rejectionComment, setRejectionComment] = useState<string | null>(null);
  const [approvalMessage, setApprovalMessage] = useState<string | null>(null);

  useEffect(() => {
    if (largeStatus !== "needs_revision" && largeStatus !== "done") {
      setRejectionComment(null);
      setApprovalMessage(null);
      return;
    }
    const targetStatus = largeStatus === "needs_revision" ? "rejected" : "approved";
    const supabase = createClient();
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
  }, [task.id, largeStatus]);

  // dnd-kit センサー（長押し400ms）
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 400, tolerance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 400, tolerance: 8 } })
  );

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

  // 全サブタスクのコメント件数を一括取得
  useEffect(() => {
    const allChildIds = allTasks
      .filter(
        (t) =>
          t.parent_id === task.id ||
          allTasks.some((m) => m.parent_id === task.id && m.id === t.parent_id)
      )
      .map((t) => t.id);
    if (allChildIds.length === 0) return;
    const supabase = createClient();
    supabase
      .from("comments")
      .select("task_id")
      .in("task_id", allChildIds)
      .then(({ data }) => {
        const counts: Record<string, number> = {};
        data?.forEach((c) => {
          counts[c.task_id] = (counts[c.task_id] ?? 0) + 1;
        });
        setCommentCounts(counts);
      });
  }, [task.id, allTasks]);

  const largeColors = STATUS_COLORS[largeStatus];

  // ---- タイトル編集 ----
  const saveLargeTitle = async () => {
    const trimmed = largeTitleValue.trim();
    if (!trimmed || trimmed === largeTitle) { setEditingLargeTitle(false); return; }
    const supabase = createClient();
    await supabase.from("tasks").update({ title: trimmed }).eq("id", task.id);
    setLargeTitle(trimmed);
    setEditingLargeTitle(false);
    router.refresh();
  };

  const saveMediumTitle = async (mediumId: string) => {
    const trimmed = (mediumTitleValues[mediumId] ?? "").trim();
    const original = mediumTasks.find((t) => t.id === mediumId)?.title ?? "";
    if (!trimmed || trimmed === original) { setEditingMediumId(null); return; }
    const supabase = createClient();
    await supabase.from("tasks").update({ title: trimmed }).eq("id", mediumId);
    setMediumTasks((prev) =>
      prev.map((t) => (t.id === mediumId ? { ...t, title: trimmed } : t))
    );
    setEditingMediumId(null);
    router.refresh();
  };

  const saveSmallTitle = async (mediumId: string, smallId: string) => {
    const trimmed = (smallTitleValues[smallId] ?? "").trim();
    const original = (smallTasksMap[mediumId] ?? []).find((t) => t.id === smallId)?.title ?? "";
    if (!trimmed || trimmed === original) { setEditingSmallId(null); return; }
    const supabase = createClient();
    await supabase.from("tasks").update({ title: trimmed }).eq("id", smallId);
    setSmallTasksMap((prev) => ({
      ...prev,
      [mediumId]: (prev[mediumId] ?? []).map((t) =>
        t.id === smallId ? { ...t, title: trimmed } : t
      ),
    }));
    setEditingSmallId(null);
    router.refresh();
  };

  // ---- タスク説明文 ----
  const saveDescription = async () => {
    setSavingDescription(true);
    const supabase = createClient();
    await supabase
      .from("tasks")
      .update({ description: taskDescription || null })
      .eq("id", task.id);
    setSavingDescription(false);
  };

  // ---- 期限日 ----
  const updateDueDate = async (value: string) => {
    setSavingDate(true);
    const supabase = createClient();
    await supabase.from("tasks").update({ due_date: value || null }).eq("id", task.id);
    setSavingDate(false);
    router.refresh();
  };

  // ---- 成果物 ----
  const saveDeliverable = async () => {
    setSavingDeliverable(true);
    const supabase = createClient();
    await supabase
      .from("tasks")
      .update({ deliverable_note: deliverableNote || null })
      .eq("id", task.id);
    setSavingDeliverable(false);
  };

  // ---- 大タスクステータス ----
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

  // ---- 中・小タスクステータス変更（プルダウン） ----
  const updateTaskStatus = async (
    taskId: string,
    newStatus: SubTaskStatus,
    isMedium: boolean,
    mediumParentId?: string
  ) => {
    setUpdatingTask(taskId);
    const supabase = createClient();
    await supabase.from("tasks").update({ status: newStatus }).eq("id", taskId);
    if (isMedium) {
      setMediumTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
      );
    } else if (mediumParentId) {
      setSmallTasksMap((prev) => ({
        ...prev,
        [mediumParentId]: (prev[mediumParentId] ?? []).map((t) =>
          t.id === taskId ? { ...t, status: newStatus } : t
        ),
      }));
    }
    setUpdatingTask(null);
    router.refresh();
  };

  // ---- 追加 ----
  const addMediumTask = async () => {
    if (!addingMediumTitle.trim()) return;
    setAddingMedium(true);
    const supabase = createClient();
    const { data: newTask } = await supabase
      .from("tasks")
      .insert({
        roadmap_id: task.roadmap_id,
        parent_id: task.id,
        title: addingMediumTitle.trim(),
        level: "medium",
        order: mediumTasks.length + 1,
        status: "todo",
      })
      .select()
      .single();
    if (newTask) {
      const t = newTask as Task;
      setMediumTasks((prev) => [...prev, t]);
      setSmallTasksMap((prev) => ({ ...prev, [t.id]: [] }));
      setExpandedMediumIds((prev) => new Set([...prev, t.id]));
    }
    setAddingMediumTitle("");
    setShowAddMediumForm(false);
    setAddingMedium(false);
    router.refresh();
  };

  const addSmallTask = async (mediumId: string) => {
    const title = addingSmallTitle[mediumId]?.trim();
    if (!title) return;
    setAddingSmall(mediumId);
    const supabase = createClient();
    const currentSmalls = smallTasksMap[mediumId] ?? [];
    const { data: newTask } = await supabase
      .from("tasks")
      .insert({
        roadmap_id: task.roadmap_id,
        parent_id: mediumId,
        title,
        level: "small",
        order: currentSmalls.length + 1,
        status: "todo",
      })
      .select()
      .single();
    if (newTask) {
      setSmallTasksMap((prev) => ({
        ...prev,
        [mediumId]: [...(prev[mediumId] ?? []), newTask as Task],
      }));
    }
    setAddingSmallTitle((prev) => ({ ...prev, [mediumId]: "" }));
    setShowAddSmallMap((prev) => ({ ...prev, [mediumId]: false }));
    setAddingSmall(null);
    router.refresh();
  };

  // ---- 削除 ----
  const deleteMediumTask = async (mediumId: string) => {
    if (!confirm("この中タスクと、その小タスクをすべて削除しますか？")) return;
    const supabase = createClient();
    const smallIds = (smallTasksMap[mediumId] ?? []).map((t) => t.id);
    if (smallIds.length > 0) {
      await supabase.from("tasks").delete().in("id", smallIds);
    }
    await supabase.from("tasks").delete().eq("id", mediumId);
    setMediumTasks((prev) => prev.filter((t) => t.id !== mediumId));
    setSmallTasksMap((prev) => {
      const next = { ...prev };
      delete next[mediumId];
      return next;
    });
    router.refresh();
  };

  const deleteSmallTask = async (mediumId: string, smallId: string) => {
    if (!confirm("この小タスクを削除しますか？")) return;
    const supabase = createClient();
    await supabase.from("tasks").delete().eq("id", smallId);
    setSmallTasksMap((prev) => ({
      ...prev,
      [mediumId]: (prev[mediumId] ?? []).filter((t) => t.id !== smallId),
    }));
    router.refresh();
  };

  // ---- ドラッグ&ドロップ ----
  const handleMediumDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = mediumTasks.findIndex((t) => t.id === active.id);
    const newIdx = mediumTasks.findIndex((t) => t.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(mediumTasks, oldIdx, newIdx).map((t, i) => ({
      ...t,
      order: i + 1,
    }));
    setMediumTasks(reordered);
    const supabase = createClient();
    await Promise.all(
      reordered.map((t) => supabase.from("tasks").update({ order: t.order }).eq("id", t.id))
    );
  };

  const handleSmallDragEnd = async (mediumId: string, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const smalls = smallTasksMap[mediumId] ?? [];
    const oldIdx = smalls.findIndex((t) => t.id === active.id);
    const newIdx = smalls.findIndex((t) => t.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(smalls, oldIdx, newIdx).map((t, i) => ({
      ...t,
      order: i + 1,
    }));
    setSmallTasksMap((prev) => ({ ...prev, [mediumId]: reordered }));
    const supabase = createClient();
    await Promise.all(
      reordered.map((t) => supabase.from("tasks").update({ order: t.order }).eq("id", t.id))
    );
  };

  // ---- その他ユーティリティ ----
  const handleCommentPosted = (taskId: string) => {
    setCommentCounts((prev) => ({ ...prev, [taskId]: (prev[taskId] ?? 0) + 1 }));
  };

  const toggleExpandMedium = (mediumId: string) => {
    setExpandedMediumIds((prev) => {
      const next = new Set(prev);
      if (next.has(mediumId)) next.delete(mediumId);
      else next.add(mediumId);
      return next;
    });
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
            {editingLargeTitle ? (
              <input
                value={largeTitleValue}
                onChange={(e) => setLargeTitleValue(e.target.value)}
                onBlur={saveLargeTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveLargeTitle();
                  if (e.key === "Escape") { setEditingLargeTitle(false); setLargeTitleValue(largeTitle); }
                }}
                autoFocus
                className="w-full px-3 py-1.5 rounded-lg text-base font-bold outline-none"
                style={{ background: "#232636", border: "1px solid #6c63ff", color: "#e2e8f0" }}
              />
            ) : (
              <h2
                className="text-base font-bold leading-snug cursor-pointer hover:underline"
                style={{ color: "#e2e8f0" }}
                title="クリックして編集"
                onClick={() => { setEditingLargeTitle(true); setLargeTitleValue(largeTitle); }}
              >
                {largeTitle}
              </h2>
            )}
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

          {/* タスク説明文 */}
          <div
            className="rounded-xl p-4"
            style={{ background: "#232636", border: "1px solid #2e3347" }}
          >
            <p className="text-xs font-medium mb-2" style={{ color: "#94a3b8" }}>
              説明・背景
            </p>
            <textarea
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              onBlur={saveDescription}
              placeholder="このタスクの意図や背景を入力..."
              rows={3}
              className="w-full text-xs outline-none resize-none rounded-lg p-2"
              style={{
                background: "#1a1d27",
                border: "1px solid #2e3347",
                color: "#e2e8f0",
              }}
            />
            {savingDescription && (
              <span className="text-xs" style={{ color: "#4a5568" }}>保存中...</span>
            )}
          </div>

          {/* サブタスク階層（大タスクのみ） */}
          {task.level === "large" && (
            <div
              className="rounded-xl p-4"
              style={{ background: "#232636", border: "1px solid #2e3347" }}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium" style={{ color: "#94a3b8" }}>
                  サブタスク
                  {mediumTasks.length > 0 && (
                    <span style={{ color: "#64748b" }}>
                      {" "}({mediumTasks.filter((m) => m.status === "done").length}/{mediumTasks.length} 完了)
                    </span>
                  )}
                </p>
                <button
                  onClick={() => setShowAddMediumForm(!showAddMediumForm)}
                  className="text-xs px-2 py-1 rounded-lg"
                  style={{ background: "#1a1d27", border: "1px solid #2e3347", color: "#94a3b8" }}
                >
                  + 中タスクを追加
                </button>
              </div>

              {/* 中タスク追加フォーム */}
              {showAddMediumForm && (
                <div
                  className="rounded-lg p-3 mb-3 space-y-2"
                  style={{ background: "#1a1d27", border: "1px solid #6c63ff" }}
                >
                  <input
                    value={addingMediumTitle}
                    onChange={(e) => setAddingMediumTitle(e.target.value)}
                    placeholder="中タスク名を入力..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addMediumTask();
                      if (e.key === "Escape") setShowAddMediumForm(false);
                    }}
                    autoFocus
                    className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                    style={{ background: "#232636", border: "1px solid #2e3347", color: "#e2e8f0" }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={addMediumTask}
                      disabled={!addingMediumTitle.trim() || addingMedium}
                      className="flex-1 py-1.5 rounded-lg text-xs font-medium"
                      style={{
                        background: "rgba(108,99,255,0.2)",
                        color: "#6c63ff",
                        border: "1px solid rgba(108,99,255,0.4)",
                        opacity: addingMedium ? 0.5 : 1,
                      }}
                    >
                      {addingMedium ? "追加中..." : "追加する"}
                    </button>
                    <button
                      onClick={() => { setShowAddMediumForm(false); setAddingMediumTitle(""); }}
                      className="px-3 py-1.5 rounded-lg text-xs"
                      style={{ background: "#232636", color: "#64748b" }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {mediumTasks.length === 0 && !showAddMediumForm ? (
                <p className="text-xs" style={{ color: "#4a5568" }}>
                  中タスクがまだありません。「+ 中タスクを追加」から作成できます。
                </p>
              ) : (
                /* 中タスクリスト（DnD） */
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleMediumDragEnd}
                >
                  <SortableContext
                    items={mediumTasks.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3">
                      {mediumTasks.map((medium, mediumIdx) => {
                        const mediumColors = STATUS_COLORS[medium.status];
                        const smallTasks = smallTasksMap[medium.id] ?? [];
                        const isExpanded = expandedMediumIds.has(medium.id);
                        const commentCount = commentCounts[medium.id] ?? 0;

                        return (
                          <SortableRow key={medium.id} id={medium.id}>
                            {({ isDragging, handleProps }) => (
                              <div style={{ opacity: isDragging ? 0.5 : 1 }}>
                                {/* 中タスク行 */}
                                <div
                                  className="rounded-lg p-3"
                                  style={{
                                    background: "#1a1d27",
                                    border: `1px solid ${mediumColors.border}`,
                                  }}
                                >
                                  <div className="flex items-start gap-1.5">
                                    {/* ドラッグハンドル */}
                                    <span
                                      {...handleProps}
                                      className="mt-0.5 text-sm shrink-0 cursor-grab active:cursor-grabbing select-none"
                                      style={{ color: "#3a4055", touchAction: "none" }}
                                      title="長押しでドラッグ"
                                    >
                                      ⠿
                                    </span>

                                    {/* 展開トグル */}
                                    <button
                                      onClick={() => toggleExpandMedium(medium.id)}
                                      className="mt-0.5 text-xs shrink-0 w-4 text-center"
                                      style={{ color: "#64748b" }}
                                    >
                                      {isExpanded ? "▼" : "▶"}
                                    </button>

                                    {/* 番号 + タイトル */}
                                    <div className="flex-1 min-w-0">
                                      {editingMediumId === medium.id ? (
                                        <input
                                          value={mediumTitleValues[medium.id] ?? medium.title}
                                          onChange={(e) =>
                                            setMediumTitleValues((prev) => ({
                                              ...prev,
                                              [medium.id]: e.target.value,
                                            }))
                                          }
                                          onBlur={() => saveMediumTitle(medium.id)}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") saveMediumTitle(medium.id);
                                            if (e.key === "Escape") setEditingMediumId(null);
                                          }}
                                          autoFocus
                                          className="w-full px-2 py-0.5 rounded text-xs outline-none"
                                          style={{ background: "#232636", border: "1px solid #6c63ff44", color: "#e2e8f0" }}
                                        />
                                      ) : (
                                        <p
                                          className="text-xs font-medium leading-snug cursor-pointer"
                                          style={{ color: "#e2e8f0" }}
                                          title="クリックして編集"
                                          onClick={() => {
                                            setEditingMediumId(medium.id);
                                            setMediumTitleValues((prev) => ({
                                              ...prev,
                                              [medium.id]: medium.title,
                                            }));
                                          }}
                                        >
                                          <span style={{ color: "#6c63ff", marginRight: 4 }}>
                                            {mediumIdx + 1}.
                                          </span>
                                          {medium.title}
                                        </p>
                                      )}
                                    </div>

                                    {/* 右端: コメント + ステータス選択 + 削除 */}
                                    <div className="flex items-center gap-1 shrink-0">
                                      {/* コメントアイコン */}
                                      <button
                                        onClick={() => setCommentSubTask(medium)}
                                        className="relative w-6 h-6 rounded flex items-center justify-center"
                                        style={{ background: "#232636", fontSize: 12 }}
                                        title="コメント"
                                      >
                                        💬
                                        {commentCount > 0 && (
                                          <span
                                            className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center font-bold"
                                            style={{ background: "#ef4444", color: "#fff", fontSize: 9 }}
                                          >
                                            {commentCount > 9 ? "9+" : commentCount}
                                          </span>
                                        )}
                                      </button>

                                      {/* ステータスプルダウン */}
                                      <select
                                        value={medium.status}
                                        disabled={updatingTask === medium.id}
                                        onChange={(e) =>
                                          updateTaskStatus(
                                            medium.id,
                                            e.target.value as SubTaskStatus,
                                            true
                                          )
                                        }
                                        className="text-xs rounded px-1 py-0.5 outline-none"
                                        style={{
                                          background: mediumColors.bg,
                                          color: mediumColors.text,
                                          border: `1px solid ${mediumColors.border}`,
                                          opacity: updatingTask === medium.id ? 0.5 : 1,
                                        }}
                                      >
                                        {SUB_STATUS_OPTIONS.map((opt) => (
                                          <option
                                            key={opt.value}
                                            value={opt.value}
                                            style={{ background: "#1a1d27", color: "#e2e8f0" }}
                                          >
                                            {opt.label}
                                          </option>
                                        ))}
                                      </select>

                                      {/* 削除 */}
                                      <button
                                        onClick={() => deleteMediumTask(medium.id)}
                                        className="w-5 h-5 rounded flex items-center justify-center"
                                        style={{ background: "transparent", color: "#3a4055", fontSize: 11 }}
                                        title="削除"
                                      >
                                        🗑
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                {/* 小タスク一覧（展開時） */}
                                {isExpanded && (
                                  <div className="ml-6 mt-1.5">
                                    <DndContext
                                      sensors={sensors}
                                      collisionDetection={closestCenter}
                                      onDragEnd={(e) => handleSmallDragEnd(medium.id, e)}
                                    >
                                      <SortableContext
                                        items={smallTasks.map((t) => t.id)}
                                        strategy={verticalListSortingStrategy}
                                      >
                                        <div className="space-y-1.5">
                                          {smallTasks.map((small, smallIdx) => {
                                            const smallColors = STATUS_COLORS[small.status];
                                            const smallCommentCount = commentCounts[small.id] ?? 0;

                                            return (
                                              <SortableRow key={small.id} id={small.id}>
                                                {({ isDragging: isDraggingSmall, handleProps: smallHandleProps }) => (
                                                  <div
                                                    className="rounded-lg p-2.5"
                                                    style={{
                                                      background: "#141622",
                                                      border: `1px solid ${smallColors.border}`,
                                                      opacity: isDraggingSmall ? 0.5 : 1,
                                                    }}
                                                  >
                                                    <div className="flex items-start gap-1.5">
                                                      {/* ドラッグハンドル */}
                                                      <span
                                                        {...smallHandleProps}
                                                        className="text-sm shrink-0 mt-0.5 cursor-grab active:cursor-grabbing select-none"
                                                        style={{ color: "#2e3347", touchAction: "none" }}
                                                        title="長押しでドラッグ"
                                                      >
                                                        ⠿
                                                      </span>

                                                      {/* 番号 + タイトル */}
                                                      <div className="flex-1 min-w-0">
                                                        {editingSmallId === small.id ? (
                                                          <input
                                                            value={smallTitleValues[small.id] ?? small.title}
                                                            onChange={(e) =>
                                                              setSmallTitleValues((prev) => ({
                                                                ...prev,
                                                                [small.id]: e.target.value,
                                                              }))
                                                            }
                                                            onBlur={() => saveSmallTitle(medium.id, small.id)}
                                                            onKeyDown={(e) => {
                                                              if (e.key === "Enter") saveSmallTitle(medium.id, small.id);
                                                              if (e.key === "Escape") setEditingSmallId(null);
                                                            }}
                                                            autoFocus
                                                            className="w-full px-1.5 py-0.5 rounded text-xs outline-none"
                                                            style={{ background: "#1e2032", border: "1px solid #6c63ff44", color: "#e2e8f0" }}
                                                          />
                                                        ) : (
                                                          <p
                                                            className="text-xs leading-snug cursor-pointer"
                                                            style={{ color: "#cbd5e1" }}
                                                            title="クリックして編集"
                                                            onClick={() => {
                                                              setEditingSmallId(small.id);
                                                              setSmallTitleValues((prev) => ({
                                                                ...prev,
                                                                [small.id]: small.title,
                                                              }));
                                                            }}
                                                          >
                                                            <span style={{ color: "#a5b4fc", marginRight: 4 }}>
                                                              {mediumIdx + 1}-{smallIdx + 1}.
                                                            </span>
                                                            {small.title}
                                                          </p>
                                                        )}
                                                      </div>

                                                      {/* 右端: コメント + ステータス選択 + 削除 */}
                                                      <div className="flex items-center gap-1 shrink-0">
                                                        {/* コメントアイコン */}
                                                        <button
                                                          onClick={() => setCommentSubTask(small)}
                                                          className="relative w-5 h-5 rounded flex items-center justify-center"
                                                          style={{ background: "#1e2032", fontSize: 10 }}
                                                          title="コメント"
                                                        >
                                                          💬
                                                          {smallCommentCount > 0 && (
                                                            <span
                                                              className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold"
                                                              style={{ background: "#ef4444", color: "#fff", fontSize: 8 }}
                                                            >
                                                              {smallCommentCount > 9 ? "9+" : smallCommentCount}
                                                            </span>
                                                          )}
                                                        </button>

                                                        {/* ステータスプルダウン */}
                                                        <select
                                                          value={small.status}
                                                          disabled={updatingTask === small.id}
                                                          onChange={(e) =>
                                                            updateTaskStatus(
                                                              small.id,
                                                              e.target.value as SubTaskStatus,
                                                              false,
                                                              medium.id
                                                            )
                                                          }
                                                          className="text-xs rounded px-1 py-0.5 outline-none"
                                                          style={{
                                                            background: smallColors.bg,
                                                            color: smallColors.text,
                                                            border: `1px solid ${smallColors.border}`,
                                                            opacity: updatingTask === small.id ? 0.5 : 1,
                                                          }}
                                                        >
                                                          {SUB_STATUS_OPTIONS.map((opt) => (
                                                            <option
                                                              key={opt.value}
                                                              value={opt.value}
                                                              style={{ background: "#1a1d27", color: "#e2e8f0" }}
                                                            >
                                                              {opt.label}
                                                            </option>
                                                          ))}
                                                        </select>

                                                        {/* 削除 */}
                                                        <button
                                                          onClick={() => deleteSmallTask(medium.id, small.id)}
                                                          className="w-5 h-5 rounded flex items-center justify-center"
                                                          style={{ background: "transparent", color: "#3a4055", fontSize: 10 }}
                                                          title="削除"
                                                        >
                                                          🗑
                                                        </button>
                                                      </div>
                                                    </div>
                                                  </div>
                                                )}
                                              </SortableRow>
                                            );
                                          })}
                                        </div>
                                      </SortableContext>
                                    </DndContext>

                                    {/* 小タスク追加フォーム */}
                                    <div className="mt-1.5">
                                      {showAddSmallMap[medium.id] ? (
                                        <div
                                          className="rounded-lg p-2.5"
                                          style={{ background: "#141622", border: "1px solid #6c63ff44" }}
                                        >
                                          <input
                                            value={addingSmallTitle[medium.id] ?? ""}
                                            onChange={(e) =>
                                              setAddingSmallTitle((prev) => ({
                                                ...prev,
                                                [medium.id]: e.target.value,
                                              }))
                                            }
                                            placeholder="小タスク名を入力..."
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter") addSmallTask(medium.id);
                                              if (e.key === "Escape")
                                                setShowAddSmallMap((prev) => ({ ...prev, [medium.id]: false }));
                                            }}
                                            autoFocus
                                            className="w-full px-2 py-1.5 rounded text-xs outline-none mb-1.5"
                                            style={{
                                              background: "#1e2032",
                                              border: "1px solid #2e3347",
                                              color: "#e2e8f0",
                                            }}
                                          />
                                          <div className="flex gap-1.5">
                                            <button
                                              onClick={() => addSmallTask(medium.id)}
                                              disabled={!addingSmallTitle[medium.id]?.trim() || addingSmall === medium.id}
                                              className="flex-1 py-1 rounded text-xs font-medium"
                                              style={{
                                                background: "rgba(108,99,255,0.2)",
                                                color: "#6c63ff",
                                                border: "1px solid rgba(108,99,255,0.4)",
                                                opacity: addingSmall === medium.id ? 0.5 : 1,
                                              }}
                                            >
                                              {addingSmall === medium.id ? "追加中..." : "追加"}
                                            </button>
                                            <button
                                              onClick={() =>
                                                setShowAddSmallMap((prev) => ({ ...prev, [medium.id]: false }))
                                              }
                                              className="px-2 py-1 rounded text-xs"
                                              style={{ background: "#1e2032", color: "#64748b" }}
                                            >
                                              ✕
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() =>
                                            setShowAddSmallMap((prev) => ({ ...prev, [medium.id]: true }))
                                          }
                                          className="w-full text-xs py-1.5 rounded-lg text-left pl-2"
                                          style={{
                                            background: "transparent",
                                            color: "#4a5568",
                                            border: "1px dashed #2e3347",
                                          }}
                                        >
                                          + 小タスクを追加
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </SortableRow>
                        );
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
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
              style={{ background: "rgba(250,204,21,0.08)", border: "1px solid rgba(250,204,21,0.25)" }}
            >
              <p className="text-xs" style={{ color: "#facc15" }}>
                承認待ちです。管理者の確認をお待ちください。
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
                ⚠️ 差し戻しコメント
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
                🎉 このマスは完了しました！
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
                成果物・報告
              </p>
              <textarea
                value={deliverableNote}
                onChange={(e) => setDeliverableNote(e.target.value)}
                onBlur={saveDeliverable}
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
