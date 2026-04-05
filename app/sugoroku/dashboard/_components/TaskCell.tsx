import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Member, Task } from "@/lib/supabase/types";
import { STATUS_LABELS, STATUS_COLORS } from "@/app/sugoroku/_lib/constants";
import { PlayerToken } from "./PlayerToken";

interface TaskCellProps {
  task: Task;
  isCurrentPosition: boolean;
  memberForToken: Pick<Member, "name" | "avatar_url"> | null;
  onClick: (task: Task) => void;
  cellIndex: number;
  isAdmin: boolean;
  onDelete: (taskId: string) => void;
}

export const TaskCell = memo(function TaskCell({
  task,
  isCurrentPosition,
  memberForToken,
  onClick,
  cellIndex,
  isAdmin,
  onDelete,
}: TaskCellProps) {
  const isDraggable = task.status === "todo";

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    disabled: !isDraggable,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const colors = STATUS_COLORS[task.status];

  const formattedDueDate = task.due_date
    ? (() => {
        const [, m, d] = task.due_date.split("-");
        return `${parseInt(m)}/${parseInt(d)}`;
      })()
    : null;

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        minHeight: "92px",
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        boxShadow: isCurrentPosition
          ? "0 0 0 3px rgba(108,99,255,.25)"
          : isDragging
          ? "0 0 0 2px #6c63ff, 0 8px 24px rgba(108,99,255,0.4)"
          : undefined,
        opacity: isDragging ? 0.4 : 1,
        cursor: isDraggable ? "grab" : "pointer",
        touchAction: isDraggable ? "none" : undefined,
      }}
      className="relative rounded-xl p-3 transition-all duration-200 select-none"
      onClick={() => !isDragging && onClick(task)}
      {...(isDraggable ? { ...attributes, ...listeners } : {})}
    >
      {/* セル番号 */}
      <div
        className="absolute top-2 left-2 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
        style={{ background: "#0f1117", color: "#94a3b8" }}
      >
        {cellIndex + 1}
      </div>

      {/* ドラッグ可能インジケーター */}
      {isDraggable && (
        <div
          className="absolute top-2 left-8 flex gap-0.5 items-center"
          style={{ color: "#4a5568" }}
        >
          <span style={{ fontSize: "10px", lineHeight: 1 }}>⠿</span>
        </div>
      )}

      {/* 削除ボタン（admin のみ） */}
      {isAdmin && (
        <button
          className="absolute top-1.5 right-1.5 w-5 h-5 rounded flex items-center justify-center text-xs font-bold transition-all"
          style={{
            background: "rgba(248,113,113,0.15)",
            color: "#f87171",
            border: "1px solid rgba(248,113,113,0.3)",
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task.id);
          }}
          title="このタスクを削除"
        >
          ✕
        </button>
      )}

      {/* 駒（adminでないときのみ右上に表示） */}
      {isCurrentPosition && memberForToken && !isAdmin && (
        <PlayerToken member={memberForToken} />
      )}

      {/* タイトル */}
      <div
        className="mt-5"
        style={{ paddingRight: isAdmin ? "4px" : "36px" }}
      >
        <p
          className="text-xs font-medium leading-snug"
          style={{ color: "#e2e8f0" }}
        >
          {task.title}
        </p>
      </div>

      {/* フッター: ステータスバッジ + 日付 */}
      <div className="mt-2 flex items-center justify-between gap-1">
        <span
          className="inline-block px-2 py-0.5 rounded text-xs font-medium"
          style={{
            background: "rgba(0,0,0,0.3)",
            color: colors.text,
            animation:
              task.status === "pending_approval"
                ? "blink 1.5s ease-in-out infinite"
                : undefined,
          }}
        >
          {STATUS_LABELS[task.status]}
        </span>

        {formattedDueDate && (
          <span
            className="shrink-0 text-xs px-1.5 py-0.5 rounded"
            style={{
              background: "rgba(108,99,255,0.15)",
              color: "#a5b4fc",
              border: "1px solid rgba(108,99,255,0.25)",
            }}
          >
            {formattedDueDate}
          </span>
        )}
      </div>
    </div>
  );
});
