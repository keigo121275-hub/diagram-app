"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Member, Task } from "@/lib/supabase/types";
import TaskDetailPanel from "./TaskDetailPanel";

interface RoadmapWithTasks {
  id: string;
  member_id: string;
  title: string;
  created_at: string;
  tasks: Task[];
}

interface SugorokuBoardProps {
  currentMember: Member | null;
  allMembers: Pick<Member, "id" | "name" | "email" | "avatar_url" | "role">[];
  roadmaps: RoadmapWithTasks[];
}

const STATUS_LABELS: Record<Task["status"], string> = {
  todo: "未着手",
  in_progress: "進行中",
  pending_approval: "承認待ち",
  done: "完了",
  needs_revision: "要修正",
};

const STATUS_COLORS: Record<Task["status"], { bg: string; text: string; border: string }> = {
  todo: { bg: "#1e2130", text: "#94a3b8", border: "#2e3347" },
  in_progress: { bg: "#0f1e40", text: "#60a5fa", border: "#1e3a8a" },
  pending_approval: { bg: "#2a1f00", text: "#facc15", border: "#713f12" },
  done: { bg: "#052e16", text: "#4ade80", border: "#166534" },
  needs_revision: { bg: "#1f0f0f", text: "#f87171", border: "#7f1d1d" },
};

function PlayerToken({ member }: { member: Pick<Member, "name" | "avatar_url"> }) {
  const initials = member.name.slice(0, 2).toUpperCase();
  return (
    <div
      className="absolute"
      style={{
        top: "7px",
        right: "7px",
        width: "32px",
        height: "32px",
        borderRadius: "50%",
        border: "2px solid #fff",
        boxShadow: "0 0 12px rgba(108,99,255,0.6)",
        animation: "float 3s ease-in-out infinite",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {member.avatar_url ? (
        <img src={member.avatar_url} alt={member.name} className="w-full h-full object-cover" />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center text-xs font-bold"
          style={{ background: "linear-gradient(135deg, #6c63ff, #4ade80)", color: "#fff" }}
        >
          {initials}
        </div>
      )}
    </div>
  );
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium" style={{ color: "#94a3b8" }}>
          進捗
        </span>
        <span className="text-sm font-bold" style={{ color: "#e2e8f0" }}>
          {done} / {total} タスク完了 ({pct}%)
        </span>
      </div>
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height: "10px", background: "#232636" }}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(to right, #6c63ff, #4ade80)",
          }}
        />
      </div>
    </div>
  );
}

function TaskCell({
  task,
  isCurrentPosition,
  memberForToken,
  onClick,
  cellIndex,
  isAdmin,
  onDelete,
}: {
  task: Task;
  isCurrentPosition: boolean;
  memberForToken: Pick<Member, "name" | "avatar_url"> | null;
  onClick: (task: Task) => void;
  cellIndex: number;
  isAdmin: boolean;
  onDelete: (taskId: string) => void;
}) {
  const colors = STATUS_COLORS[task.status];

  return (
    <div
      className="relative rounded-xl p-3 transition-all duration-200 select-none"
      style={{
        minHeight: "92px",
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        boxShadow: isCurrentPosition ? "0 0 0 3px rgba(108,99,255,.25)" : undefined,
      }}
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
          style={{ background: "rgba(248,113,113,0.15)", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" }}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task.id);
          }}
          title="このタスクを削除"
        >
          ✕
        </button>
      )}

      {/* 駒（削除ボタンがないときだけ右上に表示） */}
      {isCurrentPosition && memberForToken && !isAdmin && (
        <PlayerToken member={memberForToken} />
      )}

      {/* タイトル（クリックで詳細） */}
      <div
        className="mt-5 cursor-pointer"
        style={{ paddingRight: isAdmin ? "4px" : "36px" }}
        onClick={() => onClick(task)}
      >
        <p className="text-xs font-medium leading-snug" style={{ color: "#e2e8f0" }}>
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
            animation: task.status === "pending_approval" ? "blink 1.5s ease-in-out infinite" : undefined,
          }}
        >
          {STATUS_LABELS[task.status]}
        </span>
      </div>
    </div>
  );
}

function SugorokuGrid({
  tasks,
  currentMember,
  isAdmin,
  onDeleteTask,
}: {
  tasks: Task[];
  currentMember: Member | null;
  isAdmin: boolean;
  onDeleteTask: (taskId: string) => void;
}) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const currentIndex = (() => {
    const lastDone = [...tasks].reverse().findIndex((t) => t.status === "done");
    if (lastDone === -1) return 0;
    const lastDoneIdx = tasks.length - 1 - lastDone;
    return Math.min(lastDoneIdx + 1, tasks.length - 1);
  })();

  const COLS = 5;
  const rows: Task[][] = [];
  for (let i = 0; i < tasks.length; i += COLS) {
    rows.push(tasks.slice(i, i + COLS));
  }

  return (
    <div>
      <div className="space-y-2">
        {rows.map((row, rowIdx) => {
          const isEvenRow = rowIdx % 2 === 0;
          const displayRow = isEvenRow ? row : [...row].reverse();

          return (
            <div key={rowIdx}>
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
                {displayRow.map((task) => {
                  const originalIndex = tasks.findIndex((t) => t.id === task.id);
                  return (
                    <TaskCell
                      key={task.id}
                      task={task}
                      isCurrentPosition={originalIndex === currentIndex}
                      memberForToken={originalIndex === currentIndex ? currentMember : null}
                      onClick={setSelectedTask}
                      cellIndex={originalIndex}
                      isAdmin={isAdmin}
                      onDelete={onDeleteTask}
                    />
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

      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

export default function SugorokuBoard({
  currentMember,
  allMembers,
  roadmaps,
}: SugorokuBoardProps) {
  const router = useRouter();
  const isAdmin = currentMember?.role === "admin";
  const [selectedMemberId, setSelectedMemberId] = useState<string>(currentMember?.id ?? "");
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const activeMemberId = isAdmin ? selectedMemberId : (currentMember?.id ?? "");
  const activeMember = isAdmin
    ? allMembers.find((m) => m.id === activeMemberId) ?? currentMember
    : currentMember;

  const roadmap = roadmaps.find((r) => r.member_id === activeMemberId);
  const tasks = (roadmap?.tasks ?? []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const doneCount = tasks.filter((t) => t.status === "done").length;

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("このタスクを削除しますか？")) return;
    setDeletingTaskId(taskId);
    const supabase = createClient();
    await supabase.from("tasks").delete().eq("id", taskId);
    setDeletingTaskId(null);
    router.refresh();
  };

  const handleDeleteAllTasks = async () => {
    if (!roadmap) return;
    setDeletingAll(true);
    setConfirmDeleteAll(false);
    const supabase = createClient();
    // ロードマップを削除するとタスクも CASCADE で削除される
    await supabase.from("roadmaps").delete().eq("id", roadmap.id);
    setDeletingAll(false);
    router.refresh();
  };

  if (roadmaps.length === 0 && !isAdmin) {
    return (
      <div className="text-center py-24">
        <div className="text-4xl mb-4">🗺️</div>
        <p style={{ color: "#94a3b8" }}>ロードマップがまだ作成されていません</p>
        <p className="text-sm mt-2" style={{ color: "#4a5568" }}>
          管理者にロードマップの作成を依頼してください
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* ヘッダー */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold" style={{ color: "#e2e8f0" }}>
            {roadmap?.title ?? "ロードマップ"}
          </h2>
          {isAdmin && (
            <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>
              管理者ビュー — メンバーのロードマップを確認できます
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* 一括削除ボタン（admin・ロードマップあり） */}
          {isAdmin && roadmap && (
            <button
              onClick={() => setConfirmDeleteAll(true)}
              disabled={deletingAll}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{
                background: "rgba(248,113,113,0.1)",
                border: "1px solid rgba(248,113,113,0.3)",
                color: "#f87171",
              }}
            >
              {deletingAll ? "削除中..." : "🗑️ 全タスク削除"}
            </button>
          )}

          {isAdmin && (
            <a
              href="/sugoroku/new-roadmap"
              className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
              style={{ background: "linear-gradient(135deg, #6c63ff, #5b52ee)", color: "#fff" }}
            >
              ✨ 新規生成
            </a>
          )}
        </div>
      </div>

      {/* 一括削除確認ダイアログ */}
      {confirmDeleteAll && (
        <>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.6)" }}
          >
            <div
              className="rounded-2xl p-6 w-80"
              style={{ background: "#1a1d27", border: "1px solid #f87171" }}
            >
              <h3 className="font-bold mb-2" style={{ color: "#e2e8f0" }}>
                ロードマップを削除しますか？
              </h3>
              <p className="text-sm mb-6" style={{ color: "#94a3b8" }}>
                「{roadmap?.title}」と全タスクが削除されます。この操作は取り消せません。
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDeleteAll(false)}
                  className="flex-1 py-2 rounded-xl text-sm font-medium"
                  style={{ background: "#232636", color: "#94a3b8" }}
                >
                  キャンセル
                </button>
                <button
                  onClick={handleDeleteAllTasks}
                  className="flex-1 py-2 rounded-xl text-sm font-bold"
                  style={{ background: "#f87171", color: "#fff" }}
                >
                  削除する
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* admin タブ */}
      {isAdmin && allMembers.length > 0 && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1" style={{ scrollbarWidth: "thin" }}>
          {allMembers.map((m) => {
            const memberRoadmap = roadmaps.find((r) => r.member_id === m.id);
            const memberTasks = memberRoadmap?.tasks ?? [];
            const memberDone = memberTasks.filter((t) => t.status === "done").length;
            const memberPct =
              memberTasks.length === 0 ? 0 : Math.round((memberDone / memberTasks.length) * 100);

            return (
              <button
                key={m.id}
                onClick={() => setSelectedMemberId(m.id)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm whitespace-nowrap transition-all"
                style={{
                  background: selectedMemberId === m.id ? "rgba(108,99,255,0.15)" : "#1a1d27",
                  border: `1px solid ${selectedMemberId === m.id ? "#6c63ff" : "#2e3347"}`,
                  color: selectedMemberId === m.id ? "#e2e8f0" : "#94a3b8",
                }}
              >
                {m.avatar_url ? (
                  <img src={m.avatar_url} alt={m.name} className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: "linear-gradient(135deg, #6c63ff, #4ade80)", color: "#fff" }}
                  >
                    {m.name.slice(0, 1)}
                  </div>
                )}
                <span>{m.name}</span>
                <span
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{ background: "#232636", color: "#94a3b8" }}
                >
                  {memberPct}%
                </span>
              </button>
            );
          })}
        </div>
      )}

      {!roadmap ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ background: "#1a1d27", border: "1px dashed #2e3347" }}
        >
          <div className="text-4xl mb-4">🗺️</div>
          <p style={{ color: "#94a3b8" }}>ロードマップがまだ作成されていません</p>
          {isAdmin && (
            <a
              href="/sugoroku/new-roadmap"
              className="inline-block mt-4 px-5 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: "linear-gradient(135deg, #6c63ff, #5b52ee)", color: "#fff" }}
            >
              ✨ ロードマップを生成する
            </a>
          )}
        </div>
      ) : (
        <div
          className="rounded-2xl p-6"
          style={{ background: "#1a1d27", border: "1px solid #2e3347", opacity: deletingTaskId ? 0.7 : 1 }}
        >
          <ProgressBar done={doneCount} total={tasks.length} />
          {tasks.length > 0 ? (
            <SugorokuGrid
              tasks={tasks}
              currentMember={activeMember as Member}
              isAdmin={isAdmin}
              onDeleteTask={handleDeleteTask}
            />
          ) : (
            <div className="text-center py-12">
              <p style={{ color: "#94a3b8" }}>タスクがまだ追加されていません</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
