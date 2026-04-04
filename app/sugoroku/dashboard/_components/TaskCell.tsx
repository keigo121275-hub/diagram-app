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

export function TaskCell({
  task,
  isCurrentPosition,
  memberForToken,
  onClick,
  cellIndex,
  isAdmin,
  onDelete,
}: TaskCellProps) {
  const colors = STATUS_COLORS[task.status];

  return (
    <div
      className="relative rounded-xl p-3 transition-all duration-200 select-none cursor-pointer"
      style={{
        minHeight: "92px",
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        boxShadow: isCurrentPosition
          ? "0 0 0 3px rgba(108,99,255,.25)"
          : undefined,
      }}
      onClick={() => onClick(task)}
    >
      {/* セル番号 */}
      <div
        className="absolute top-2 left-2 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
        style={{ background: "#0f1117", color: "#94a3b8" }}
      >
        {cellIndex + 1}
      </div>

      {/* 削除ボタン（admin のみ・常時表示） */}
      {isAdmin && (
        <button
          className="absolute top-1.5 right-1.5 w-5 h-5 rounded flex items-center justify-center text-xs font-bold transition-all"
          style={{
            background: "rgba(248,113,113,0.15)",
            color: "#f87171",
            border: "1px solid rgba(248,113,113,0.3)",
          }}
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

      {/* タイトル（クリックで詳細） */}
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

      {/* ステータスバッジ */}
      <div className="mt-2">
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
      </div>
    </div>
  );
}
