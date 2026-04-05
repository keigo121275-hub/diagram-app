"use client";

import React, { useMemo } from "react";
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
import { STATUS_COLORS } from "@/app/sugoroku/_lib/constants";
import MemoLinkField from "./MemoLinkField";

// ---- 型定義 ----
type SubTaskStatus = "todo" | "in_progress" | "done" | "needs_revision";
const SUB_STATUS_KEYS: SubTaskStatus[] = ["todo", "in_progress", "done", "needs_revision"];

import { STATUS_LABELS } from "@/app/sugoroku/_lib/constants";
const SUB_STATUS_OPTIONS = SUB_STATUS_KEYS.map((v) => ({ value: v, label: STATUS_LABELS[v] }));

// ---- Sortable ラッパー ----
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} {...attributes}>
      {children({ isDragging, handleProps: listeners ?? {} })}
    </div>
  );
}

// ---- Props ----
interface SubTaskListProps {
  /** 親の大タスク */
  parentTask: Task;
  mediumTasks: Task[];
  setMediumTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  smallTasksMap: Record<string, Task[]>;
  setSmallTasksMap: React.Dispatch<React.SetStateAction<Record<string, Task[]>>>;
  memoValues: Record<string, string>;
  setMemoValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  expandedMediumIds: Set<string>;
  setExpandedMediumIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  commentCounts: Record<string, number>;
  updatingTask: string | null;
  setUpdatingTask: React.Dispatch<React.SetStateAction<string | null>>;
  onCommentClick: (task: Task) => void;
}

export default React.memo(function SubTaskList({
  parentTask,
  mediumTasks,
  setMediumTasks,
  smallTasksMap,
  setSmallTasksMap,
  memoValues,
  setMemoValues,
  expandedMediumIds,
  setExpandedMediumIds,
  commentCounts,
  updatingTask,
  setUpdatingTask,
  onCommentClick,
}: SubTaskListProps) {
  const supabase = useMemo(() => createClient(), []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 400, tolerance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 400, tolerance: 8 } })
  );

  // タイトル編集中の「1回目のEnter」を追跡するフラグ（2回で確定）
  const lastKeyWasEnterRef = React.useRef(false);

  // ---- 追加フォーム状態 ----
  const [showAddMediumForm, setShowAddMediumForm] = React.useState(false);
  const [addingMediumTitle, setAddingMediumTitle] = React.useState("");
  const [addingMedium, setAddingMedium] = React.useState(false);
  const [showAddSmallMap, setShowAddSmallMap] = React.useState<Record<string, boolean>>({});
  const [addingSmallTitle, setAddingSmallTitle] = React.useState<Record<string, string>>({});
  const [addingSmall, setAddingSmall] = React.useState<string | null>(null);
  const [editingMediumId, setEditingMediumId] = React.useState<string | null>(null);
  const [mediumTitleValues, setMediumTitleValues] = React.useState<Record<string, string>>({});
  const [editingSmallId, setEditingSmallId] = React.useState<string | null>(null);
  const [smallTitleValues, setSmallTitleValues] = React.useState<Record<string, string>>({});

  // ---- 操作ハンドラ ----
  const saveMediumTitle = async (mediumId: string) => {
    const trimmed = (mediumTitleValues[mediumId] ?? "").trim();
    const original = mediumTasks.find((t) => t.id === mediumId)?.title ?? "";
    if (!trimmed || trimmed === original) { setEditingMediumId(null); return; }
    await supabase.from("tasks").update({ title: trimmed }).eq("id", mediumId);
    setMediumTasks((prev) => prev.map((t) => (t.id === mediumId ? { ...t, title: trimmed } : t)));
    setEditingMediumId(null);
  };

  const saveSmallTitle = async (mediumId: string, smallId: string) => {
    const trimmed = (smallTitleValues[smallId] ?? "").trim();
    const original = (smallTasksMap[mediumId] ?? []).find((t) => t.id === smallId)?.title ?? "";
    if (!trimmed || trimmed === original) { setEditingSmallId(null); return; }
    await supabase.from("tasks").update({ title: trimmed }).eq("id", smallId);
    setSmallTasksMap((prev) => ({
      ...prev,
      [mediumId]: (prev[mediumId] ?? []).map((t) => (t.id === smallId ? { ...t, title: trimmed } : t)),
    }));
    setEditingSmallId(null);
  };

  const saveMemo = async (taskId: string) => {
    const value = memoValues[taskId] ?? "";
    await supabase.from("tasks").update({ description: value || null }).eq("id", taskId);
  };

  const updateTaskStatus = async (
    taskId: string,
    newStatus: SubTaskStatus,
    isMedium: boolean,
    mediumParentId?: string
  ) => {
    setUpdatingTask(taskId);
    await supabase.from("tasks").update({ status: newStatus }).eq("id", taskId);
    if (isMedium) {
      setMediumTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
    } else if (mediumParentId) {
      setSmallTasksMap((prev) => ({
        ...prev,
        [mediumParentId]: (prev[mediumParentId] ?? []).map((t) =>
          t.id === taskId ? { ...t, status: newStatus } : t
        ),
      }));
    }
    setUpdatingTask(null);
  };

  const addMediumTask = async () => {
    if (!addingMediumTitle.trim()) return;
    setAddingMedium(true);
    const { data: newTask } = await supabase
      .from("tasks")
      .insert({
        roadmap_id: parentTask.roadmap_id,
        parent_id: parentTask.id,
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
  };

  const addSmallTask = async (mediumId: string) => {
    const title = addingSmallTitle[mediumId]?.trim();
    if (!title) return;
    setAddingSmall(mediumId);
    const currentSmalls = smallTasksMap[mediumId] ?? [];
    const { data: newTask } = await supabase
      .from("tasks")
      .insert({
        roadmap_id: parentTask.roadmap_id,
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
  };

  const deleteMediumTask = async (mediumId: string) => {
    if (!confirm("この中タスクと、その小タスクをすべて削除しますか？")) return;
    const smallIds = (smallTasksMap[mediumId] ?? []).map((t) => t.id);
    if (smallIds.length > 0) await supabase.from("tasks").delete().in("id", smallIds);
    await supabase.from("tasks").delete().eq("id", mediumId);
    setMediumTasks((prev) => prev.filter((t) => t.id !== mediumId));
    setSmallTasksMap((prev) => {
      const next = { ...prev };
      delete next[mediumId];
      return next;
    });
  };

  const deleteSmallTask = async (mediumId: string, smallId: string) => {
    if (!confirm("この小タスクを削除しますか？")) return;
    await supabase.from("tasks").delete().eq("id", smallId);
    setSmallTasksMap((prev) => ({
      ...prev,
      [mediumId]: (prev[mediumId] ?? []).filter((t) => t.id !== smallId),
    }));
  };

  const handleMediumDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = mediumTasks.findIndex((t) => t.id === active.id);
    const newIdx = mediumTasks.findIndex((t) => t.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(mediumTasks, oldIdx, newIdx).map((t, i) => ({ ...t, order: i + 1 }));
    setMediumTasks(reordered);
    await Promise.all(reordered.map((t) => supabase.from("tasks").update({ order: t.order }).eq("id", t.id)));
  };

  const handleSmallDragEnd = async (mediumId: string, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const smalls = smallTasksMap[mediumId] ?? [];
    const oldIdx = smalls.findIndex((t) => t.id === active.id);
    const newIdx = smalls.findIndex((t) => t.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(smalls, oldIdx, newIdx).map((t, i) => ({ ...t, order: i + 1 }));
    setSmallTasksMap((prev) => ({ ...prev, [mediumId]: reordered }));
    await Promise.all(reordered.map((t) => supabase.from("tasks").update({ order: t.order }).eq("id", t.id)));
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
    <div
      className="rounded-xl p-4"
      style={{ background: "#232636", border: "1px solid #2e3347" }}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium" style={{ color: "#94a3b8" }}>
          サブクエスト
          {mediumTasks.length > 0 && (
            <span style={{ color: "#64748b" }}>
              {" "}({mediumTasks.filter((m) => m.status === "done").length}/{mediumTasks.length} 達成)
            </span>
          )}
        </p>
        <button
          onClick={() => setShowAddMediumForm(!showAddMediumForm)}
          className="text-xs px-2 py-1 rounded-lg"
          style={{ background: "#1a1d27", border: "1px solid #2e3347", color: "#94a3b8" }}
        >
          + サブクエスト追加
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
            placeholder="サブクエスト名を入力..."
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
          サブクエストがまだありません。「+ サブクエスト追加」から作成できます。
        </p>
      ) : (
        <DndContext
          id={`task-panel-medium-${parentTask.id}`}
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

                const smallDoneCount = smallTasks.filter((s) => s.status === "done").length;

                return (
                  <SortableRow key={medium.id} id={medium.id}>
                    {({ isDragging, handleProps }) => (
                      <div style={{ opacity: isDragging ? 0.5 : 1 }}>
                        {/* 中タスク行 */}
                        <div
                          className="rounded-lg p-3 group"
                          style={{
                            background: "#1a1d27",
                            border: `1px solid ${mediumColors.border}`,
                            borderLeft: `3px solid ${mediumColors.border}`,
                          }}
                        >
                          <div className="flex items-start gap-1.5">
                            <span
                              {...handleProps}
                              className="mt-0.5 text-sm shrink-0 cursor-grab active:cursor-grabbing select-none"
                              style={{ color: "#3a4055", touchAction: "none" }}
                              title="長押しでドラッグ"
                            >
                              ⠿
                            </span>
                            <button
                              onClick={() => toggleExpandMedium(medium.id)}
                              className="mt-0.5 text-xs shrink-0 w-4 text-center"
                              style={{ color: "#64748b" }}
                            >
                              {isExpanded ? "▼" : "▶"}
                            </button>
                            <div className="flex-1 min-w-0">
                              {editingMediumId === medium.id ? (
                                <input
                                  value={mediumTitleValues[medium.id] ?? medium.title}
                                  onChange={(e) =>
                                    setMediumTitleValues((prev) => ({ ...prev, [medium.id]: e.target.value }))
                                  }
                                  onBlur={() => saveMediumTitle(medium.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      if (lastKeyWasEnterRef.current) {
                                        lastKeyWasEnterRef.current = false;
                                        saveMediumTitle(medium.id);
                                      } else {
                                        lastKeyWasEnterRef.current = true;
                                      }
                                    } else if (e.key === "Escape") {
                                      lastKeyWasEnterRef.current = false;
                                      setEditingMediumId(null);
                                    } else {
                                      lastKeyWasEnterRef.current = false;
                                    }
                                  }}
                                  autoFocus
                                  className="w-full px-2 py-0.5 rounded text-sm outline-none"
                                  style={{ background: "#232636", border: "1px solid #6c63ff44", color: "#e2e8f0" }}
                                />
                              ) : (
                                <p
                                  className="text-sm font-medium leading-snug cursor-pointer"
                                  style={{ color: "#e2e8f0" }}
                                  title="クリックして編集"
                                  onClick={() => {
                                    setEditingMediumId(medium.id);
                                    setMediumTitleValues((prev) => ({ ...prev, [medium.id]: medium.title }));
                                  }}
                                >
                                  <span style={{ color: "#6c63ff", marginRight: 4 }}>{mediumIdx + 1}.</span>
                                  {medium.title}
                                </p>
                              )}
                              {/* 小タスク達成カウント */}
                              {smallTasks.length > 0 && (
                                <span className="text-xs mt-0.5 inline-block" style={{ color: smallDoneCount === smallTasks.length ? "#4ade80" : "#4a5568" }}>
                                  {smallDoneCount}/{smallTasks.length} 完了
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => onCommentClick(medium)}
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
                              <select
                                value={medium.status}
                                disabled={updatingTask === medium.id}
                                onChange={(e) =>
                                  updateTaskStatus(medium.id, e.target.value as SubTaskStatus, true)
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
                                  <option key={opt.value} value={opt.value} style={{ background: "#1a1d27", color: "#e2e8f0" }}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => deleteMediumTask(medium.id)}
                                className="w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ background: "transparent", color: "#64748b", fontSize: 11 }}
                                title="削除"
                              >
                                🗑
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* 小タスク一覧（展開時） */}
                        {isExpanded && (
                          <div
                            className="ml-4 mt-1.5 pl-3"
                            style={{ borderLeft: "1px solid #2e3347" }}
                          >
                            <DndContext
                              id={`task-panel-small-${medium.id}`}
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
                                            className="rounded-lg p-2.5 group"
                                            style={{
                                              background: "#141622",
                                              border: `1px solid ${smallColors.border}`,
                                              opacity: isDraggingSmall ? 0.5 : 1,
                                            }}
                                          >
                                            <div className="flex items-start gap-1.5">
                                              <span
                                                {...smallHandleProps}
                                                className="text-sm shrink-0 mt-0.5 cursor-grab active:cursor-grabbing select-none"
                                                style={{ color: "#2e3347", touchAction: "none" }}
                                                title="長押しでドラッグ"
                                              >
                                                ⠿
                                              </span>
                                              <div className="flex-1 min-w-0">
                                                {editingSmallId === small.id ? (
                                                  <input
                                                    value={smallTitleValues[small.id] ?? small.title}
                                                    onChange={(e) =>
                                                      setSmallTitleValues((prev) => ({ ...prev, [small.id]: e.target.value }))
                                                    }
                                                    onBlur={() => saveSmallTitle(medium.id, small.id)}
                                                    onKeyDown={(e) => {
                                                      if (e.key === "Enter") {
                                                        if (lastKeyWasEnterRef.current) {
                                                          lastKeyWasEnterRef.current = false;
                                                          saveSmallTitle(medium.id, small.id);
                                                        } else {
                                                          lastKeyWasEnterRef.current = true;
                                                        }
                                                      } else if (e.key === "Escape") {
                                                        lastKeyWasEnterRef.current = false;
                                                        setEditingSmallId(null);
                                                      } else {
                                                        lastKeyWasEnterRef.current = false;
                                                      }
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
                                                      setSmallTitleValues((prev) => ({ ...prev, [small.id]: small.title }));
                                                    }}
                                                  >
                                                    <span style={{ color: "#a5b4fc", marginRight: 4 }}>
                                                      {mediumIdx + 1}-{smallIdx + 1}.
                                                    </span>
                                                    {small.title}
                                                  </p>
                                                )}
                                              </div>
                                              <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                  onClick={() => onCommentClick(small)}
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
                                                <select
                                                  value={small.status}
                                                  disabled={updatingTask === small.id}
                                                  onChange={(e) =>
                                                    updateTaskStatus(small.id, e.target.value as SubTaskStatus, false, medium.id)
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
                                                    <option key={opt.value} value={opt.value} style={{ background: "#1a1d27", color: "#e2e8f0" }}>
                                                      {opt.label}
                                                    </option>
                                                  ))}
                                                </select>
                                                <button
                                                  onClick={() => deleteSmallTask(medium.id, small.id)}
                                                  className="w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                  style={{ background: "transparent", color: "#64748b", fontSize: 10 }}
                                                  title="削除"
                                                >
                                                  🗑
                                                </button>
                                              </div>
                                            </div>

                                            {/* 小タスクのメモ・リンク欄 */}
                                            <MemoLinkField
                                              value={memoValues[small.id] ?? ""}
                                              onChange={(v) => setMemoValues((prev) => ({ ...prev, [small.id]: v }))}
                                              onBlur={() => saveMemo(small.id)}
                                              rows={1}
                                              compact
                                            />
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
                                      setAddingSmallTitle((prev) => ({ ...prev, [medium.id]: e.target.value }))
                                    }
                                    placeholder="小タスク名を入力..."
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") addSmallTask(medium.id);
                                      if (e.key === "Escape")
                                        setShowAddSmallMap((prev) => ({ ...prev, [medium.id]: false }));
                                    }}
                                    autoFocus
                                    className="w-full px-2 py-1.5 rounded text-xs outline-none mb-1.5"
                                    style={{ background: "#1e2032", border: "1px solid #2e3347", color: "#e2e8f0" }}
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
                                  style={{ background: "transparent", color: "#4a5568", border: "1px dashed #2e3347" }}
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
  );
});
