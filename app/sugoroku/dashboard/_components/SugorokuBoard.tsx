"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Member, Task } from "@/lib/supabase/types";
import { BoardHeader } from "./BoardHeader";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { MemberTabs } from "./MemberTabs";
import { ProgressBar } from "./ProgressBar";
import { SugorokuGrid } from "./SugorokuGrid";

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

  const activeMemberId = isAdmin ? selectedMemberId : (currentMember?.id ?? "");
  const activeMember = isAdmin
    ? (allMembers.find((m) => m.id === activeMemberId) ?? currentMember)
    : currentMember;

  const roadmap = roadmaps.find((r) => r.member_id === activeMemberId);
  const allTasks = (roadmap?.tasks ?? []).sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0)
  );
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
        title={roadmap?.title ?? "ロードマップ"}
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
    </div>
  );
}
