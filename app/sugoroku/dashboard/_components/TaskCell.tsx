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
  totalCells: number;
  isAdmin: boolean;
  onDelete: (taskId: string) => void;
}

/** セルの種類を判定 */
function getCellType(
  cellIndex: number,
  totalCells: number
): "start" | "goal" | "normal" {
  if (cellIndex === 0) return "start";
  if (cellIndex === totalCells - 1) return "goal";
  return "normal";
}

const CELL_TYPE_STYLES = {
  start: {
    badge: "🏁 START",
    badgeColor: "#4ade80",
    badgeBg: "rgba(74,222,128,0.15)",
    badgeBorder: "rgba(74,222,128,0.35)",
    glowColor: "rgba(74,222,128,0.25)",
  },
  goal: {
    badge: "🏆 GOAL",
    badgeColor: "#facc15",
    badgeBg: "rgba(250,204,21,0.15)",
    badgeBorder: "rgba(250,204,21,0.35)",
    glowColor: "rgba(250,204,21,0.25)",
  },
  normal: null,
};

export const TaskCell = memo(function TaskCell({
  task,
  isCurrentPosition,
  memberForToken,
  onClick,
  cellIndex,
  totalCells,
  isAdmin,
  onDelete,
}: TaskCellProps) {
  const isDraggable = task.status === "todo";
  const isDone = task.status === "done";
  const cellType = getCellType(cellIndex, totalCells);
  const typeStyle = CELL_TYPE_STYLES[cellType];

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
        minHeight: "140px",
        background: isDone ? "rgba(5,46,22,0.85)" : colors.bg,
        border: `1px solid ${isDone ? "rgba(74,222,128,0.35)" : colors.border}`,
        boxShadow: isCurrentPosition
          ? "0 0 0 3px rgba(108,99,255,.3), 0 0 16px rgba(108,99,255,.2)"
          : typeStyle?.glowColor
          ? `0 0 0 1.5px ${typeStyle.glowColor}`
          : isDragging
          ? "0 0 0 2px #6c63ff, 0 8px 24px rgba(108,99,255,0.4)"
          : undefined,
        opacity: isDragging ? 0.4 : 1,
        cursor: isDraggable ? "grab" : "pointer",
        touchAction: isDraggable ? "none" : undefined,
      }}
      className="relative rounded-xl p-4 transition-all duration-200 select-none"
      data-cell-index={cellIndex}
      onClick={() => !isDragging && onClick(task)}
      {...(isDraggable ? { ...attributes, ...listeners } : {})}
    >
      {/* セル種別バッジ (START / GOAL / CP) */}
      {typeStyle && (
        <div
          className="absolute top-0 inset-x-0 mx-2 -translate-y-3 flex justify-center"
          style={{ zIndex: 2 }}
        >
          <span
            className="px-2 py-0.5 rounded-full text-xs font-extrabold"
            style={{
              background: typeStyle.badgeBg,
              color: typeStyle.badgeColor,
              border: `1px solid ${typeStyle.badgeBorder}`,
              letterSpacing: "0.06em",
            }}
          >
            {typeStyle.badge}
          </span>
        </div>
      )}

      {/* 完了スタンプ */}
      {isDone && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none rounded-xl"
          style={{ zIndex: 1, background: "rgba(5,46,22,0.25)" }}
        >
          <span
            style={{
              fontSize: "44px",
              opacity: 0.18,
              transform: "rotate(-22deg)",
              lineHeight: 1,
              userSelect: "none",
            }}
          >
            ✅
          </span>
        </div>
      )}

      {/* セル番号 */}
      <div
        className="absolute top-2 left-2 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
        style={{ background: "#0f1117", color: "#94a3b8", zIndex: 3 }}
      >
        {cellIndex + 1}
      </div>

      {/* ドラッグ可能インジケーター */}
      {isDraggable && (
        <div
          className="absolute top-2 left-8 flex gap-0.5 items-center"
          style={{ color: "#4a5568", zIndex: 3 }}
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
            zIndex: 4,
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

      {/* 駒（admin でないとき右上に表示） */}
      {isCurrentPosition && memberForToken && !isAdmin && (
        <PlayerToken member={memberForToken} />
      )}

      {/* タイトル */}
      <div
        className="mt-5"
        style={{ paddingRight: isAdmin ? "4px" : "36px", position: "relative", zIndex: 3 }}
      >
        <p
          className="text-sm font-medium leading-snug"
          style={{ color: isDone ? "#86efac" : "#e2e8f0" }}
        >
          {task.title}
        </p>
      </div>

      {/* フッター: ステータスバッジ + 日付 */}
      <div className="mt-2 flex items-center justify-between gap-1" style={{ position: "relative", zIndex: 3 }}>
        <span
          className="inline-block px-2 py-0.5 rounded text-xs font-medium"
          style={{
            background: "rgba(0,0,0,0.3)",
            color: isDone ? "#4ade80" : colors.text,
            animation:
              task.status === "pending_approval"
                ? "blink 1.5s ease-in-out infinite"
                : undefined,
          }}
        >
          {isDone ? "🏆 達成" : STATUS_LABELS[task.status]}
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
