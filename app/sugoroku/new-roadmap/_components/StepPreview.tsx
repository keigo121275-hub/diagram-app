"use client";

import { useState } from "react";
import { LEVEL_COLORS } from "@/app/sugoroku/_lib/constants";

type GeneratedTask = {
  title: string;
  level: "large" | "medium" | "small";
  order: number;
  children?: GeneratedTask[];
};

interface StepPreviewProps {
  roadmapTitle: string;
  memberName: string | undefined;
  duration: string;
  tasks: GeneratedTask[];
  saving: boolean;
  error: string | null;
  onTasksChange: (tasks: GeneratedTask[]) => void;
  onBack: () => void;
  onSave: () => void;
}

const COLS = 5;

export function StepPreview({
  roadmapTitle,
  memberName,
  duration,
  tasks,
  saving,
  error,
  onTasksChange,
  onBack,
  onSave,
}: StepPreviewProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const rows: GeneratedTask[][] = [];
  for (let i = 0; i < tasks.length; i += COLS) {
    rows.push(tasks.slice(i, i + COLS));
  }

  const selectedTask = selectedIdx !== null ? tasks[selectedIdx] : null;

  const updateLargeTask = (idx: number, updated: GeneratedTask) => {
    const newTasks = [...tasks];
    newTasks[idx] = updated;
    onTasksChange(newTasks);
  };

  const addLargeTask = () => {
    onTasksChange([
      ...tasks,
      { title: "新しいマス", level: "large", order: tasks.length + 1, children: [] },
    ]);
  };

  const deleteLargeTask = (idx: number) => {
    onTasksChange(tasks.filter((_, i) => i !== idx));
    if (selectedIdx === idx) setSelectedIdx(null);
  };

  const addChild = (parentIdx: number) => {
    const parent = tasks[parentIdx];
    const newChild: GeneratedTask = {
      title: "新しいサブタスク",
      level: "medium",
      order: (parent.children?.length ?? 0) + 1,
    };
    updateLargeTask(parentIdx, {
      ...parent,
      children: [...(parent.children ?? []), newChild],
    });
  };

  const updateChild = (
    parentIdx: number,
    childIdx: number,
    updated: Partial<GeneratedTask>
  ) => {
    const parent = tasks[parentIdx];
    const newChildren = [...(parent.children ?? [])];
    newChildren[childIdx] = { ...newChildren[childIdx], ...updated };
    updateLargeTask(parentIdx, { ...parent, children: newChildren });
  };

  const deleteChild = (parentIdx: number, childIdx: number) => {
    const parent = tasks[parentIdx];
    const newChildren = (parent.children ?? []).filter((_, i) => i !== childIdx);
    updateLargeTask(parentIdx, { ...parent, children: newChildren });
  };

  const largeLc = LEVEL_COLORS["large"];

  return (
    <div className="min-h-screen" style={{ background: "#0f1117" }}>
      <nav
        className="px-6 py-3 flex items-center justify-between"
        style={{ borderBottom: "1px solid #2e3347", background: "#1a1d27" }}
      >
        <div className="flex items-center gap-4">
          <button onClick={onBack} style={{ color: "#94a3b8", fontSize: "14px" }}>
            ← 入力に戻る
          </button>
          <span style={{ color: "#2e3347" }}>/</span>
          <span style={{ color: "#e2e8f0", fontSize: "14px" }}>プレビュー・編集</span>
        </div>
        <button
          onClick={onSave}
          disabled={saving || tasks.length === 0}
          className="px-5 py-2 rounded-xl text-sm font-bold transition-all"
          style={{
            background: saving
              ? "#232636"
              : "linear-gradient(135deg, #4ade80, #22c55e)",
            color: saving ? "#4a5568" : "#fff",
          }}
        >
          {saving ? "保存中..." : "✅ このロードマップを反映する"}
        </button>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold" style={{ color: "#e2e8f0" }}>
              {roadmapTitle}
            </h2>
            <p className="text-sm mt-1" style={{ color: "#94a3b8" }}>
              対象: {memberName} ／ {tasks.length}マス ／ {duration}
            </p>
          </div>
          <button
            onClick={addLargeTask}
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{
              background: "#1a1d27",
              border: "1px solid #2e3347",
              color: "#94a3b8",
            }}
          >
            + マスを追加
          </button>
        </div>

        {error && (
          <div
            className="mb-4 px-4 py-3 rounded-xl text-sm"
            style={{
              background: "#1f0f0f",
              border: "1px solid #f87171",
              color: "#f87171",
            }}
          >
            {error}
          </div>
        )}

        {/* すごろくグリッド（大タスクのみ） */}
        <div
          className="rounded-2xl p-6 mb-6"
          style={{ background: "#1a1d27", border: "1px solid #2e3347" }}
        >
          <div className="space-y-2">
            {rows.map((row, rowIdx) => {
              const isEvenRow = rowIdx % 2 === 0;
              const displayRow = isEvenRow ? row : [...row].reverse();
              return (
                <div key={rowIdx}>
                  <div
                    className="grid gap-2"
                    style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
                  >
                    {displayRow.map((task) => {
                      const originalIdx = tasks.findIndex((t) => t === task);
                      const isSelected = selectedIdx === originalIdx;
                      const childCount = task.children?.length ?? 0;
                      return (
                        <div
                          key={originalIdx}
                          className="relative rounded-xl p-3 cursor-pointer group"
                          style={{
                            minHeight: "96px",
                            background: isSelected ? "#1e2540" : "#1e2130",
                            border: `1px solid ${isSelected ? "#6c63ff" : "#2e3347"}`,
                            transition: "border-color 0.2s",
                          }}
                          onClick={() =>
                            setSelectedIdx(isSelected ? null : originalIdx)
                          }
                        >
                          <div
                            className="absolute top-2 left-2 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{ background: "#0f1117", color: "#94a3b8" }}
                          >
                            {originalIdx + 1}
                          </div>
                          <button
                            className="absolute top-1 right-1 w-5 h-5 rounded flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ background: "#f87171", color: "#fff" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteLargeTask(originalIdx);
                            }}
                          >
                            ✕
                          </button>
                          <div className="mt-5">
                            <p
                              className="text-xs font-medium leading-snug"
                              style={{ color: "#e2e8f0" }}
                            >
                              {task.title}
                            </p>
                          </div>
                          <div className="mt-2 flex items-center gap-1">
                            <span
                              className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                              style={{
                                background: largeLc.bg,
                                color: largeLc.text,
                                border: `1px solid ${largeLc.border}`,
                              }}
                            >
                              大タスク
                            </span>
                            {childCount > 0 && (
                              <span
                                className="text-xs"
                                style={{ color: "#64748b" }}
                              >
                                /{childCount}個
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {rowIdx < rows.length - 1 && (
                    <div className="flex justify-end py-1 pr-2">
                      <span style={{ color: "#2e3347", fontSize: "20px" }}>↓</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 選択中の大タスクの編集パネル */}
        {selectedTask && selectedIdx !== null && (
          <div
            className="rounded-2xl p-5 mb-6"
            style={{ background: "#1a1d27", border: "1px solid #6c63ff" }}
          >
            <p className="text-sm font-medium mb-3" style={{ color: "#6c63ff" }}>
              マス {selectedIdx + 1} を編集
            </p>

            {/* 大タスクタイトル */}
            <div className="flex gap-3 mb-5">
              <input
                value={selectedTask.title}
                onChange={(e) =>
                  updateLargeTask(selectedIdx, {
                    ...selectedTask,
                    title: e.target.value,
                  })
                }
                placeholder="大タスク名"
                className="flex-1 px-4 py-2 rounded-xl text-sm outline-none"
                style={{
                  background: "#232636",
                  border: "1px solid #2e3347",
                  color: "#e2e8f0",
                }}
              />
            </div>

            {/* サブタスクリスト */}
            <div className="space-y-2 mb-3">
              {(selectedTask.children ?? []).length === 0 && (
                <p className="text-xs" style={{ color: "#4a5568" }}>
                  サブタスクがまだありません
                </p>
              )}
              {(selectedTask.children ?? []).map((child, childIdx) => {
                const childLc = LEVEL_COLORS[child.level];
                return (
                  <div key={childIdx} className="flex items-center gap-2">
                    <span style={{ color: "#4a5568", fontSize: "12px" }}>└</span>
                    <input
                      value={child.title}
                      onChange={(e) =>
                        updateChild(selectedIdx, childIdx, { title: e.target.value })
                      }
                      className="flex-1 px-3 py-1.5 rounded-lg text-xs outline-none"
                      style={{
                        background: "#232636",
                        border: "1px solid #2e3347",
                        color: "#e2e8f0",
                      }}
                    />
                    <select
                      value={child.level}
                      onChange={(e) =>
                        updateChild(selectedIdx, childIdx, {
                          level: e.target.value as "medium" | "small",
                        })
                      }
                      className="px-2 py-1.5 rounded-lg text-xs outline-none"
                      style={{
                        background: "#232636",
                        border: `1px solid ${childLc.border}`,
                        color: childLc.text,
                      }}
                    >
                      <option value="medium">中</option>
                      <option value="small">小</option>
                    </select>
                    <button
                      onClick={() => deleteChild(selectedIdx, childIdx)}
                      className="w-6 h-6 rounded flex items-center justify-center text-xs"
                      style={{ background: "#2a1a1a", color: "#f87171" }}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => addChild(selectedIdx)}
              className="text-xs px-3 py-1.5 rounded-lg"
              style={{
                background: "#232636",
                border: "1px solid #2e3347",
                color: "#94a3b8",
              }}
            >
              + サブタスクを追加
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
