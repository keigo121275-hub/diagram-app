"use client";

import React, { useState } from "react";
import type { Task } from "@/lib/supabase/types";
import { STATUS_COLORS, QUEST_STATUS_LABELS } from "@/app/sugoroku/_lib/constants";

interface TaskDetailHeaderProps {
  task: Task;
  largeStatus: Task["status"];
  dueDate: string;
  savingDate: boolean;
  taskDescription: string;
  savingDescription: boolean;
  descriptionSaved: boolean;
  onTitleSave: (title: string) => void;
  onDueDateChange: (v: string) => void;
  onDueDateBlur: (v: string) => void;
  onDueDateClear: () => void;
  onDescriptionChange: (v: string) => void;
  onDescriptionBlur: () => void;
}

export default React.memo(function TaskDetailHeader({
  task,
  largeStatus,
  dueDate,
  savingDate,
  taskDescription,
  savingDescription,
  descriptionSaved,
  onTitleSave,
  onDueDateChange,
  onDueDateBlur,
  onDueDateClear,
  onDescriptionChange,
  onDescriptionBlur,
}: TaskDetailHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [titleValue, setTitleValue] = useState(task.title);

  const largeColors = STATUS_COLORS[largeStatus];

  const handleSave = () => {
    const trimmed = titleValue.trim();
    if (!trimmed) { setEditing(false); setTitleValue(task.title); return; }
    onTitleSave(trimmed);
    setEditing(false);
  };

  return (
    <>
      {/* タイトル・ステータスバッジ */}
      <div>
        {editing ? (
          <textarea
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === "Escape") { e.preventDefault(); setEditing(false); setTitleValue(task.title); }
            }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = el.scrollHeight + "px";
            }}
            ref={(el) => {
              if (el) {
                el.style.height = "auto";
                el.style.height = el.scrollHeight + "px";
                el.focus();
                el.setSelectionRange(el.value.length, el.value.length);
              }
            }}
            rows={1}
            className="w-full px-3 py-1.5 rounded-lg text-base font-bold outline-none resize-none overflow-hidden"
            style={{ background: "#232636", border: "1px solid #6c63ff", color: "#e2e8f0", lineHeight: "1.5" }}
          />
        ) : (
          <h2
            className="text-base font-bold leading-snug cursor-pointer hover:underline"
            style={{ color: "#e2e8f0", whiteSpace: "pre-wrap", wordBreak: "break-word" }}
            title="クリックして編集"
            onClick={() => { setEditing(true); setTitleValue(task.title); }}
          >
            {task.title}
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
            {QUEST_STATUS_LABELS[largeStatus]}
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
            onChange={(e) => onDueDateChange(e.target.value)}
            onBlur={(e) => onDueDateBlur(e.target.value)}
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
              onClick={onDueDateClear}
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
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium" style={{ color: "#94a3b8" }}>
            説明・背景
          </p>
          {savingDescription && (
            <span className="text-xs" style={{ color: "#6c63ff" }}>保存中...</span>
          )}
          {!savingDescription && descriptionSaved && (
            <span className="text-xs" style={{ color: "#4ade80" }}>✓ 保存済み</span>
          )}
        </div>
        <textarea
          value={taskDescription}
          onChange={(e) => onDescriptionChange(e.target.value)}
          onBlur={onDescriptionBlur}
          placeholder="このタスクの意図や背景を入力..."
          rows={3}
          className="w-full text-xs outline-none resize-none rounded-lg p-2"
          style={{
            background: "#1a1d27",
            border: "1px solid #2e3347",
            color: "#e2e8f0",
          }}
        />
      </div>
    </>
  );
});
