"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Member, Task } from "@/lib/supabase/types";
import type { RoadmapWithTasks } from "@/app/sugoroku/_lib/types";
import { BoardHeader } from "./BoardHeader";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { MemberTabs } from "./MemberTabs";
import { ProgressBar } from "./ProgressBar";
import { SugorokuGrid } from "./SugorokuGrid";
import { DailyReportModal } from "./DailyReportModal";

interface SugorokuBoardProps {
  currentMember: Member | null;
  allMembers: Pick<Member, "id" | "name" | "email" | "avatar_url" | "role">[];
  roadmaps: RoadmapWithTasks[];
}

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return (a.order ?? 0) - (b.order ?? 0);
  });
}

export default function SugorokuBoard({
  currentMember,
  allMembers,
  roadmaps,
}: SugorokuBoardProps) {
  const router = useRouter();
  const isAdmin = currentMember?.role === "admin";
  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    currentMember?.id ?? ""
  );
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [localTasksMap, setLocalTasksMap] = useState<Record<string, Task[]>>({});
  const [showDailyReport, setShowDailyReport] = useState(false);

  const activeMemberId = isAdmin ? selectedMemberId : (currentMember?.id ?? "");

  // Supabase Realtime: アクティブなロードマップのタスク変更を購読
  useEffect(() => {
    const activeRoadmap = roadmaps.find((r) => r.member_id === activeMemberId);
    if (!activeRoadmap) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`tasks:roadmap:${activeRoadmap.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `roadmap_id=eq.${activeRoadmap.id}`,
        },
        () => {
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeMemberId, roadmaps, router]);
  const activeMember = isAdmin
    ? (allMembers.find((m) => m.id === activeMemberId) ?? currentMember)
    : currentMember;

  const roadmap = roadmaps.find((r) => r.member_id === activeMemberId);
  const rawTasks = localTasksMap[activeMemberId] ?? roadmap?.tasks ?? [];
  const allTasks = sortTasks(rawTasks);
  const tasks = allTasks.filter((t) => t.parent_id === null);
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
    await supabase.from("roadmaps").delete().eq("id", roadmap.id);
    setDeletingAll(false);
    router.refresh();
  };

  // ドラッグ並べ替え後のハンドラ
  const handleReorder = async (newRootTasks: Task[]) => {
    if (!roadmap) return;

    // order フィールドを新しい位置に更新してからローカル state に反映
    const reorderedRootTasks = newRootTasks.map((t, i) => ({ ...t, order: i + 1 }));
    const otherTasks = rawTasks.filter((t) => t.parent_id !== null);
    const updatedAllTasks = [...reorderedRootTasks, ...otherTasks];
    setLocalTasksMap((prev) => ({ ...prev, [activeMemberId]: updatedAllTasks }));

    // DB に order を一括更新（router.refresh は不要 - 楽観的 UI で管理）
    const supabase = createClient();
    await Promise.all(
      reorderedRootTasks.map((t) =>
        supabase.from("tasks").update({ order: t.order }).eq("id", t.id)
      )
    );
  };

  /** TaskDetailPanel から大タスクの変更通知を受け取り、ローカル state を即時更新 */
  const handleTaskUpdated = (id: string, patch: Partial<Task>) => {
    setLocalTasksMap((prev) => {
      const current = prev[activeMemberId] ?? roadmap?.tasks ?? [];
      const updated = current.map((t) => (t.id === id ? { ...t, ...patch } : t));
      return { ...prev, [activeMemberId]: updated };
    });
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
      <BoardHeader
        roadmapId={roadmap?.id ?? null}
        title={roadmap?.title ?? "ロードマップ"}
        description={roadmap?.description ?? null}
        isAdmin={isAdmin}
        hasRoadmap={!!roadmap}
        deletingAll={deletingAll}
        onDeleteAllClick={() => setConfirmDeleteAll(true)}
      />

      {confirmDeleteAll && roadmap && (
        <DeleteConfirmDialog
          roadmapTitle={roadmap.title}
          onCancel={() => setConfirmDeleteAll(false)}
          onConfirm={handleDeleteAllTasks}
        />
      )}

      {isAdmin && allMembers.length > 0 && (
        <MemberTabs
          members={allMembers}
          selectedMemberId={selectedMemberId}
          roadmaps={roadmaps}
          onSelect={setSelectedMemberId}
        />
      )}

      {!roadmap ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ background: "#1a1d27", border: "1px dashed #2e3347" }}
        >
          <div className="text-4xl mb-4">🗺️</div>
          <p style={{ color: "#94a3b8" }}>
            ロードマップがまだ作成されていません
          </p>
          {isAdmin && (
            <a
              href="/sugoroku/new-roadmap"
              className="inline-block mt-4 px-5 py-2.5 rounded-xl text-sm font-bold"
              style={{
                background: "linear-gradient(135deg, #6c63ff, #5b52ee)",
                color: "#fff",
              }}
            >
              ✨ ロードマップを生成する
            </a>
          )}
        </div>
      ) : (
        <div
          className="rounded-2xl p-6"
          style={{
            background: "#1a1d27",
            border: "1px solid #2e3347",
            opacity: deletingTaskId ? 0.7 : 1,
          }}
        >
          <ProgressBar done={doneCount} total={tasks.length} />
          {tasks.length > 0 ? (
            <SugorokuGrid
              tasks={tasks}
              allTasks={allTasks}
              currentMember={activeMember as Member}
              isAdmin={isAdmin}
              onDeleteTask={handleDeleteTask}
              onReorder={handleReorder}
              onTaskUpdated={handleTaskUpdated}
            />
          ) : (
            <div className="text-center py-12">
              <p style={{ color: "#94a3b8" }}>
                タスクがまだ追加されていません
              </p>
            </div>
          )}
        </div>
      )}

      {/* 日報モーダル（メンバー） */}
      {showDailyReport && roadmap && currentMember && !isAdmin && (
        <DailyReportModal
          roadmapId={roadmap.id}
          memberId={currentMember.id}
          onClose={() => setShowDailyReport(false)}
          onSubmitted={() => setShowDailyReport(false)}
        />
      )}

      {/* 日報ボタン（メンバーのみ、右下固定） */}
      {!isAdmin && roadmap && (
        <button
          onClick={() => setShowDailyReport(true)}
          className="fixed bottom-6 right-6 z-30 flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold shadow-lg"
          style={{
            background: "linear-gradient(135deg, #6c63ff, #5a52e8)",
            color: "#fff",
            boxShadow: "0 8px 24px rgba(108,99,255,0.4)",
          }}
        >
          📝 日報を書く
        </button>
      )}
    </div>
  );
}
